mod agents;
mod chat;
mod core;
mod common;
mod mcp;
mod models;
mod scripts;
mod accounts;
mod business_map;
mod channels;
mod bridge;
mod crawler;
mod db;
mod images;
mod kbase;
mod medias;
mod mpt;
mod notes;
mod bmarks;
mod publish;
mod schedules;
mod videos;

use agents::AgentState;
use publish::PublishBridge;
use tauri::Manager;

// ── App bootstrap ─────────────────────────────────────────────────────────────

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    crate::common::logging::log_startup();

    let handle = app.handle().clone();
    let state = handle.state::<AgentState>();

    // 先加载配置（data_root / 发布桥端口依赖此项）
    if let Some(mut config) = common::persist::load_config(&handle) {
        config.ensure_profiles();
        config.hydrate_general_from_legacy(&handle);
        common::persist::save_config(&handle, &config);
        crate::common::provider::configure_http_client(
            config.general.use_system_proxy,
            &config.general.http_proxy_url,
        );
        *state.config.lock().unwrap() = config;
    } else {
        crate::common::provider::configure_http_client(false, "");
    }

    // Publish bridge
    handle.state::<PublishBridge>().bind_app(handle.clone());
    let bridge = (*app.state::<PublishBridge>()).clone();
    tauri::async_runtime::spawn(async move {
        let _ = bridge.ensure_running().await;
    });

    // Initialize SQLite (using a dedicated runtime for blocking init in setup)
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio rt for db init");

    let pool = rt.block_on(crate::db::init(&handle))?;
    handle.manage(crate::db::DbPool(pool));

    // Sync state from disk
    *state.sessions.lock().unwrap() = rt.block_on(chat::repository::load_all(&handle));
    *state.knowledge.lock().unwrap() = rt.block_on(kbase::repository::load_all(&handle));
    *state.skills.lock().unwrap() = rt.block_on(scripts::ensure_seeded(&handle));
    *state.agents.lock().unwrap() = rt.block_on(agents::service::ensure_seeded(&handle));
    rt.block_on(core::intent::ensure_seeded(&handle));

    // 迁移旧 chatcms.json 中的 profiles 到 SQLite model_profile 表（同步执行，确保启动时完成）
    {
        let legacy_profiles = state.config.lock().unwrap().profiles.clone();
        rt.block_on(models::service::migrate_from_legacy(&handle, legacy_profiles));
    }

    // 媒体平台 / 发布·采集脚本：chatcms.json → SQLite，并补种子数据
    rt.block_on(medias::migrate_and_seed(&handle));

    // MCP — connect all enabled servers
    let mcp_configs = mcp::repository::load_configs(&handle);
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
    let channel_cfg = common::persist::load_channel_config(&handle);
    let h = handle.clone();
    tauri::async_runtime::spawn(async move {
        let s = h.state::<AgentState>();
        let mut ch = s.channel.lock().await;
        ch.config = channel_cfg;
    });

    log::info!(target: "chatcms_lib", "app setup completed");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_env = common::logging::AppEnv::detect();
    tauri::Builder::default()
        .plugin(common::logging::plugin(app_env).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AgentState::new())
        .manage(PublishBridge::new())
        .manage(accounts::vault::VaultState::new())
        .invoke_handler(tauri::generate_handler![
            // chat / session
            chat::commands::chat_send,
            chat::commands::chat_abort,
            chat::commands::chat_complete,
            chat::commands::chat_trace_list,
            chat::commands::session_list,
            chat::commands::session_get,
            chat::commands::session_delete,
            chat::commands::session_rename,
            chat::commands::session_pin,
            chat::commands::session_set_group,
            chat::commands::session_set_agent,
            chat::commands::session_group_list,
            chat::commands::session_group_create,
            chat::commands::session_group_rename,
            chat::commands::session_group_delete,
            core::intent::commands::intent_rule_list,
            core::intent::commands::intent_rule_update,
            core::intent::commands::intent_rule_reset_defaults,
            core::intent::commands::intent_rule_reset_one,
            core::intent::commands::intent_eval_cases,
            core::intent::commands::intent_eval_run,
            // config / provider
            common::config::commands::config_get,
            common::config::commands::config_set,
            common::config::commands::provider_list,
            common::config::commands::provider_add,
            common::config::commands::provider_update,
            common::config::commands::provider_remove,
            common::config::commands::provider_activate,
            common::config::commands::provider_set_auto,
            common::config::commands::general_config_get,
            common::config::commands::general_config_set,
            // permission
            common::permission::commands::permission_respond,
            common::permission::commands::permission_get,
            common::permission::commands::permission_set,
            common::permission::commands::permission_mode_list,
            common::permission::commands::permission_mode_add,
            common::permission::commands::permission_mode_update,
            common::permission::commands::permission_mode_remove,
            common::permission::commands::permission_mode_reorder,
            common::permission::commands::permission_mode_set_active,
            common::permission::commands::permission_domains,
            common::permission::commands::permission_audit_list,
            common::permission::commands::permission_clear_session_grants,
            // mcp
            mcp::commands::mcp_list,
            mcp::commands::mcp_add,
            mcp::commands::mcp_update,
            mcp::commands::mcp_remove,
            mcp::commands::mcp_reconnect,
            mcp::commands::mcp_disconnect,
            mcp::commands::mcp_tools,
            // knowledge
            kbase::commands::knowledge_list,
            kbase::commands::knowledge_add,
            kbase::commands::knowledge_update,
            kbase::commands::knowledge_remove,
            kbase::commands::knowledge_site_profile_get,
            kbase::commands::knowledge_site_profile_set,
            kbase::commands::knowledge_public_feed,
            kbase::commands::knowledge_export_public,
            // content notes
            notes::commands::notes_list,
            notes::commands::notes_create,
            notes::commands::notes_update,
            notes::commands::notes_remove,
            notes::commands::notes_group_create,
            notes::commands::notes_group_rename,
            notes::commands::notes_group_delete,
            notes::commands::notes_by_message,
            notes::commands::notes_import_legacy,
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
            // chatcms-video studio
            mpt::commands::mpt_config_get,
            mpt::commands::mpt_config_set,
            mpt::commands::mpt_health,
            mpt::commands::mpt_meta_options,
            mpt::commands::mpt_meta_voices,
            mpt::commands::mpt_voice_preview,
            mpt::commands::mpt_studio_config_get,
            mpt::commands::mpt_studio_config_set,
            mpt::commands::mpt_generate_script,
            mpt::commands::mpt_generate_terms,
            mpt::commands::mpt_create_video,
            mpt::commands::mpt_get_task,
            mpt::commands::mpt_import_video,
            mpt::commands::mpt_list_bgm,
            mpt::commands::mpt_upload_bgm,
            mpt::commands::mpt_list_materials,
            mpt::commands::mpt_upload_material,
            mpt::commands::mpt_upload_custom_audio,
            // accounts
            accounts::commands::account_list,
            accounts::commands::account_add,
            accounts::commands::account_update,
            accounts::commands::account_remove,
            accounts::commands::account_reveal,
            accounts::commands::vault_status,
            accounts::commands::vault_setup,
            accounts::commands::vault_unlock,
            accounts::commands::vault_lock,
            // media platforms
            medias::commands::media_platform_list,
            medias::commands::media_platform_list_page,
            medias::commands::media_platform_get,
            medias::commands::media_platform_upsert,
            medias::commands::media_platform_set_enabled,
            medias::commands::media_platform_remove,
            medias::commands::publish_script_get,
            medias::commands::publish_script_list,
            medias::commands::publish_script_save_draft,
            medias::commands::publish_script_publish,
            medias::commands::publish_script_discard_draft,
            medias::commands::collect_script_get,
            medias::commands::collect_script_list,
            medias::commands::collect_script_save_draft,
            medias::commands::collect_script_publish,
            medias::commands::collect_script_discard_draft,
            // nav bookmarks
            bmarks::commands::nav_bookmark_list,
            bmarks::commands::nav_bookmark_upsert,
            bmarks::commands::nav_bookmark_remove,
            bmarks::commands::nav_custom_list,
            bmarks::commands::nav_custom_upsert,
            bmarks::commands::nav_custom_remove,
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
            // crawler / chatcms-collect worker
            crawler::commands::crawler_config_get,
            crawler::commands::crawler_config_set,
            crawler::commands::crawler_health,
            crawler::commands::crawler_start,
            crawler::commands::crawler_stop,
            crawler::commands::crawler_status,
            crawler::commands::crawler_logs,
            crawler::commands::crawler_list_data,
            crawler::commands::crawler_task_list,
            crawler::commands::crawler_task_get,
            crawler::commands::crawler_task_add,
            crawler::commands::crawler_task_update,
            crawler::commands::crawler_task_remove,
            // skills
            scripts::commands::skill_list,
            scripts::commands::skill_add,
            scripts::commands::skill_update,
            scripts::commands::skill_remove,
            scripts::commands::skill_install_npx,
            scripts::commands::skill_export_md,
            // agents
            agents::commands::agent_list,
            agents::commands::agent_add,
            agents::commands::agent_update,
            agents::commands::agent_activate,
            agents::commands::agent_active_id,
            agents::commands::agent_remove,
            // publish
            publish::commands::publish_to_browser,
            publish::commands::publish_media_base,
            // model profiles
            models::commands::model_profile_list,
            models::commands::model_profile_add,
            models::commands::model_profile_update,
            models::commands::model_profile_remove,
            models::commands::model_profile_activate,
            models::commands::model_profile_pin_session,
        ])
        .setup(setup)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
