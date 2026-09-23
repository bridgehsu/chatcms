//! 规则表数据：内置默认 + 运行时 Rule 结构（可被 DB 覆盖）。

use super::intent_result::IntentKind;

/// 单条意图规则（owned，供缓存 / 打分使用）。
#[derive(Debug, Clone)]
pub struct Rule {
    pub kind: IntentKind,
    pub keywords: Vec<String>,
    pub weight: f32,
    pub enabled: bool,
}

/// 内置默认规则（种子写入与缓存缺失时的 fallback）。
pub fn defaults() -> Vec<Rule> {
    vec![
        Rule {
            kind: IntentKind::ContentPublish,
            keywords: [
                "发布", "同步", "推文", "发帖", "公众号", "小红书", "抖音", "微博", "publish",
                "post", "sync",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            weight: 0.35,
            enabled: true,
        },
        Rule {
            kind: IntentKind::AccountLookup,
            keywords: [
                "账号",
                "密码",
                "登录",
                "密钥",
                "token",
                "私钥",
                "公钥",
                "保险柜",
                "password",
                "account",
                "credential",
                "vault",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            weight: 0.35,
            enabled: true,
        },
        Rule {
            kind: IntentKind::UseTools,
            keywords: [
                "读文件",
                "写文件",
                "打开",
                "运行",
                "执行",
                "bash",
                "命令",
                "脚本",
                "目录",
                "搜索代码",
                "mcp",
                "工具",
                "帮我改",
                "重构",
                "read",
                "write",
                "run",
                "execute",
                "file",
                "folder",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            weight: 0.28,
            enabled: true,
        },
        Rule {
            kind: IntentKind::GeneralChat,
            keywords: [
                "你好",
                "谢谢",
                "什么是",
                "为什么",
                "怎么理解",
                "解释一下",
                "聊聊",
                "hello",
                "thanks",
                "what is",
                "why",
                "explain",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            weight: 0.25,
            enabled: true,
        },
    ]
}

/// 按 kind 取内置默认（恢复单条时用）。
pub fn default_for(kind: IntentKind) -> Option<Rule> {
    defaults().into_iter().find(|r| r.kind == kind)
}
