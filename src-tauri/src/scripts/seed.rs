use tauri::{AppHandle, Manager};

use super::store::parse_skill_md;
use super::types::{Skill, SkillSource};

/// 内置技能的 .md 内容，编译期嵌入。
const BUNDLED: &[(&str, &str)] = &[
    ("content-publish", include_str!("../../../scripts/skills/content-publish.md")),
    ("image-brief", include_str!("../../../scripts/skills/image-brief.md")),
    ("skill-creator", include_str!("../../../scripts/skills/skill-creator.md")),
];

/// 首次启动时写出内置 .md 文件并入库；已存在则跳过。
pub async fn ensure_seeded(app: &AppHandle) -> Vec<Skill> {
    let existing = crate::persist::load_all_skills(app).await;
    let existing_names: std::collections::HashSet<_> = existing.iter().map(|s| s.name.clone()).collect();

    for (name, content) in BUNDLED {
        if existing_names.contains(*name) {
            continue;
        }

        // 写出到 skills/bundled/{name}.md
        let dir = app.path().app_data_dir().unwrap_or_default()
            .join("skills").join("bundled");
        let _ = std::fs::create_dir_all(&dir);
        let file_path = dir.join(format!("{name}.md"));
        let _ = std::fs::write(&file_path, content);

        if let Some(mut skill) = parse_skill_md(content, &file_path.to_string_lossy(), "") {
            skill.source = SkillSource::Bundled;
            let meta = skill.metadata.get_or_insert_with(|| serde_json::json!({}));
            if let Some(obj) = meta.as_object_mut() {
                obj.insert("file_path".into(), serde_json::Value::String(
                    file_path.to_string_lossy().to_string()
                ));
            }
            crate::persist::save_skill(app, &skill).await;
        }
    }

    crate::persist::load_all_skills(app).await
}
