pub mod commands;
pub mod paths;

pub use paths::{default_data_root, resolve_bridge_port, resolve_data_root};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

fn default_true() -> bool { true }

fn default_video_base_url() -> String {
    "http://127.0.0.1:6060".into()
}

fn default_crawler_base_url() -> String {
    "http://127.0.0.1:8080".into()
}

fn default_bridge_port() -> u16 {
    17890
}

/// 全局运行时配置（存储根、外挂服务地址、本机桥端口）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralSettings {
    /// 自定义数据根；空 / None 则用系统 app_data_dir
    #[serde(default)]
    pub data_root: Option<String>,
    /// chatcms-video / MPT FastAPI 根地址
    #[serde(default = "default_video_base_url")]
    pub video_base_url: String,
    /// 本机发布桥监听端口（改后需重启）
    #[serde(default = "default_bridge_port")]
    pub publish_bridge_port: u16,
    /// chatcms-collect Worker 根地址
    #[serde(default = "default_crawler_base_url")]
    pub crawler_base_url: String,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            data_root: None,
            video_base_url: default_video_base_url(),
            publish_bridge_port: default_bridge_port(),
            crawler_base_url: default_crawler_base_url(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 当前生效的模型配置（Agent 请求使用）
    pub provider: ProviderConfig,
    /// 已保存的模型配置列表
    #[serde(default)]
    pub profiles: Vec<ProviderProfile>,
    /// 当前激活的配置 id
    #[serde(default)]
    pub active_profile_id: Option<String>,
    /// 权限：模式 / 域策略 / MCP / 约束
    #[serde(default)]
    pub permission: crate::permission::PermissionConfig,
    /// 当前激活的代理 ID（None 时取第一个启用代理）
    #[serde(default)]
    pub active_agent_id: Option<String>,
    /// 是否启用自动路由（true=按 tier+weight 路由，false=手动）
    #[serde(default = "default_true")]
    pub auto_mode: bool,
    /// 全局配置：存储根 / 视频服务 / 发布桥 / 采集 Worker
    #[serde(default)]
    pub general: GeneralSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub kind: ProviderKind,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    pub kind: ProviderKind,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProfileInfo {
    pub id: String,
    pub name: String,
    pub kind: ProviderKind,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Anthropic,
    OpenAI,
}

impl Default for AppConfig {
    fn default() -> Self {
        let profile = ProviderProfile {
            id: Uuid::new_v4().to_string(),
            name: "默认".to_string(),
            kind: ProviderKind::Anthropic,
            api_key: String::new(),
            model: "claude-sonnet-4-6".to_string(),
            base_url: None,
        };
        Self {
            provider: ProviderConfig {
                kind: profile.kind.clone(),
                api_key: profile.api_key.clone(),
                model: profile.model.clone(),
                base_url: profile.base_url.clone(),
            },
            active_profile_id: Some(profile.id.clone()),
            profiles: vec![profile],
            permission: crate::permission::PermissionConfig::default(),
            active_agent_id: None,
            auto_mode: true,
            general: GeneralSettings::default(),
        }
    }
}

impl AppConfig {
    /// 旧版仅有 provider 时，补一条配置档案
    pub fn ensure_profiles(&mut self) {
        self.permission.ensure_defaults();
        if !self.profiles.is_empty() {
            if self.active_profile_id.is_none() {
                self.active_profile_id = self.profiles.first().map(|p| p.id.clone());
            }
            self.sync_active_provider();
            return;
        }

        let id = Uuid::new_v4().to_string();
        self.profiles.push(ProviderProfile {
            id: id.clone(),
            name: "默认".to_string(),
            kind: self.provider.kind.clone(),
            api_key: self.provider.api_key.clone(),
            model: self.provider.model.clone(),
            base_url: self.provider.base_url.clone(),
        });
        self.active_profile_id = Some(id);
    }

    pub fn sync_active_provider(&mut self) {
        let Some(id) = self.active_profile_id.clone() else {
            return;
        };
        let Some(profile) = self.profiles.iter().find(|p| p.id == id) else {
            return;
        };
        self.provider = ProviderConfig {
            kind: profile.kind.clone(),
            api_key: profile.api_key.clone(),
            model: profile.model.clone(),
            base_url: profile.base_url.clone(),
        };
    }

    pub fn profile_infos(&self) -> Vec<ProviderProfileInfo> {
        let active = self.active_profile_id.as_deref();
        self.profiles
            .iter()
            .map(|p| ProviderProfileInfo {
                id: p.id.clone(),
                name: p.name.clone(),
                kind: p.kind.clone(),
                api_key: p.api_key.clone(),
                model: p.model.clone(),
                base_url: p.base_url.clone(),
                active: active == Some(p.id.as_str()),
            })
            .collect()
    }

    pub fn upsert_active_from_provider(&mut self) {
        if let Some(id) = self.active_profile_id.clone() {
            if let Some(p) = self.profiles.iter_mut().find(|p| p.id == id) {
                p.kind = self.provider.kind.clone();
                p.api_key = self.provider.api_key.clone();
                p.model = self.provider.model.clone();
                p.base_url = self.provider.base_url.clone();
                return;
            }
        }

        self.ensure_profiles();
        if let Some(id) = self.active_profile_id.clone() {
            if let Some(p) = self.profiles.iter_mut().find(|p| p.id == id) {
                p.kind = self.provider.kind.clone();
                p.api_key = self.provider.api_key.clone();
                p.model = self.provider.model.clone();
                p.base_url = self.provider.base_url.clone();
            }
        }
    }

    /// 从旧版 mpt_config / crawler_config store 补齐 general（仅在仍为默认值时）
    pub fn hydrate_general_from_legacy(&mut self, app: &tauri::AppHandle) {
        let defaults = GeneralSettings::default();
        if self.general.video_base_url.trim() == defaults.video_base_url {
            if let Some(v) = crate::persist::load_mpt_config(app) {
                if let Some(url) = v.get("base_url").and_then(|x| x.as_str()) {
                    let url = url.trim().trim_end_matches('/');
                    if !url.is_empty() {
                        self.general.video_base_url = url.to_string();
                    }
                }
            }
        }
        if self.general.crawler_base_url.trim() == defaults.crawler_base_url {
            if let Some(v) = crate::persist::load_crawler_config(app) {
                if let Some(url) = v.get("base_url").and_then(|x| x.as_str()) {
                    let url = url.trim().trim_end_matches('/');
                    if !url.is_empty() {
                        self.general.crawler_base_url = url.to_string();
                    }
                }
            }
        }
        // 规范化空串
        if self
            .general
            .data_root
            .as_ref()
            .is_some_and(|s| s.trim().is_empty())
        {
            self.general.data_root = None;
        }
        if self.general.publish_bridge_port == 0 {
            self.general.publish_bridge_port = defaults.publish_bridge_port;
        }
    }
}
