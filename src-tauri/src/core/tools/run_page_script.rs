//! 在用户浏览器当前页执行渠道脚本（经扩展认领 pending job）。
//!
//! 页面脚本勿直接 `fetch(127.0.0.1)`（Chrome 私网访问会拦截）。
//! 需要 AI 时返回 `ai_complete`（扩展后台代调）或正文中的
//! `__CHATCMS_AI__\n{json}`（宿主兜底代调）。

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use super::types::{ToolCall, ToolDef};
use crate::agents::AgentState;
use crate::common::provider;
use crate::core::plan;

/// 含扩展后台 AI 的余量
const SCRIPT_TIMEOUT_SECS: u64 = 120;

const SCRIPT_AI_MARK: &str = "__CHATCMS_AI__";

const SCRIPT_AI_FALLBACK_SYSTEM: &str = "\
你是页面信息整理助手。严格按用户消息中的【AI任务】执行；\
找不到的字段写「未找到」，不要编造。直接输出整理结果，不要重复原文。";

pub fn def() -> ToolDef {
    ToolDef {
        name: "run_page_script".to_string(),
        description: "Run a ChatCMS channel script on the user's current browser tab via the extension. Use when the user @-mentioned a script or asked to execute a page script. Returns script output text, or ok with empty content for side-effect scripts.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Script package code (e.g. BOSS_GREET)"
                },
                "input": {
                    "type": "string",
                    "description": "Optional text to pass into the script (e.g. draft to fill into the page)"
                }
            },
            "required": ["code"]
        }),
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PageScriptJob {
    pub id: String,
    pub code: String,
    #[serde(default)]
    pub input: Option<String>,
    pub session_id: String,
    pub created: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PageScriptResult {
    pub ok: bool,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

pub async fn execute(
    call: &ToolCall,
    app: &AppHandle,
    session_id: &str,
) -> Result<String, String> {
    let code = call.input["code"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "code 不能为空".to_string())?
        .to_string();
    let input = call.input["input"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    execute_direct(app, session_id, code, input).await
}

/// 由会话编排直接触发（不经模型 tool call）。
pub async fn execute_direct(
    app: &AppHandle,
    session_id: &str,
    code: String,
    input: Option<String>,
) -> Result<String, String> {
    let code = code.trim().to_string();
    if code.is_empty() {
        return Err("code 不能为空".into());
    }

    let job_id = Uuid::new_v4().to_string();
    let job = PageScriptJob {
        id: job_id.clone(),
        code: code.clone(),
        input,
        session_id: session_id.to_string(),
        created: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    };

    let (tx, rx) = oneshot::channel::<PageScriptResult>();
    {
        let state = app.state::<AgentState>();
        state
            .pending_script_runs
            .lock()
            .unwrap()
            .insert(job_id.clone(), tx);
        state.script_job_queue.lock().unwrap().push(job.clone());
    }

    let _ = app.emit("page-script-request", &job);

    match timeout(Duration::from_secs(SCRIPT_TIMEOUT_SECS), rx).await {
        Ok(Ok(res)) => {
            if res.ok {
                let body = res.result.unwrap_or_default();
                if body.trim().is_empty() {
                    Ok(format!("脚本 `{code}` 已在浏览器执行完成（无返回内容）。"))
                } else {
                    Ok(resolve_embedded_script_ai(app, &body).await)
                }
            } else {
                Err(res
                    .error
                    .unwrap_or_else(|| format!("脚本 `{code}` 执行失败")))
            }
        }
        Ok(Err(_)) => Err("脚本执行通道已关闭（扩展未回传结果）".into()),
        Err(_) => {
            let state = app.state::<AgentState>();
            state.pending_script_runs.lock().unwrap().remove(&job_id);
            state
                .script_job_queue
                .lock()
                .unwrap()
                .retain(|j| j.id != job_id);
            Err(format!(
                "等待浏览器扩展执行脚本 `{code}` 超时（>{SCRIPT_TIMEOUT_SECS}s）。请确认扩展已连接且当前有可操作的网页标签。"
            ))
        }
    }
}

/// 旧扩展未处理 `ai_complete` 时：正文含 `__CHATCMS_AI__\n{json}` 则由宿主代调。
async fn resolve_embedded_script_ai(app: &AppHandle, body: &str) -> String {
    let Some(payload) = extract_ai_payload(body) else {
        return body.to_string();
    };
    let state = app.state::<AgentState>();
    let profile = match plan::resolve_profile(app, state.inner(), None, false, 4096).await {
        Ok(p) => p,
        Err(e) => {
            return format!("AI 调用失败（无法解析模型配置）：{e}\n\n{body}");
        }
    };
    let system = payload
        .system_prompt
        .as_deref()
        .unwrap_or(SCRIPT_AI_FALLBACK_SYSTEM);
    match provider::complete_chat(&profile, &payload.content, Some(system)).await {
        Ok(out) => {
            let t = out.trim().to_string();
            if t.is_empty() {
                format!("AI 调用失败：模型返回为空\n\n{body}")
            } else {
                t
            }
        }
        Err(e) => format!("AI 调用失败：{e}\n\n{body}"),
    }
}

struct EmbeddedAiPayload {
    content: String,
    system_prompt: Option<String>,
}

fn extract_ai_payload(body: &str) -> Option<EmbeddedAiPayload> {
    let idx = body.find(SCRIPT_AI_MARK)?;
    let json_part = body[idx + SCRIPT_AI_MARK.len()..].trim();
    // 正文可能是「标题\n\n__CHATCMS_AI__\n{...}」
    let v: serde_json::Value = serde_json::from_str(json_part).ok()?;
    let content = v
        .get("content")
        .and_then(|x| x.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();
    let system_prompt = v
        .get("system_prompt")
        .and_then(|x| x.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    Some(EmbeddedAiPayload {
        content,
        system_prompt,
    })
}

pub fn complete_job(app: &AppHandle, job_id: &str, result: PageScriptResult) -> Result<(), String> {
    let state = app.state::<AgentState>();
    state
        .script_job_queue
        .lock()
        .unwrap()
        .retain(|j| j.id != job_id);
    let tx = state
        .pending_script_runs
        .lock()
        .unwrap()
        .remove(job_id)
        .ok_or_else(|| "任务不存在或已过期".to_string())?;
    tx.send(result)
        .map_err(|_| "任务接收端已关闭".to_string())
}

pub fn list_jobs(app: &AppHandle) -> Vec<PageScriptJob> {
    let state = app.state::<AgentState>();
    let jobs = state.script_job_queue.lock().unwrap().clone();
    jobs
}
