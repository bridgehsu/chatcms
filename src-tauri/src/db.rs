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

    // 逐条执行 SQL，ALTER TABLE 语句若列已存在则跳过（兼容旧版 SQLite）
    for stmt in SCHEMA.split(';') {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        // 跳过注释行，找到实际 SQL 关键字
        let first_sql_word = s
            .lines()
            .map(|l| l.trim())
            .find(|l| !l.is_empty() && !l.starts_with("--"))
            .unwrap_or("")
            .to_uppercase();
        let is_alter = first_sql_word.starts_with("ALTER TABLE");
        if let Err(e) = sqlx::query(s).execute(&pool).await {
            if is_alter {
                // 列已存在 / 不支持 IF NOT EXISTS 语法 → 忽略
                eprintln!("[db] ALTER skipped: {e}");
            } else {
                return Err(e.into());
            }
        }
    }

    Ok(pool)
}
