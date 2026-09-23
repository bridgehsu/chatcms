//! 启用规则的内存缓存：热路径同步读取，CRUD / 启动时刷新。

use std::sync::Mutex;

use super::rules::Rule;

static CACHE: Mutex<Option<Vec<Rule>>> = Mutex::new(None);

/// 返回用于打分的规则（仅 enabled）；缓存为空时回退内置默认。
pub fn enabled_rules() -> Vec<Rule> {
    let guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let source = match guard.as_ref() {
        Some(rules) => rules.clone(),
        None => super::rules::defaults(),
    };
    source.into_iter().filter(|r| r.enabled).collect()
}

/// 用完整规则列表刷新缓存（含禁用项，便于下次过滤）。
pub fn refresh(rules: Vec<Rule>) {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(rules);
}

/// 清空缓存（下次打分走内置默认，直至再次 refresh）。
pub fn invalidate() {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    *guard = None;
}
