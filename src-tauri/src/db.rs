//! SQLite 连接池与 Schema 初始化。

use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tauri::{AppHandle, Manager};

const SCHEMA: &str = include_str!("../../scripts/database/schema.sql");

/// Tauri 托管状态：全局连接池。
pub struct DbPool(pub SqlitePool);

/// 初始化连接池并创建 Schema（首次运行时建表）。
pub async fn init(app: &AppHandle) -> Result<SqlitePool> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let db_path = dir.join("chatcms.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    sqlx::raw_sql(SCHEMA).execute(&pool).await?;
    Ok(pool)
}
