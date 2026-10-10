//! @脚本 动作：执行 / 解释 / 问清楚（硬规则，不靠模型猜）。

use super::attachments::ChatAttachment;

/// 用户对 @脚本 的意图。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScriptAction {
    /// 在当前页执行脚本
    Execute,
    /// 只介绍 / 讨论脚本，不执行
    Explain,
    /// 意图不清，先反问
    Ask,
}

impl ScriptAction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Execute => "execute",
            Self::Explain => "explain",
            Self::Ask => "ask",
        }
    }
}

const EXECUTE_HINTS: &[&str] = &[
    "执行",
    "运行",
    "跑一下",
    "跑一跑",
    "采一下",
    "采集",
    "抓取",
    "填一下",
    "填入",
    "填到",
    "填写",
    "灌入",
    "写入",
    "发布",
    "同步到",
    "发到",
    "发一下",
    "用上面",
    "用上一条",
    "用最近",
    "帮我采",
    "帮我填",
    "帮我跑",
    "开始执行",
    "run",
    "execute",
    "collect",
    "fill",
];

const EXPLAIN_HINTS: &[&str] = &[
    "是什么",
    "干什么",
    "做什么",
    "干嘛",
    "介绍",
    "说明",
    "怎么用",
    "如何用",
    "什么意思",
    "区别",
    "原理",
    "解释",
    "what is",
    "how does",
    "explain",
];

const PREV_CONTENT_HINTS: &[&str] = &[
    "用上面",
    "上面那段",
    "上一条",
    "最近一条",
    "刚才那段",
    "刚才写的",
    "最近写的",
    "上一则",
];

const FILL_HINTS: &[&str] = &[
    "填", "灌", "写入", "发布", "发到", "同步", "填表", "填入",
];

/// 根据用户原文 + 已 @ 的脚本，判定动作。
pub fn classify(content: &str, scripts: &[&ChatAttachment]) -> ScriptAction {
    if scripts.is_empty() {
        return ScriptAction::Ask;
    }
    let rest = strip_script_mentions(content, scripts);
    let rest_trim = rest.trim();
    let lower = rest_trim.to_lowercase();

    let has_exec = contains_any(&lower, EXECUTE_HINTS) || contains_any(rest_trim, EXECUTE_HINTS);
    let has_explain = contains_any(&lower, EXPLAIN_HINTS) || contains_any(rest_trim, EXPLAIN_HINTS);

    if has_explain && !has_exec {
        return ScriptAction::Explain;
    }
    if has_exec {
        return ScriptAction::Execute;
    }
    // 只有 @，没有有效说明 → 问清楚
    if rest_trim.is_empty() {
        return ScriptAction::Ask;
    }
    // 去掉语气词后仍很短且无动词 → 问清楚
    let compact: String = rest_trim
        .chars()
        .filter(|c| !c.is_whitespace() && !"，。！？、,.!?;；：:".contains(*c))
        .collect();
    if compact.chars().count() <= 4 {
        return ScriptAction::Ask;
    }
    // 有一段话但看不出要执行 → 问清楚（避免乱说误跑）
    ScriptAction::Ask
}

/// 写页脚本的 input：正文 / 「上面那段」/ 话里剩余文本。
pub fn resolve_input(
    content: &str,
    scripts: &[&ChatAttachment],
    last_assistant: Option<&str>,
) -> Option<String> {
    let rest = strip_script_mentions(content, scripts);
    let rest_trim = rest.trim();
    if rest_trim.is_empty() {
        return None;
    }

    if contains_any(rest_trim, PREV_CONTENT_HINTS) {
        return last_assistant
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
    }

    if let Some(body) = extract_marked_body(rest_trim) {
        if body.chars().count() >= 4 {
            return Some(body);
        }
    }

    // 填/发类：剩余文本去掉执行套话后若足够长，当作要填的正文
    if contains_any(rest_trim, FILL_HINTS) {
        let cleaned = strip_hint_phrases(rest_trim, EXECUTE_HINTS);
        let cleaned = strip_hint_phrases(&cleaned, FILL_HINTS);
        let cleaned = cleaned.trim();
        if cleaned.chars().count() >= 8 {
            return Some(cleaned.to_string());
        }
        return last_assistant
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
    }

    None
}

pub fn ask_message(scripts: &[&ChatAttachment]) -> String {
    let names: Vec<&str> = scripts.iter().map(|s| s.label.as_str()).collect();
    let joined = names.join("、");
    format!(
        "你 @了「{joined}」。\n\n请确认一下：\n1. **执行** — 在当前浏览器页面运行该脚本\n2. **了解** — 只介绍脚本用途，不执行\n\n可以说「执行一下」或「这是干什么的」。"
    )
}

pub fn need_agent_mode_message(scripts: &[&ChatAttachment]) -> String {
    let names: Vec<&str> = scripts.iter().map(|s| s.label.as_str()).collect();
    format!(
        "你 @了「{}」，并希望执行页面脚本。\n\n请先将模式切换到 **Agent** 后再发送（Ask / Search 不能操作网页）。",
        names.join("、")
    )
}

