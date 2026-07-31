pub mod commands;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapLink {
    pub id: String,
    pub title: String,
    pub desc: String,
    pub mark: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub tone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapSection {
    pub id: String,
    pub title: String,
    pub icon: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub collapsed: bool,
    pub links: Vec<MapLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapMetric {
    pub id: String,
    pub label: String,
    pub value: String,
    pub change: String,
    pub trend: String, // "up" | "down" | "flat"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BusinessMapState {
    #[serde(default)]
    pub favorites: Vec<MapLink>,
    #[serde(default)]
    pub sections: Vec<MapSection>,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub metrics: Vec<MapMetric>,
}

pub fn get(app: &AppHandle) -> BusinessMapState {
    crate::persist::load_business_map(app)
}

pub fn save(app: &AppHandle, state: BusinessMapState) {
    crate::persist::save_business_map(app, &state);
}
