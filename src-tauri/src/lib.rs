mod agent;
mod accounts;
mod agents;
mod business_map;
mod channels;
mod chat_bridge;
mod config;
mod images;
mod knowledge;
mod mcp;
mod media_platforms;
mod memory;
mod nav_bookmarks;
mod permission;
mod persist;
mod provider;
mod publish;
mod schedules;
mod skills;
mod tools;
mod videos;

use agent::AgentState;
use publish::PublishBridge;
use tauri::Manager;

// ── App bootstrap ─────────────────────────────────────────────────────────────

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    let state = handle.state::<AgentState>();

    // Publish bridge
    handle.state::<PublishBridge>().bind_app(handle.clone());
    let bridge = (*app.state::<PublishBridge>()).clone();
    tauri::async_runtime::spawn(async move {
        let _ = bridge.ensure_running().await;
    });

    // Sync state from disk
    if let Some(mut config) = persist::load_config(&handle) {
        config.ensure_profiles();
        persist::save_config(&handle, &config);
        *state.config.lock().unwrap() = config;
    }
    *state.sessions.lock().unwrap() = persist::load_sessions(&handle);
    *state.knowledge.lock().unwrap() = persist::load_knowledge(&handle);
    *state.skills.lock().unwrap() = skills::ensure_seeded(&handle);
    *state.agents.lock().unwrap() = agents::ensure_seeded(&handle);

    // MCP — connect all enabled servers
    let mcp_configs = persist::load_mcp_configs(&handle);
    if !mcp_configs.is_empty() {
        let h = handle.clone();
        tauri::async_runtime::spawn(async move {
            let s = h.state::<AgentState>();
            let mut mcp = s.mcp.lock().await;
            mcp.configs = mcp_configs;
            mcp.connect_all().await;
        });
    }

    // Channels — restore config
    let channel_cfg = persist::load_channel_config(&handle);
    let h = handle.clone();
    tauri::async_runtime::spawn(async move {
        let s = h.state::<AgentState>();
        let mut ch = s.channel.lock().await;
        ch.config = channel_cfg;
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AgentState::new())
        .manage(PublishBridge::new())
        .invoke_handler(tauri::generate_handler![
            // agent / session
            agent::commands::chat_send,
            agent::commands::session_list,
            agent::commands::session_get,
            agent::commands::session_delete,
            agent::commands::session_rename,
            agent::commands::session_pin,
            // config / provider
            config::commands::config_get,
            config::commands::config_set,
            config::commands::provider_list,
            config::commands::provider_add,
            config::commands::provider_update,
            config::commands::provider_remove,
            config::commands::provider_activate,
            // permission
            permission::commands::permission_respond,
            permission::commands::permission_get,
            permission::commands::permission_set,
            permission::commands::permission_mode_list,
            permission::commands::permission_mode_add,
            permission::commands::permission_mode_update,
            permission::commands::permission_mode_remove,
            permission::commands::permission_mode_reorder,
            permission::commands::permission_mode_set_active,
            permission::commands::permission_domains,
            permission::commands::permission_audit_list,
            permission::commands::permission_clear_session_grants,
            // mcp
            mcp::commands::mcp_list,
            mcp::commands::mcp_add,
            mcp::commands::mcp_update,
            mcp::commands::mcp_remove,
            mcp::commands::mcp_reconnect,
            mcp::commands::mcp_disconnect,
            mcp::commands::mcp_tools,
            // knowledge
            knowledge::commands::knowledge_list,
            knowledge::commands::knowledge_add,
            knowledge::commands::knowledge_update,
            knowledge::commands::knowledge_remove,
            knowledge::commands::knowledge_site_profile_get,
            knowledge::commands::knowledge_site_profile_set,
            knowledge::commands::knowledge_public_feed,
            knowledge::commands::knowledge_export_public,
            // channels
            channels::commands::channel_list,
            channels::commands::channel_get,
            channels::commands::channel_update,
            channels::commands::channel_enable,
            channels::commands::channel_disable,
            channels::commands::channel_telegram_get,
            channels::commands::channel_telegram_set,
            channels::commands::channel_telegram_start,
            channels::commands::channel_telegram_stop,
            // images
            images::commands::image_generate,
            images::commands::image_list,
            images::commands::image_delete,
            images::commands::image_upload,
            images::commands::image_update,
            images::commands::image_data_url,
            // videos
            videos::commands::video_generate,
            videos::commands::video_list,
            videos::commands::video_delete,
            videos::commands::video_upload,
            videos::commands::video_update,
            // accounts
            accounts::commands::account_list,
            accounts::commands::account_add,
            accounts::commands::account_update,
            accounts::commands::account_remove,
            // media platforms
            media_platforms::commands::media_platform_list,
            media_platforms::commands::media_platform_list_page,
            media_platforms::commands::media_platform_get,
            media_platforms::commands::media_platform_upsert,
            media_platforms::commands::media_platform_set_enabled,
            media_platforms::commands::media_platform_remove,
            media_platforms::commands::publish_script_get,
            media_platforms::commands::publish_script_list,
            media_platforms::commands::publish_script_save_draft,
            media_platforms::commands::publish_script_publish,
            media_platforms::commands::publish_script_discard_draft,
            media_platforms::commands::collect_script_get,
            media_platforms::commands::collect_script_list,
            media_platforms::commands::collect_script_save_draft,
            media_platforms::commands::collect_script_publish,
            media_platforms::commands::collect_script_discard_draft,
            // nav bookmarks
            nav_bookmarks::commands::nav_bookmark_list,
            nav_bookmarks::commands::nav_bookmark_upsert,
            nav_bookmarks::commands::nav_bookmark_remove,
            nav_bookmarks::commands::nav_custom_list,
            nav_bookmarks::commands::nav_custom_upsert,
            nav_bookmarks::commands::nav_custom_remove,
            // business map
            business_map::commands::map_state_get,
            business_map::commands::map_state_save,
            // schedules
            schedules::commands::schedule_list,
            schedules::commands::schedule_get,
            schedules::commands::schedule_add,
            schedules::commands::schedule_update,
            schedules::commands::schedule_save_workflow,
            schedules::commands::schedule_remove,
            // skills
            skills::commands::skill_list,
            skills::commands::skill_add,
            skills::commands::skill_update,
            skills::commands::skill_remove,
            skills::commands::skill_export_md,
            // agents
            agents::commands::agent_list,
            agents::commands::agent_add,
            agents::commands::agent_update,
            agents::commands::agent_activate,
            agents::commands::agent_remove,
            // publish
            publish::commands::publish_to_browser,
            publish::commands::publish_media_base,
        ])
        .setup(setup)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
