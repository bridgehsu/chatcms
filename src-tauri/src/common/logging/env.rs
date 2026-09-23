//! 运行环境识别：dev / test / prod。

/// 应用运行环境（影响日志级别与输出目标）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppEnv {
    Dev,
    Test,
    Prod,
}

impl AppEnv {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Dev => "dev",
            Self::Test => "test",
            Self::Prod => "prod",
        }
    }

    /// 解析当前进程环境。
    ///
    /// 1. `CHATCMS_ENV=dev|test|prod` 优先
    /// 2. debug 编译 → Dev
    /// 3. 否则 → Prod
    pub fn detect() -> Self {
        if let Ok(raw) = std::env::var("CHATCMS_ENV") {
            match raw.to_ascii_lowercase().as_str() {
                "dev" | "development" => return Self::Dev,
                "test" | "staging" => return Self::Test,
                "prod" | "production" => return Self::Prod,
                _ => {}
            }
        }
        if cfg!(debug_assertions) {
            Self::Dev
        } else {
            Self::Prod
        }
    }
}
