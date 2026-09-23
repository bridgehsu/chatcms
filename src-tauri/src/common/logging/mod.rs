//! 应用日志：`tauri-plugin-log` + `log` crate。

mod env;

pub use env::AppEnv;

use log::LevelFilter;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

const CRATE: &str = "chatcms_lib";

/// 按环境构建 log plugin（在 `tauri::Builder` 上最早注册）。
pub fn plugin(env: AppEnv) -> tauri_plugin_log::Builder {
    let (global_level, file_name, stdout) = match env {
        AppEnv::Dev => (LevelFilter::Debug, "chatcms-dev", true),
        AppEnv::Test => (LevelFilter::Info, "chatcms-test", true),
        AppEnv::Prod => (LevelFilter::Info, "chatcms", false),
    };

    let mut targets = vec![Target::new(TargetKind::LogDir {
        file_name: Some(file_name.into()),
    })];
    if stdout {
        targets.push(Target::new(TargetKind::Stdout));
    }

    tauri_plugin_log::Builder::new()
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .level(global_level)
        .max_file_size(10 * 1024 * 1024)
        .rotation_strategy(RotationStrategy::KeepAll)
        .level_for("hyper", LevelFilter::Warn)
        .level_for("reqwest", LevelFilter::Warn)
        .level_for("sqlx", LevelFilter::Warn)
        .level_for(CRATE, global_level)
        .level_for(format!("{CRATE}::chat"), global_level)
        .level_for(format!("{CRATE}::core::intent"), match env {
            AppEnv::Dev => LevelFilter::Debug,
            AppEnv::Test | AppEnv::Prod => LevelFilter::Info,
        })
        .targets(targets)
}

/// 启动完成后打一条摘要（plugin 已注册方可调用）。
pub fn log_startup() {
    let env = AppEnv::detect();
    log::info!(
        target: CRATE,
        "ChatCMS started env={} version={}",
        env.as_str(),
        env!("CARGO_PKG_VERSION"),
    );
}
