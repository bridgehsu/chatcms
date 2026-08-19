//! 大模型路由：按 tier + weight + tags 选择 ProviderProfile，支持冷却与轮询。

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::ProviderProfile;

// ── 运行时状态 ────────────────────────────────────────────────────────────────

struct ProfileState {
    fail_count: u32,
    cooldown_until: Option<Instant>,
}

impl ProfileState {
    fn new() -> Self { Self { fail_count: 0, cooldown_until: None } }

    fn is_cooling(&self) -> bool {
        self.cooldown_until.map_or(false, |t| Instant::now() < t)
    }

    fn mark_failed(&mut self) {
        self.fail_count += 1;
        let secs = if self.fail_count >= 3 { 300 } else { 60 };
        self.cooldown_until = Some(Instant::now() + Duration::from_secs(secs));
    }

    fn mark_success(&mut self) {
        self.fail_count = 0;
        self.cooldown_until = None;
    }
}

// ── Round-Robin ───────────────────────────────────────────────────────────────

struct RoundRobin {
    cursors: HashMap<(String, i64), usize>,
}

impl RoundRobin {
    fn new() -> Self { Self { cursors: HashMap::new() } }

    fn next(&mut self, tier: &str, weight: i64, len: usize) -> usize {
        if len == 0 { return 0; }
        let key = (tier.to_string(), weight);
        let cursor = self.cursors.entry(key).or_insert(0);
        let idx = *cursor % len;
        *cursor = (*cursor + 1) % len;
        idx
    }
}

// ── 路由器 ────────────────────────────────────────────────────────────────────

pub struct ModelRouter {
    states: Mutex<HashMap<String, ProfileState>>,
    rr:     Mutex<RoundRobin>,
}

impl ModelRouter {
    pub fn new() -> Self {
        Self {
            states: Mutex::new(HashMap::new()),
            rr:     Mutex::new(RoundRobin::new()),
        }
    }

    /// 选择合适的 ProviderProfile。
    ///
    /// - `has_tools`：本次调用是否携带工具（true → 强制 cloud tier）
    /// - `context_tokens`：当前 context 已用 token 数
    /// - `preferred_tags`：偏好标签（空 = 不过滤；同权重下优先选标签匹配最多的 profile）
    pub fn pick(
        &self,
        profiles: &[ProviderProfile],
        has_tools: bool,
        context_tokens: usize,
        preferred_tags: &[String],
    ) -> Option<String> {
        let preferred_tier = if has_tools { "cloud" } else { "local" };

        let buf_tokens = (context_tokens as f64 * 1.3) as usize;
        let mut states = self.states.lock().unwrap();

        let candidates: Vec<&ProviderProfile> = profiles
            .iter()
            .filter(|p| {
                p.enabled
                    && p.context_window as usize >= buf_tokens
                    && !states
                        .entry(p.id.clone())
                        .or_insert_with(ProfileState::new)
                        .is_cooling()
            })
            .collect();

        drop(states); // 释放锁，避免死锁

        self.pick_from_tier(&candidates, preferred_tier, preferred_tags)
            .or_else(|| {
                let fallback = if preferred_tier == "cloud" { "local" } else { "cloud" };
                self.pick_from_tier(&candidates, fallback, preferred_tags)
            })
    }

    fn pick_from_tier(
        &self,
        candidates: &[&ProviderProfile],
        tier: &str,
        preferred_tags: &[String],
    ) -> Option<String> {
        let tier_profiles: Vec<&ProviderProfile> = candidates
            .iter()
            .copied()
            .filter(|p| p.tier == tier)
            .collect();

        if tier_profiles.is_empty() { return None; }

        // 最高权重
        let max_weight = tier_profiles.iter().map(|p| p.weight).max()?;
        let mut top: Vec<&ProviderProfile> = tier_profiles
            .into_iter()
            .filter(|p| p.weight == max_weight)
            .collect();

        // Tag 偏好：同权重内优先选标签命中数最多的
        if !preferred_tags.is_empty() {
            let tag_score = |p: &&ProviderProfile| -> usize {
                p.tags.iter().filter(|t| preferred_tags.contains(t)).count()
            };
            let max_score = top.iter().map(tag_score).max().unwrap_or(0);
            if max_score > 0 {
                top.retain(|p| tag_score(p) == max_score);
            }
        }

        // Round-Robin
        let idx = self.rr.lock().unwrap().next(tier, max_weight, top.len());
        Some(top[idx].id.clone())
    }

    pub fn mark_failed(&self, profile_id: &str) {
        let mut states = self.states.lock().unwrap();
        states.entry(profile_id.to_string()).or_insert_with(ProfileState::new).mark_failed();
    }

    pub fn mark_success(&self, profile_id: &str) {
        let mut states = self.states.lock().unwrap();
        states.entry(profile_id.to_string()).or_insert_with(ProfileState::new).mark_success();
    }
}
