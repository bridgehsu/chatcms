//! 选模型：会话钉死 > 手动激活 > 自动路由 > 旧配置。

use anyhow::Result;
use tauri::AppHandle;

use crate::agents::AgentState;
use crate::common::config::{ProviderConfig, ProviderKind};
use crate::models::ProviderProfile;

pub async fn resolve_profile(
    app: &AppHandle,
    state: &AgentState,
    pinned_profile_id: Option<String>,
    has_tools: bool,
    context_tokens: usize,
) -> Result<ProviderProfile> {
    let profiles = crate::models::repository::list(app).await;
    let (auto_mode, active_profile_id, legacy_provider) = {
        let cfg = state.config.lock().unwrap();
        (
            cfg.auto_mode,
            cfg.active_profile_id.clone(),
            cfg.provider.clone(),
        )
    };

    let pinned = pinned_profile_id.and_then(|pid| {
        profiles
            .iter()
            .find(|p| p.id == pid && p.enabled)
            .cloned()
    });

    let profile = pinned.or_else(|| {
        if auto_mode {
            return route(state, &profiles, has_tools, context_tokens);
        }
        active_profile_id
            .as_deref()
            .and_then(|pid| profiles.iter().find(|p| p.id == pid && p.enabled).cloned())
            .or_else(|| route(state, &profiles, has_tools, context_tokens))
    });

    profile.or_else(|| legacy_profile(&legacy_provider)).ok_or_else(|| {
        anyhow::anyhow!("没有可用的模型配置，请在 Models 页面添加并启用至少一个 Profile")
    })
}

fn route(
    state: &AgentState,
    profiles: &[ProviderProfile],
    has_tools: bool,
    context_tokens: usize,
) -> Option<ProviderProfile> {
    state
        .router
        .clone()
        .pick(profiles, has_tools, context_tokens, &[])
        .and_then(|id| profiles.iter().find(|p| p.id == id).cloned())
}

fn legacy_profile(provider: &ProviderConfig) -> Option<ProviderProfile> {
    if provider.api_key.trim().is_empty() {
        return None;
    }
    let kind = match provider.kind {
        ProviderKind::Anthropic => "anthropic",
        ProviderKind::OpenAI => "openai",
    };
    Some(ProviderProfile {
        id: "__legacy__".to_string(),
        name: "Legacy Config".to_string(),
        kind: kind.to_string(),
        api_key: provider.api_key.clone(),
        model: provider.model.clone(),
        base_url: provider.base_url.clone(),
        tier: "cloud".to_string(),
        weight: 2,
        context_window: 8192,
        enabled: true,
        created: 0,
        updated: 0,
        capabilities: serde_json::Value::Object(Default::default()),
        thinking: false,
        thinking_effort: "medium".into(),
        temperature: None,
        max_output_tokens: None,
        extra_body: serde_json::Value::Object(Default::default()),
        tags: vec![],
    })
}
