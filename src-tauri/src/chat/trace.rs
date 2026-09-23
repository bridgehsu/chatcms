//! 会话链路观测：分段耗时 + 落库供「运行观测」页展示。

use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

const TARGET: &str = "chatcms_lib::chat.trace";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TracePhase {
    pub name: String,
    /// 距请求起点的毫秒
    pub elapsed_ms: u64,
    /// 本阶段自身耗时（若有）
    #[serde(default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub detail: String,
}

/// Provider 流式调用回填的计时（避免 provider ↔ chat 循环依赖细节）
#[derive(Debug, Default, Clone)]
pub struct StreamTiming {
    pub url: String,
    pub tools_n: usize,
    pub body_approx_chars: usize,
    /// 发出请求 → 收到响应头
    pub http_ms: u64,
    /// 发出请求 → 首个可见 token（content / thinking / tool_call）
    pub ttft_ms: Option<u64>,
    /// 首字之后 → 流结束（真正「出字」时长）；无首字则为 0
    pub stream_ms: u64,
    /// 发出请求 → 整次 provider 调用结束
    pub total_ms: u64,
    pub out_chars: usize,
    pub tool_calls_n: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatTurnTrace {
    pub id: String,
    pub session_id: String,
    pub ts: i64,
    pub content_len: usize,
    pub intent_kind: String,
    pub needs_tools: bool,
    #[serde(default)]
    pub chat_mode: String,
    pub model: String,
    pub base_url: String,
    pub thinking: bool,
    pub tools_count: usize,
    pub msg_count: usize,
    pub system_chars: usize,
    pub http_ms: Option<u64>,
    pub ttft_ms: Option<u64>,
    pub stream_ms: Option<u64>,
    pub total_ms: u64,
    pub ok: bool,
    pub error: Option<String>,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub tool_rounds: usize,
    pub phases: Vec<TracePhase>,
}

pub struct ChatTrace {
    pub id: String,
    pub session_id: String,
    t0: Instant,
    last: Instant,
    phases: Vec<TracePhase>,
    pub content_len: usize,
    pub intent_kind: String,
    pub needs_tools: bool,
    pub chat_mode: String,
    pub model: String,
    pub base_url: String,
    pub thinking: bool,
    pub tools_count: usize,
    pub msg_count: usize,
    pub system_chars: usize,
    pub http_ms: Option<u64>,
    pub ttft_ms: Option<u64>,
    pub stream_ms: Option<u64>,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub tool_rounds: usize,
    pub ok: bool,
    pub error: Option<String>,
}

impl ChatTrace {
    pub fn start(session_id: &str, content_len: usize) -> Self {
        let now = Instant::now();
        let id = Uuid::new_v4().to_string();
        let mut t = Self {
            id,
            session_id: session_id.to_string(),
            t0: now,
            last: now,
            phases: Vec::new(),
            content_len,
            intent_kind: String::new(),
            needs_tools: false,
            chat_mode: String::new(),
            model: String::new(),
            base_url: String::new(),
            thinking: false,
            tools_count: 0,
            msg_count: 0,
            system_chars: 0,
            http_ms: None,
            ttft_ms: None,
            stream_ms: None,
            input_tokens: 0,
            output_tokens: 0,
            tool_rounds: 0,
            ok: true,
            error: None,
        };
        t.mark("entry", format!("content_len={content_len}"));
        t
    }

    pub fn elapsed_ms(&self) -> u64 {
        self.t0.elapsed().as_millis() as u64
    }

    /// 记录一个阶段：duration = 距上一 mark；elapsed = 距 t0
    pub fn mark(&mut self, name: &str, detail: impl Into<String>) {
        let elapsed = self.elapsed_ms();
        let duration = self.last.elapsed().as_millis() as u64;
        self.last = Instant::now();
        let detail = detail.into();
        log::info!(
            target: TARGET,
            "phase={name} session_id={} elapsed_ms={elapsed} duration_ms={duration} {detail}",
            self.session_id,
        );
        self.phases.push(TracePhase {
            name: name.to_string(),
            elapsed_ms: elapsed,
            duration_ms: duration,
            detail,
        });
    }

    pub fn apply_stream(&mut self, st: &StreamTiming) {
        self.http_ms = Some(st.http_ms);
        self.ttft_ms = st.ttft_ms;
        self.stream_ms = Some(st.stream_ms);
        let ttft = st
            .ttft_ms
            .map(|v| v.to_string())
            .unwrap_or_else(|| "—".into());
        let wait_first = st
            .ttft_ms
            .map(|t| t.saturating_sub(st.http_ms))
            .unwrap_or(0);
        let detail = format!(
            "url={} · tools={} · body≈{} · HTTP建连 {}ms · 等首字 {}ms · 首字累计 {}ms · 出字后 {}ms · 合计 {}ms · 输出{}字 · tool_calls={}",
            st.url,
            st.tools_n,
            st.body_approx_chars,
            st.http_ms,
            wait_first,
            ttft,
            st.stream_ms,
            st.total_ms,
            st.out_chars,
            st.tool_calls_n,
        );
        let elapsed = self.elapsed_ms();
        let duration = if st.total_ms > 0 {
            st.total_ms
        } else {
            st.http_ms.saturating_add(st.stream_ms)
        };
        log::info!(
            target: TARGET,
            "phase=provider_stream session_id={} elapsed_ms={elapsed} duration_ms={duration} {detail}",
            self.session_id,
        );
        self.phases.push(TracePhase {
            name: "provider_stream".into(),
            elapsed_ms: elapsed,
            duration_ms: duration,
            detail,
        });
        self.last = Instant::now();
    }

    pub fn finish_ok(&mut self) {
        self.ok = true;
        let total = self.elapsed_ms();
        let ttft = self
            .ttft_ms
            .map(|v| v.to_string())
            .unwrap_or_else(|| "—".into());
        let http = self
            .http_ms
            .map(|v| v.to_string())
            .unwrap_or_else(|| "—".into());
        self.mark(
            "total",
            format!(
                "total_ms={total} model={} tools={} ttft={ttft} http={http}",
                self.model, self.tools_count
            ),
        );
    }

    pub fn finish_err(&mut self, err: &str) {
        self.ok = false;
        self.error = Some(err.to_string());
        let total = self.elapsed_ms();
        self.mark("total", format!("total_ms={total} error={err}"));
    }

    pub fn into_record(self) -> ChatTurnTrace {
        let total_ms = self.elapsed_ms();
        ChatTurnTrace {
            id: self.id,
            session_id: self.session_id,
            ts: chrono_now_ms(),
            content_len: self.content_len,
            intent_kind: self.intent_kind,
            needs_tools: self.needs_tools,
            chat_mode: self.chat_mode,
            model: self.model,
            base_url: self.base_url,
            thinking: self.thinking,
            tools_count: self.tools_count,
            msg_count: self.msg_count,
            system_chars: self.system_chars,
            http_ms: self.http_ms,
            ttft_ms: self.ttft_ms,
            stream_ms: self.stream_ms,
            total_ms,
            ok: self.ok,
            error: self.error,
            input_tokens: self.input_tokens,
            output_tokens: self.output_tokens,
            tool_rounds: self.tool_rounds,
            phases: self.phases,
        }
    }
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 脱敏展示用 base_url（去掉尾部路径噪音，保留 host）
pub fn redact_base_url(raw: &str) -> String {
    let t = raw.trim().trim_end_matches('/');
    if t.is_empty() {
        return "(default)".into();
    }
    t.to_string()
}
