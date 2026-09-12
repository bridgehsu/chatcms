use tauri::AppHandle;
use uuid::Uuid;

use super::{CrawlerTask, now_ms};
use super::repository as repo;

pub fn list(app: &AppHandle) -> Vec<CrawlerTask> {
    let mut list = repo::load_all(app);
    list.sort_by(|a, b| b.updated.cmp(&a.updated));
    list
}

pub fn get(app: &AppHandle, id: &str) -> Result<CrawlerTask, String> {
    repo::load_all(app)
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| "采集任务不存在".into())
}

pub fn add(app: &AppHandle, mut task: CrawlerTask) -> Result<CrawlerTask, String> {
    let name = task.name.trim().to_string();
    if name.is_empty() {
        return Err("任务名称不能为空".into());
    }
    task.name = name;
    task.description = task.description.trim().to_string();

    let mut list = repo::load_all(app);
    if list.iter().any(|t| t.name == task.name) {
        return Err(format!("已存在同名任务「{}」", task.name));
    }

    let ts = now_ms();
    if task.id.trim().is_empty() {
        task.id = Uuid::new_v4().to_string();
    }
    if task.created == 0 {
        task.created = ts;
    }
    task.updated = ts;
    list.push(task.clone());
    repo::save_all(app, &list);
    Ok(task)
}

pub fn update(app: &AppHandle, mut task: CrawlerTask) -> Result<CrawlerTask, String> {
    let name = task.name.trim().to_string();
    if name.is_empty() {
        return Err("任务名称不能为空".into());
    }
    if task.id.trim().is_empty() {
        return Err("任务 id 不能为空".into());
    }
    task.name = name;
    task.description = task.description.trim().to_string();

    let mut list = repo::load_all(app);
    if list.iter().any(|t| t.name == task.name && t.id != task.id) {
        return Err(format!("已存在同名任务「{}」", task.name));
    }
    let idx = list
        .iter()
        .position(|t| t.id == task.id)
        .ok_or_else(|| "采集任务不存在".to_string())?;
    task.created = list[idx].created;
    task.updated = now_ms();
    list[idx] = task.clone();
    repo::save_all(app, &list);
    Ok(task)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = repo::load_all(app);
    let before = list.len();
    list.retain(|t| t.id != id);
    if list.len() == before {
        return Err("采集任务不存在".into());
    }
    repo::save_all(app, &list);
    Ok(())
}
