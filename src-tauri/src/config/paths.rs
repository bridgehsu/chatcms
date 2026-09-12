//! 应用数据根目录与发布桥端口解析。
//! `chatcms.json`（store）始终在系统 `app_data_dir`，不受自定义 data_root 影响。

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::persist;

use super::GeneralSettings;

/// 解析数据根：自定义非空路径优先，否则系统 `app_data_dir`。
pub fn resolve_data_root(app: &AppHandle) -> PathBuf {
    if let Some(root) = read_general(app).data_root {
        let t = root.trim();
        if !t.is_empty() {
            let p = PathBuf::from(t);
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// 系统默认数据目录（忽略自定义配置，供 UI 占位提示）。
pub fn default_data_root(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn resolve_bridge_port(app: &AppHandle) -> u16 {
    let port = read_general(app).publish_bridge_port;
    if port == 0 {
        return GeneralSettings::default().publish_bridge_port;
    }
    port
}

fn read_general(app: &AppHandle) -> GeneralSettings {
    if let Some(state) = app.try_state::<crate::agents::AgentState>() {
        if let Ok(cfg) = state.config.lock() {
            return cfg.general.clone();
        }
    }
    persist::load_config(app)
        .map(|c| c.general)
        .unwrap_or_default()
}
