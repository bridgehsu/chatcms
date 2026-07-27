use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}