/// 填页 / 发布类意图，但拿不到要写入的文案。
pub fn need_write_input_message(scripts: &[&ChatAttachment]) -> String {
    let names: Vec<&str> = scripts.iter().map(|s| s.label.as_str()).collect();
    format!(
        "你要执行「{}」，但还缺少要填入页面的文案。\n\n可以这样补充：\n- 直接写：`@{} 填入下面：……`\n- 或用上一条助手回复：`@{} 用上面那段填入`",
        names.join("、"),
        names.first().copied().unwrap_or("脚本"),
        names.first().copied().unwrap_or("脚本"),
    )
}

/// 用户话里是否像「填/发」类操作（需要 input）。
pub fn looks_like_write(content: &str, scripts: &[&ChatAttachment]) -> bool {
    let rest = strip_script_mentions(content, scripts);
    if contains_any(&rest, FILL_HINTS) {
        return true;
    }
    for s in scripts {
        let blob = format!("{} {}", s.label, s.code.as_deref().unwrap_or(""));
        let lower = blob.to_lowercase();
        if lower.contains("填")
            || lower.contains("发")
            || lower.contains("fill")
            || lower.contains("publish")
            || lower.contains("write")
        {
            return true;
        }
    }
    false
}

fn strip_script_mentions(content: &str, scripts: &[&ChatAttachment]) -> String {
    let mut s = content.to_string();
    for a in scripts {
        for token in [&a.label, &a.id] {
            let needle = format!("@{token}");
            s = s.replace(&needle, " ");
        }
        if let Some(code) = &a.code {
            let needle = format!("@{code}");
            s = s.replace(&needle, " ");
        }
    }
    // 残留的 @xxx 词（前端可能只插了 label）
    let mut out = String::new();
    for part in s.split_whitespace() {
        if part.starts_with('@') && part.chars().count() < 40 {
            continue;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(part);
    }
    out
}

fn contains_any(hay: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| hay.contains(n))
}

fn extract_marked_body(text: &str) -> Option<String> {
    for marker in ["下面：", "如下：", "正文：", "内容：", "文案："] {
        if let Some(idx) = text.find(marker) {
            let body = text[idx + marker.len()..].trim();
            if !body.is_empty() {
                return Some(body.to_string());
            }
        }
    }
    // 简单引号包裹
    if let Some(start) = text.find('「') {
        let after = start + '「'.len_utf8();
        if let Some(rel_end) = text[after..].find('」') {
            let body = text[after..after + rel_end].trim();
            if body.chars().count() >= 4 {
                return Some(body.to_string());
            }
        }
    }
    None
}

fn strip_hint_phrases(text: &str, hints: &[&str]) -> String {
    let mut s = text.to_string();
    for h in hints {
        s = s.replace(h, " ");
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn script(label: &str, code: &str) -> ChatAttachment {
        ChatAttachment {
            kind: "script".into(),
            id: code.into(),
            label: label.into(),
            code: Some(code.into()),
        }
    }

    #[test]
    fn classify_execute() {
        let owned = script("BOSS打招呼", "JOB_BOSS_GREET");
        let s = [&owned];
        assert_eq!(classify("@BOSS打招呼 执行一下", &s), ScriptAction::Execute);
        assert_eq!(classify("采一下 @BOSS打招呼", &s), ScriptAction::Execute);
    }

    #[test]
    fn classify_explain() {
        let owned = script("BOSS打招呼", "JOB_BOSS_GREET");
        let s = [&owned];
        assert_eq!(
            classify("@BOSS打招呼 这是干什么的", &s),
            ScriptAction::Explain
        );
    }

    #[test]
    fn classify_ask_on_nonsense() {
        let owned = script("BOSS打招呼", "JOB_BOSS_GREET");
        let s = [&owned];
        assert_eq!(
            classify("@BOSS打招呼 今天天气真好", &s),
            ScriptAction::Ask
        );
        assert_eq!(classify("@BOSS打招呼", &s), ScriptAction::Ask);
    }

    #[test]
    fn resolve_input_from_marked_body() {
        let owned = script("打招呼填入", "JOB_BOSS_FILL");
        let s = [&owned];
        let v = resolve_input("@打招呼填入 填入下面：你好，我对这份工作很感兴趣", &s, None);
        assert_eq!(
            v.as_deref(),
            Some("你好，我对这份工作很感兴趣")
        );
    }

    #[test]
    fn looks_like_write_from_label() {
        let owned = script("打招呼填入", "JOB_BOSS_FILL");
        let s = [&owned];
        assert!(looks_like_write("@打招呼填入 执行一下", &s));
        let collect = script("BOSS打招呼", "JOB_BOSS_GREET");
        let c = [&collect];
        assert!(!looks_like_write("@BOSS打招呼 执行一下", &c));
    }
}
