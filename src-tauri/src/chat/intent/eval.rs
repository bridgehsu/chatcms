//! 意图规则离线评测：内置 case bank + 批跑 `run`。

use serde::{Deserialize, Serialize};

use super::intent_result::IntentKind;
use super::run;

/// 单条评测样例。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalCase {
    pub id: String,
    pub input: String,
    /// snake_case，与 [`IntentKind::as_str`] 对齐
    pub expected_kind: String,
}

/// 单条跑分结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalCaseResult {
    pub id: String,
    pub input: String,
    pub expected_kind: String,
    pub actual_kind: String,
    pub actual_label: String,
    pub confidence: f32,
    pub matched: Vec<String>,
    pub passed: bool,
}

/// 整次评测报告。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalReport {
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
    /// 0.0 ~ 1.0
    pub accuracy: f32,
    pub cases: Vec<EvalCaseResult>,
}

/// 内置 case bank（与单元测试及常见运营话术对齐）。
pub fn default_cases() -> Vec<EvalCase> {
    vec![
        case("pub-1", "帮我发布到小红书", IntentKind::ContentPublish),
        case("pub-2", "发布到小红书并同步", IntentKind::ContentPublish),
        case("pub-3", "把这篇同步到公众号", IntentKind::ContentPublish),
        case("acc-1", "查一下这个账号的登录密码", IntentKind::AccountLookup),
        case("acc-2", "打开保险柜看看 token", IntentKind::AccountLookup),
        case("tool-1", "用 bash 列出当前目录", IntentKind::UseTools),
        case("tool-2", "读文件看看目录里有什么", IntentKind::UseTools),
        case("tool-3", "帮我改这段脚本再执行", IntentKind::UseTools),
        case("chat-1", "你好", IntentKind::GeneralChat),
        case("chat-2", "解释一下什么是 Agent", IntentKind::GeneralChat),
    ]
}

fn case(id: &str, input: &str, kind: IntentKind) -> EvalCase {
    EvalCase {
        id: id.to_string(),
        input: input.to_string(),
        expected_kind: kind.as_str().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_bank_all_pass() {
        let report = run_cases(None);
        assert_eq!(report.failed, 0, "failures: {:?}", report.cases.iter().filter(|c| !c.passed).collect::<Vec<_>>());
        assert!(report.accuracy >= 1.0);
    }
}

/// 对给定 case（空则用默认）跑 `intent::run` 并汇总。
pub fn run_cases(cases: Option<Vec<EvalCase>>) -> EvalReport {
    let cases = cases.unwrap_or_else(default_cases);
    let mut results = Vec::with_capacity(cases.len());
    let mut passed = 0usize;

    for c in cases {
        let intent = run(&c.input);
        let actual = intent.kind.as_str().to_string();
        let ok = actual == c.expected_kind;
        if ok {
            passed += 1;
        }
        results.push(EvalCaseResult {
            id: c.id,
            input: c.input,
            expected_kind: c.expected_kind,
            actual_kind: actual,
            actual_label: intent.kind.label_zh().to_string(),
            confidence: intent.confidence,
            matched: intent.matched,
            passed: ok,
        });
    }

    let total = results.len();
    let failed = total.saturating_sub(passed);
    let accuracy = if total == 0 {
        0.0
    } else {
        passed as f32 / total as f32
    };

    EvalReport {
        total,
        passed,
        failed,
        accuracy,
        cases: results,
    }
}
