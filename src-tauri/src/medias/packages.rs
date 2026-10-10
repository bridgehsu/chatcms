//! 插件脚本：正文在 `<data_root>/scripts/<CODE>/`，SQLite 只存元数据。
//! 无草稿/发布双态——磁盘文件即插件运行内容。

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::repository::{self as media_repo};
use super::{BridgeScript, now_ms};
use crate::common::config::resolve_data_root;
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

fn block_on<T>(fut: impl std::future::Future<Output = T>) -> T {
    tokio::task::block_in_place(|| match tokio::runtime::Handle::try_current() {
        Ok(h) => h.block_on(fut),
        Err(_) => tauri::async_runtime::block_on(fut),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptPackage {
    pub id: String,
    pub code: String,
    pub name: String,
    pub enabled: bool,
    pub entry_path: String,
    /// 兼容字段：有入口文件则为 1，否则 0
    pub published_version: u32,
    pub notes: String,
    pub updated_at: i64,
    /// 磁盘上存在入口文件
    pub is_published: bool,
    /// 固定 false（无草稿态）
    pub has_unpublished_draft: bool,
    pub file_count: u32,
    /// 绝对路径：`<data_root>/scripts/<CODE>`
    pub dir_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptFile {
    pub id: String,
    pub package_id: String,
    pub path: String,
    /// 文件正文（兼容旧字段名）
    pub draft_content: String,
    pub published_content: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptPackageDetail {
    pub package: ScriptPackage,
    pub files: Vec<ScriptFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptPackagePage {
    pub items: Vec<ScriptPackage>,
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
}

pub fn normalize_code(raw: &str) -> Result<String, String> {
    let code = raw.trim().to_uppercase();
    if code.is_empty() {
        return Err("编码不能为空".into());
    }
    if !code
        .chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
    {
        return Err("编码仅允许大写字母、数字与下划线".into());
    }
    Ok(code)
}

pub fn normalize_js_path(raw: &str) -> Result<String, String> {
    let p = raw.trim().replace('\\', "/").trim_start_matches('/').to_string();
    if p.is_empty() {
        return Err("文件路径不能为空".into());
    }
    if p.contains("..") || p.contains(':') {
        return Err("非法路径".into());
    }
    if !p.to_ascii_lowercase().ends_with(".js") {
        return Err("仅支持 .js 文件".into());
    }
    if p.contains('/') {
        return Err("第一期仅支持扁平文件名（如 main.js）".into());
    }
    Ok(p)
}

fn scripts_root(app: &AppHandle) -> PathBuf {
    let root = resolve_data_root(app).join("scripts");
    let _ = fs::create_dir_all(&root);
    root
}

pub fn package_dir(app: &AppHandle, code: &str) -> PathBuf {
    scripts_root(app).join(code)
}

fn file_mtime_ms(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or_else(now_ms)
}

fn load_files_from_disk(app: &AppHandle, package_id: &str, code: &str) -> Vec<ScriptFile> {
    let dir = package_dir(app, code);
    if !dir.is_dir() {
        return vec![];
    }
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(&dir) else {
        return files;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if !name.to_ascii_lowercase().ends_with(".js") {
            continue;
        }
        if name.contains("..") {
            continue;
        }
        let content = fs::read_to_string(&path).unwrap_or_default();
        let updated = file_mtime_ms(&path);
        files.push(ScriptFile {
            id: format!("{package_id}:{name}"),
            package_id: package_id.to_string(),
            path: name.to_string(),
            draft_content: content.clone(),
            published_content: content,
            updated_at: updated,
        });
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    files
}

fn write_js_file(app: &AppHandle, code: &str, path: &str, content: &str) -> Result<(), String> {
    let path = normalize_js_path(path)?;
    let dir = package_dir(app, code);
    fs::create_dir_all(&dir).map_err(|e| format!("创建脚本目录失败: {e}"))?;
    let full = dir.join(&path);
    fs::write(&full, content).map_err(|e| format!("写入 {path} 失败: {e}"))?;
    Ok(())
}

fn rename_js_file(app: &AppHandle, code: &str, from: &str, to: &str) -> Result<(), String> {
    let from = normalize_js_path(from)?;
    let to = normalize_js_path(to)?;
    if from == to {
        return Ok(());
    }
    let dir = package_dir(app, code);
    let src = dir.join(&from);
    let dst = dir.join(&to);
    if !src.is_file() {
        return Err(format!("文件「{from}」不存在"));
    }
    if dst.exists() {
        return Err(format!("目标「{to}」已存在"));
    }
    fs::rename(&src, &dst).map_err(|e| format!("重命名失败: {e}"))?;
    Ok(())
}

fn delete_js_file(app: &AppHandle, code: &str, path: &str) -> Result<(), String> {
    let path = normalize_js_path(path)?;
    let full = package_dir(app, code).join(&path);
    if full.is_file() {
        fs::remove_file(&full).map_err(|e| format!("删除失败: {e}"))?;
    }
    Ok(())
}

fn remove_package_dir(app: &AppHandle, code: &str) {
    let dir = package_dir(app, code);
    if dir.is_dir() {
        let _ = fs::remove_dir_all(&dir);
    }
}

fn map_pkg(
    r: sqlx::sqlite::SqliteRow,
    files: &[ScriptFile],
    dir_path: String,
) -> ScriptPackage {
    let enabled: i64 = r.get("enabled");
    let entry: String = r.get("entry_path");
    let has_entry = files
        .iter()
        .any(|f| f.path == entry && !f.draft_content.trim().is_empty());
    ScriptPackage {
        id: r.get("id"),
        code: r.get("code"),
        name: r.get("name"),
        enabled: enabled != 0,
        entry_path: entry,
        published_version: if has_entry { 1 } else { 0 },
        notes: r.get("notes"),
        updated_at: r.get("updated"),
        is_published: has_entry,
        has_unpublished_draft: false,
        file_count: files.len() as u32,
        dir_path,
    }
}

async fn load_pkg_row(app: &AppHandle, id: &str) -> Result<sqlx::sqlite::SqliteRow, String> {
    sqlx::query(
        "SELECT id, code, name, enabled, entry_path, published_version, notes, updated
         FROM script_pkg WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&pool(app))
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "脚本不存在".to_string())
}

async fn code_for_id(app: &AppHandle, id: &str) -> Result<String, String> {
    let row: Option<(String,)> = sqlx::query_as("SELECT code FROM script_pkg WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool(app))
        .await
        .map_err(|e| e.to_string())?;
    row.map(|r| r.0).ok_or_else(|| "脚本不存在".into())
}

fn enrich(app: &AppHandle, r: sqlx::sqlite::SqliteRow) -> ScriptPackage {
    let id: String = r.get("id");
    let code: String = r.get("code");
    let files = load_files_from_disk(app, &id, &code);
    let dir = package_dir(app, &code)
        .to_string_lossy()
        .to_string();
    map_pkg(r, &files, dir)
}

pub async fn list_packages_page_async(
    app: &AppHandle,
    query: Option<String>,
    page: u32,
    page_size: u32,
) -> ScriptPackagePage {
    let page = page.max(1);
    let page_size = page_size.clamp(1, 100);
    let p = pool(app);
    let q = query.unwrap_or_default().trim().to_string();
    let rows = if q.is_empty() {
        sqlx::query(
            "SELECT id, code, name, enabled, entry_path, published_version, notes, updated
             FROM script_pkg ORDER BY updated DESC",
        )
        .fetch_all(&p)
        .await
        .unwrap_or_default()
    } else {
        let like = format!("%{q}%");
        sqlx::query(
            "SELECT id, code, name, enabled, entry_path, published_version, notes, updated
             FROM script_pkg
             WHERE name LIKE ? OR code LIKE ? OR notes LIKE ?
             ORDER BY updated DESC",
        )
        .bind(&like)
        .bind(&like)
        .bind(&like)
        .fetch_all(&p)
        .await
        .unwrap_or_default()
    };
    let total = rows.len() as u64;
    let start = ((page - 1) as usize).saturating_mul(page_size as usize);
    let items: Vec<_> = rows
        .into_iter()
        .skip(start)
        .take(page_size as usize)
        .map(|r| enrich(app, r))
        .collect();
    ScriptPackagePage {
        items,
        total,
        page,
        page_size,
    }
}

pub fn list_packages_page(
    app: &AppHandle,
    query: Option<String>,
    page: u32,
    page_size: u32,
) -> ScriptPackagePage {
    block_on(list_packages_page_async(app, query, page, page_size))
}

pub async fn get_package_detail_async(
    app: &AppHandle,
    id: &str,
) -> Result<ScriptPackageDetail, String> {
    let row = load_pkg_row(app, id).await?;
    let code: String = row.get("code");
    let files = load_files_from_disk(app, id, &code);
    let package = enrich(app, row);
    Ok(ScriptPackageDetail { package, files })
}

pub fn get_package_detail(app: &AppHandle, id: &str) -> Result<ScriptPackageDetail, String> {
    block_on(get_package_detail_async(app, id))
}

pub async fn create_package_async(
    app: &AppHandle,
    code: String,
    name: String,
    notes: String,
) -> Result<ScriptPackageDetail, String> {
    let code = normalize_code(&code)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    let p = pool(app);
    let exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM script_pkg WHERE code = ?")
        .bind(&code)
        .fetch_optional(&p)
        .await
        .map_err(|e| e.to_string())?;
    if exists.is_some() {
        return Err(format!("编码「{code}」已被占用"));
    }
    let id = Uuid::new_v4().to_string();
    let ts = now_ms();
    let entry = "main.js";
    sqlx::query(
        "INSERT INTO script_pkg (id, code, name, enabled, entry_path, published_version, notes, updated)
         VALUES (?, ?, ?, 1, ?, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&code)
    .bind(&name)
    .bind(entry)
    .bind(notes.trim())
    .bind(ts)
    .execute(&p)
    .await
    .map_err(|e| e.to_string())?;

    let starter = "// 入口脚本（函数体）。return string | { title, text, url }\nreturn { title: document.title, text: '', url: location.href };\n";
    write_js_file(app, &code, entry, starter)?;

    get_package_detail_async(app, &id).await
}

pub fn create_package(
    app: &AppHandle,
    code: String,
    name: String,
    notes: String,
) -> Result<ScriptPackageDetail, String> {
    block_on(create_package_async(app, code, name, notes))
}

pub async fn update_package_meta_async(
    app: &AppHandle,
    id: String,
    name: String,
    code: String,
    enabled: bool,
    entry_path: String,
    notes: String,
) -> Result<ScriptPackageDetail, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    let new_code = normalize_code(&code)?;
    let entry_path = normalize_js_path(&entry_path)?;
    let old_code = code_for_id(app, &id).await?;
    let files = load_files_from_disk(app, &id, &old_code);
    if !files.iter().any(|f| f.path == entry_path) {
        return Err(format!("入口文件「{entry_path}」不存在，请先创建该文件"));
    }

    if new_code != old_code {
        let taken: Option<(i64,)> =
            sqlx::query_as("SELECT 1 FROM script_pkg WHERE code = ? AND id != ?")
                .bind(&new_code)
                .bind(&id)
                .fetch_optional(&pool(app))
                .await
                .map_err(|e| e.to_string())?;
        if taken.is_some() {
            return Err(format!("编码「{new_code}」已被占用"));
        }
        let old_dir = package_dir(app, &old_code);
        let new_dir = package_dir(app, &new_code);
        if new_dir.exists() {
            return Err(format!("目录 scripts/{new_code} 已存在"));
        }
        if old_dir.is_dir() {
            fs::rename(&old_dir, &new_dir).map_err(|e| format!("重命名脚本目录失败: {e}"))?;
        } else {
            fs::create_dir_all(&new_dir).map_err(|e| format!("创建脚本目录失败: {e}"))?;
        }
    }

    let ts = now_ms();
    let n = sqlx::query(
        "UPDATE script_pkg SET name = ?, code = ?, enabled = ?, entry_path = ?, notes = ?, updated = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&new_code)
    .bind(if enabled { 1i64 } else { 0i64 })
    .bind(&entry_path)
    .bind(notes.trim())
    .bind(ts)
    .bind(&id)
    .execute(&pool(app))
    .await
    .map_err(|e| e.to_string())?
    .rows_affected();
    if n == 0 {
        return Err("脚本不存在".into());
    }
    get_package_detail_async(app, &id).await
}

pub fn update_package_meta(
    app: &AppHandle,
    id: String,
    name: String,
    code: String,
    enabled: bool,
    entry_path: String,
    notes: String,
) -> Result<ScriptPackageDetail, String> {
    block_on(update_package_meta_async(
        app, id, name, code, enabled, entry_path, notes,
    ))
}

pub async fn upsert_file_async(
    app: &AppHandle,
    package_id: String,
    path: String,
    draft_content: String,
) -> Result<ScriptFile, String> {
    let code = code_for_id(app, &package_id).await?;
    let path = normalize_js_path(&path)?;
    write_js_file(app, &code, &path, &draft_content)?;
    let ts = now_ms();
    let _ = sqlx::query("UPDATE script_pkg SET updated = ? WHERE id = ?")
        .bind(ts)
        .bind(&package_id)
        .execute(&pool(app))
        .await;
    Ok(ScriptFile {
        id: format!("{package_id}:{path}"),
        package_id,
        path: path.clone(),
        draft_content: draft_content.clone(),
        published_content: draft_content,
        updated_at: ts,
    })
}

pub fn upsert_file(
    app: &AppHandle,
    package_id: String,
    path: String,
    draft_content: String,
) -> Result<ScriptFile, String> {
    block_on(upsert_file_async(app, package_id, path, draft_content))
}

pub async fn rename_file_async(
    app: &AppHandle,
    package_id: String,
    from_path: String,
    to_path: String,
) -> Result<ScriptPackageDetail, String> {
    let code = code_for_id(app, &package_id).await?;
    let from = normalize_js_path(&from_path)?;
    let to = normalize_js_path(&to_path)?;
    rename_js_file(app, &code, &from, &to)?;
    let row = load_pkg_row(app, &package_id).await?;
    let entry: String = row.get("entry_path");
    if entry == from {
        let ts = now_ms();
        let _ = sqlx::query("UPDATE script_pkg SET entry_path = ?, updated = ? WHERE id = ?")
            .bind(&to)
            .bind(ts)
            .bind(&package_id)
            .execute(&pool(app))
            .await;
    } else {
        let ts = now_ms();
        let _ = sqlx::query("UPDATE script_pkg SET updated = ? WHERE id = ?")
            .bind(ts)
            .bind(&package_id)
            .execute(&pool(app))
            .await;
    }
    get_package_detail_async(app, &package_id).await
}

pub fn rename_file(
    app: &AppHandle,
    package_id: String,
    from_path: String,
    to_path: String,
) -> Result<ScriptPackageDetail, String> {
    block_on(rename_file_async(app, package_id, from_path, to_path))
}

pub async fn delete_file_async(
    app: &AppHandle,
    package_id: String,
    path: String,
) -> Result<ScriptPackageDetail, String> {
    let code = code_for_id(app, &package_id).await?;
    let path = normalize_js_path(&path)?;
    let files = load_files_from_disk(app, &package_id, &code);
    if files.len() <= 1 {
        return Err("至少保留一个文件".into());
    }
    let row = load_pkg_row(app, &package_id).await?;
    let entry: String = row.get("entry_path");
    if entry == path {
        return Err("不能删除入口文件，请先更换入口".into());
    }
    delete_js_file(app, &code, &path)?;
    let ts = now_ms();
    let _ = sqlx::query("UPDATE script_pkg SET updated = ? WHERE id = ?")
        .bind(ts)
        .bind(&package_id)
        .execute(&pool(app))
        .await;
    get_package_detail_async(app, &package_id).await
}

pub fn delete_file(
    app: &AppHandle,
    package_id: String,
    path: String,
) -> Result<ScriptPackageDetail, String> {
    block_on(delete_file_async(app, package_id, path))
}

pub async fn remove_package_async(app: &AppHandle, id: String) -> Result<(), String> {
    let code = code_for_id(app, &id).await?;
    sqlx::query("DELETE FROM script_file WHERE package_id = ?")
        .bind(&id)
        .execute(&pool(app))
        .await
        .ok();
    let n = sqlx::query("DELETE FROM script_pkg WHERE id = ?")
        .bind(&id)
        .execute(&pool(app))
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();
    if n == 0 {
        return Err("脚本不存在".into());
    }
    remove_package_dir(app, &code);
    Ok(())
}

pub fn remove_package(app: &AppHandle, id: String) -> Result<(), String> {
    block_on(remove_package_async(app, id))
}

pub async fn set_enabled_async(
    app: &AppHandle,
    id: String,
    enabled: bool,
) -> Result<ScriptPackage, String> {
    let ts = now_ms();
    let n = sqlx::query("UPDATE script_pkg SET enabled = ?, updated = ? WHERE id = ?")
        .bind(if enabled { 1i64 } else { 0i64 })
        .bind(ts)
        .bind(&id)
        .execute(&pool(app))
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();
    if n == 0 {
        return Err("脚本不存在".into());
    }
    Ok(get_package_detail_async(app, &id).await?.package)
}

pub fn set_enabled(app: &AppHandle, id: String, enabled: bool) -> Result<ScriptPackage, String> {
    block_on(set_enabled_async(app, id, enabled))
}

/// 拼接目录内已发布内容：非入口在前，入口最后。
pub fn bundle_from_disk(app: &AppHandle, code: &str, entry_path: &str) -> Option<String> {
    let dir = package_dir(app, code);
    if !dir.is_dir() {
        return None;
    }
    let mut names: Vec<String> = fs::read_dir(&dir)
        .ok()?
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            if !p.is_file() {
                return None;
            }
            let name = p.file_name()?.to_str()?.to_string();
            if name.to_ascii_lowercase().ends_with(".js") {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    names.sort();
    let mut parts: Vec<String> = Vec::new();
    for name in &names {
        if name == entry_path {
            continue;
        }
        let c = fs::read_to_string(dir.join(name)).unwrap_or_default();
        if c.trim().is_empty() {
            continue;
        }
        parts.push(format!("// ---- {name}\n{c}"));
    }
    let entry_body = fs::read_to_string(dir.join(entry_path)).ok()?;
    if entry_body.trim().is_empty() {
        return None;
    }
    parts.push(entry_body);
    Some(parts.join("\n\n"))
}

pub async fn list_published_for_bridge_async(app: &AppHandle) -> Vec<ScriptPackage> {
    let page = list_packages_page_async(app, None, 1, 100).await;
    page.items
        .into_iter()
        .filter(|p| p.enabled && p.is_published)
        .collect()
}

pub fn list_published_for_bridge(app: &AppHandle) -> Vec<ScriptPackage> {
    block_on(list_published_for_bridge_async(app))
}

pub async fn bridge_get_package_script_async(
    app: &AppHandle,
    code_or_id: &str,
) -> Result<BridgeScript, String> {
    let key = code_or_id.trim();
    let row = sqlx::query(
        "SELECT id, code, name, enabled, entry_path, published_version, notes, updated
         FROM script_pkg WHERE id = ? OR code = ?",
    )
    .bind(key)
    .bind(key.to_uppercase())
    .fetch_optional(&pool(app))
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "脚本不存在".to_string())?;

    let id: String = row.get("id");
    let code: String = row.get("code");
    let enabled: i64 = row.get("enabled");
    let entry: String = row.get("entry_path");
    if enabled == 0 {
        return Err("脚本未启用".into());
    }
    let script = bundle_from_disk(app, &code, &entry)
        .ok_or_else(|| "脚本目录为空或入口文件不存在".to_string())?;
    Ok(BridgeScript {
        platform_id: id,
        code,
        kind: "script".into(),
        script,
        version: 1,
        match_url: String::new(),
    })
}

pub fn bridge_get_package_script(app: &AppHandle, code_or_id: &str) -> Result<BridgeScript, String> {
    block_on(bridge_get_package_script_async(app, code_or_id))
}

/// 用本机 VS Code / Cursor 打开脚本目录。
pub async fn open_in_editor_async(app: &AppHandle, id: String) -> Result<String, String> {
    let code = code_for_id(app, &id).await?;
    let dir = package_dir(app, &code);
    fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {e}"))?;
    let path = dir.to_string_lossy().to_string();

    // 优先 code / cursor CLI，再 macOS open -a
    let candidates: &[(&str, &[&str])] = &[
        ("code", &[]),
        ("cursor", &[]),
        ("open", &["-a", "Visual Studio Code"]),
        ("open", &["-a", "Cursor"]),
    ];
    for (bin, prefix) in candidates {
        let mut cmd = Command::new(bin);
        for a in *prefix {
            cmd.arg(a);
        }
        cmd.arg(&path);
        match cmd.spawn() {
            Ok(_) => return Ok(path),
            Err(_) => continue,
        }
    }
    Err(format!(
        "未能打开编辑器。请确认已安装 VS Code/Cursor 且 `code` 或 `cursor` 在 PATH 中。目录：{path}"
    ))
}

pub fn open_in_editor(app: &AppHandle, id: String) -> Result<String, String> {
    block_on(open_in_editor_async(app, id))
}

/// 将旧 script_file 表内容导出到磁盘（仅目录尚不存在时）。
pub async fn migrate_db_files_to_disk_async(app: &AppHandle) {
    let rows = sqlx::query(
        "SELECT id, code, name, enabled, entry_path, published_version, notes, updated
         FROM script_pkg",
    )
    .fetch_all(&pool(app))
    .await
    .unwrap_or_default();

    for r in rows {
        let id: String = r.get("id");
        let code: String = r.get("code");
        let dir = package_dir(app, &code);
        if dir.is_dir() {
            if fs::read_dir(&dir)
                .map(|mut d| d.any(|e| e.is_ok()))
                .unwrap_or(false)
            {
                continue;
            }
        }
        let files = sqlx::query(
            "SELECT path, draft_content, published_content FROM script_file WHERE package_id = ?",
        )
        .bind(&id)
        .fetch_all(&pool(app))
        .await
        .unwrap_or_default();
        if files.is_empty() {
            continue;
        }
        let _ = fs::create_dir_all(&dir);
        for f in files {
            let path: String = f.get("path");
            let draft: String = f.get("draft_content");
            let published: String = f.get("published_content");
            let body = if !draft.trim().is_empty() {
                draft
            } else {
                published
            };
            if let Ok(norm) = normalize_js_path(&path) {
                let _ = fs::write(dir.join(norm), body);
            }
        }
        log::info!(
            target: "chatcms_lib::medias",
            "exported script_file → {}",
            dir.display()
        );
    }
}

/// 旧平台 → 脚本包（写磁盘 + 元数据）。
pub async fn migrate_from_platforms_async(app: &AppHandle) {
    let platforms = media_repo::load_platforms_async(app).await;
    if platforms.is_empty() {
        return;
    }
    let collects = media_repo::load_collect_scripts_async(app).await;
    let publishes = media_repo::load_publish_scripts_async(app).await;
    let p = pool(app);
    let ts = now_ms();

    for plat in platforms {
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT 1 FROM script_pkg WHERE id = ? OR code = ?")
                .bind(&plat.id)
                .bind(&plat.code)
                .fetch_optional(&p)
                .await
                .unwrap_or(None);
        if exists.is_some() {
            continue;
        }
        let col = collects.iter().find(|s| s.platform_id == plat.id);
        let pub_s = publishes.iter().find(|s| s.platform_id == plat.id);
        let has_col = col
            .map(|s| !s.published_script.trim().is_empty() || !s.draft_script.trim().is_empty())
            .unwrap_or(false);
        let has_pub = pub_s
            .map(|s| !s.published_script.trim().is_empty() || !s.draft_script.trim().is_empty())
            .unwrap_or(false);
        if !has_col && !has_pub {
            continue;
        }
        let Ok(code) = normalize_code(&plat.code) else {
            continue;
        };
        let entry = if has_col { "collect.js" } else { "main.js" };
        if sqlx::query(
            "INSERT INTO script_pkg (id, code, name, enabled, entry_path, published_version, notes, updated)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        )
        .bind(&plat.id)
        .bind(&code)
        .bind(&plat.name)
        .bind(if plat.enabled { 1i64 } else { 0i64 })
        .bind(entry)
        .bind(&plat.notes)
        .bind(ts)
        .execute(&p)
        .await
        .is_err()
        {
            continue;
        }
        if let Some(s) = col {
            let body = if s.draft_script.trim().is_empty() {
                &s.published_script
            } else {
                &s.draft_script
            };
            let _ = write_js_file(app, &code, "collect.js", body);
        }
        if let Some(s) = pub_s {
            let body = if s.draft_script.trim().is_empty() {
                &s.published_script
            } else {
                &s.draft_script
            };
            let path = if has_col { "fill.js" } else { "main.js" };
            let _ = write_js_file(app, &code, path, body);
        }
        log::info!(
            target: "chatcms_lib::medias",
            "migrated platform {} → scripts/{}",
            plat.code,
            code
        );
    }
}

/// 种子：BOSS 打招呼（目录无内容时写入）。
pub async fn ensure_boss_package_async(app: &AppHandle) {
    const CODE: &str = "JOB_BOSS_GREET";
    const NAME: &str = "BOSS直聘·打招呼";
    const COLLECT: &str = include_str!("../../../scripts/media/boss-greet-collect.js");
    let p = pool(app);
    let row = sqlx::query("SELECT id FROM script_pkg WHERE code = ?")
        .bind(CODE)
        .fetch_optional(&p)
        .await
        .ok()
        .flatten();
    let id = if let Some(r) = row {
        let id: String = r.get("id");
        id
    } else {
        let id = Uuid::new_v4().to_string();
        let ts = now_ms();
        if sqlx::query(
            "INSERT INTO script_pkg (id, code, name, enabled, entry_path, published_version, notes, updated)
             VALUES (?, ?, ?, 1, 'main.js', 1, ?, ?)",
        )
        .bind(&id)
        .bind(CODE)
        .bind(NAME)
        .bind("采集 BOSS 沟通/JD 上下文")
        .bind(ts)
        .execute(&p)
        .await
        .is_err()
        {
            return;
        }
        id
    };
    let dir = package_dir(app, CODE);
    let main = dir.join("main.js");
    if !main.is_file() {
        let _ = write_js_file(app, CODE, "main.js", COLLECT);
        let _ = sqlx::query("UPDATE script_pkg SET entry_path = 'main.js', updated = ? WHERE id = ?")
            .bind(now_ms())
            .bind(&id)
            .execute(&p)
            .await;
    }
}
