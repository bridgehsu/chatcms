mod agent;
mod accounts;
mod agents;
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
        .plugin(agent::commands::plugin())
        .plugin(config::commands::plugin())
        .plugin(permission::commands::plugin())
        .plugin(mcp::commands::plugin())
        .plugin(knowledge::commands::plugin())
        .plugin(channels::commands::plugin())
        .plugin(images::commands::plugin())
        .plugin(videos::commands::plugin())
        .plugin(accounts::commands::plugin())
        .plugin(media_platforms::commands::plugin())
        .plugin(nav_bookmarks::commands::plugin())
        .plugin(schedules::commands::plugin())
        .plugin(skills::commands::plugin())
        .plugin(agents::commands::plugin())
        .plugin(publish::commands::plugin())
        .setup(setup)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
