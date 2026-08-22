//! 规则表数据：只声明，不扫描、不计分。

use super::intent_result::IntentKind;

/// 单条意图规则。
#[derive(Debug, Clone, Copy)]
pub struct Rule {
    pub kind: IntentKind,
    pub keywords: &'static [&'static str],
    /// 单次关键词命中加分
    pub weight: f32,
}

/// 全部规则（可随产品扩展）。
pub fn all() -> &'static [Rule] {
    &[
        Rule {
            kind: IntentKind::ContentPublish,
            keywords: &[
                "发布", "同步", "推文", "发帖", "公众号", "小红书", "抖音", "微博", "publish",
                "post", "sync",
            ],
            weight: 0.35,
        },
        Rule {
            kind: IntentKind::AccountLookup,
            keywords: &[
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
            ],
            weight: 0.35,
        },
        Rule {
            kind: IntentKind::UseTools,
            keywords: &[
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
            ],
            weight: 0.28,
        },
        Rule {
            kind: IntentKind::GeneralChat,
            keywords: &[
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
            ],
            weight: 0.25,
        },
    ]
}
