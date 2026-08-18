PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT    PRIMARY KEY,                  -- 会话唯一标识（UUID）
    title         TEXT    NOT NULL DEFAULT 'New Chat',  -- 会话标题
    pinned        INTEGER NOT NULL DEFAULT 0,           -- 是否置顶（0=否 1=是）
    agent_id      TEXT,                                 -- 绑定的代理 ID（可为空）
    workspace_dir TEXT,                                 -- 创建时锁定的 Agent workspace 路径
    yn            INTEGER NOT NULL DEFAULT 0,           -- 软删除标志（0=正常 1=已删除）
    create_by     TEXT    NOT NULL DEFAULT '',          -- 创建人
    update_by     TEXT    NOT NULL DEFAULT '',          -- 修改人
    created       INTEGER NOT NULL,                     -- 创建时间（Unix 毫秒）
    updated       INTEGER NOT NULL                      -- 最近修改时间（Unix 毫秒）
);
-- 为已有数据库补列（幂等）
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workspace_dir TEXT;

-- Messages (belongs to session)
CREATE TABLE IF NOT EXISTS messages (
    id         TEXT    PRIMARY KEY,                  -- 消息唯一标识（UUID）
    session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, -- 所属会话 ID
    role       TEXT    NOT NULL,                     -- 角色（user / assistant / system）
    content    TEXT    NOT NULL,                     -- 消息内容
    yn         INTEGER NOT NULL DEFAULT 0,           -- 软删除标志（0=正常 1=已删除）
    create_by  TEXT    NOT NULL DEFAULT '',          -- 创建人
    update_by  TEXT    NOT NULL DEFAULT '',          -- 修改人
    created    INTEGER NOT NULL,                     -- 创建时间（Unix 毫秒）
    updated    INTEGER NOT NULL DEFAULT 0            -- 最近修改时间（Unix 毫秒）
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created);

-- Knowledge base entries
CREATE TABLE IF NOT EXISTS knowledge (
    id          TEXT    PRIMARY KEY,                 -- 知识条目唯一标识（UUID）
    title       TEXT    NOT NULL,                    -- 标题
    description TEXT    NOT NULL DEFAULT '',         -- 简介
    content     TEXT    NOT NULL DEFAULT '',         -- 正文内容（Markdown）
    tags        TEXT    NOT NULL DEFAULT '[]',       -- 标签列表（JSON 数组）
    visibility  TEXT    NOT NULL DEFAULT 'private',  -- 可见性（private / public）
    kind        TEXT    NOT NULL DEFAULT 'note',     -- 类型（note / doc / snippet 等）
    slug        TEXT    NOT NULL DEFAULT '',         -- URL 友好短标识
    yn          INTEGER NOT NULL DEFAULT 0,          -- 软删除标志（0=正常 1=已删除）
    create_by   TEXT    NOT NULL DEFAULT '',         -- 创建人
    update_by   TEXT    NOT NULL DEFAULT '',         -- 修改人
    created     INTEGER NOT NULL,                    -- 创建时间（Unix 毫秒）
    updated     INTEGER NOT NULL                     -- 最近修改时间（Unix 毫秒）
);

-- Knowledge site profile (singleton row id=1)
CREATE TABLE IF NOT EXISTS knowledge_site_profile (
    id           INTEGER PRIMARY KEY DEFAULT 1,      -- 固定主键（单例行，始终为 1）
    handle       TEXT    NOT NULL DEFAULT 'me',      -- 站点 handle / 用户名
    display_name TEXT    NOT NULL DEFAULT 'ChatCMS User', -- 展示名称
    bio          TEXT    NOT NULL DEFAULT '',         -- 个人简介
    yn           INTEGER NOT NULL DEFAULT 0,          -- 软删除标志（0=正常 1=已删除）
    create_by    TEXT    NOT NULL DEFAULT '',         -- 创建人
    update_by    TEXT    NOT NULL DEFAULT '',         -- 修改人
    created      INTEGER NOT NULL DEFAULT 0,          -- 创建时间（Unix 毫秒）
    updated      INTEGER NOT NULL DEFAULT 0           -- 最近修改时间（Unix 毫秒）
);

INSERT OR IGNORE INTO knowledge_site_profile (id) VALUES (1);

-- Tool permission audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT    PRIMARY KEY,               -- 审计记录唯一标识（UUID）
    ts            INTEGER NOT NULL,                  -- 事件时间戳（Unix 毫秒）
    session_id    TEXT    NOT NULL,                  -- 所属会话 ID
    agent_id      TEXT,                              -- 所属代理 ID（可为空）
    domain        TEXT    NOT NULL,                  -- 权限域（如 fs / net / shell）
    tool_name     TEXT    NOT NULL,                  -- 工具名称
    input_summary TEXT    NOT NULL DEFAULT '',       -- 输入摘要（脱敏后）
    decision      TEXT    NOT NULL,                  -- 裁决结果（allow / ask / deny）
    run_mode      TEXT    NOT NULL,                  -- 运行模式 ID
    mode_name     TEXT    NOT NULL DEFAULT '',       -- 运行模式名称（冗余存储，便于展示）
    grant_used    INTEGER NOT NULL DEFAULT 0,        -- 是否命中已有授权（0=否 1=是）
    remark        TEXT    NOT NULL DEFAULT '',       -- 备注
    yn            INTEGER NOT NULL DEFAULT 0,        -- 软删除标志（0=正常 1=已删除）
    create_by     TEXT    NOT NULL DEFAULT '',       -- 创建人
    update_by     TEXT    NOT NULL DEFAULT '',       -- 修改人
    created       INTEGER NOT NULL DEFAULT 0,        -- 创建时间（Unix 毫秒）
    updated       INTEGER NOT NULL DEFAULT 0         -- 最近修改时间（Unix 毫秒）
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);

-- Skill packages
CREATE TABLE IF NOT EXISTS skill_pkg (
    id                       TEXT    PRIMARY KEY,    -- 技能包唯一标识（UUID）
    name                     TEXT    NOT NULL UNIQUE, -- 技能名称（唯一）
    description              TEXT    NOT NULL DEFAULT '', -- 技能描述
    emoji                    TEXT    NOT NULL DEFAULT '', -- 图标 emoji
    body                     TEXT    NOT NULL DEFAULT '', -- 技能提示词正文（Markdown）
    file_path                TEXT    NOT NULL DEFAULT '', -- 对应的本地文件路径
    source                   TEXT    NOT NULL DEFAULT 'manual', -- 来源（manual / npx / file）
    pkg_name                 TEXT,                   -- npm 包名（npx 安装时有值）
    homepage                 TEXT,                   -- 技能主页 URL
    enabled                  INTEGER NOT NULL DEFAULT 1, -- 是否启用（0=禁用 1=启用）
    user_invocable           INTEGER NOT NULL DEFAULT 1, -- 用户是否可主动调用（0=否 1=是）
    disable_model_invocation INTEGER NOT NULL DEFAULT 0, -- 禁止模型自动调用（0=允许 1=禁止）
    yn                       INTEGER NOT NULL DEFAULT 0, -- 软删除标志（0=正常 1=已删除）
    create_by                TEXT    NOT NULL DEFAULT '', -- 创建人
    update_by                TEXT    NOT NULL DEFAULT '', -- 修改人
    created                  INTEGER NOT NULL,        -- 创建时间（Unix 毫秒）
    updated                  INTEGER NOT NULL         -- 最近修改时间（Unix 毫秒）
);
-- 为已有数据库补列（幂等）
ALTER TABLE skill_pkg ADD COLUMN IF NOT EXISTS user_invocable           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE skill_pkg ADD COLUMN IF NOT EXISTS disable_model_invocation INTEGER NOT NULL DEFAULT 0;

-- Images metadata
CREATE TABLE IF NOT EXISTS images (
    id         TEXT    PRIMARY KEY,                  -- 图片唯一标识（UUID）
    prompt     TEXT    NOT NULL DEFAULT '',          -- 生成提示词
    model      TEXT    NOT NULL DEFAULT '',          -- 使用的模型（如 dall-e-3）
    size       TEXT    NOT NULL DEFAULT '',          -- 图片尺寸（如 1024x1024）
    path       TEXT    NOT NULL DEFAULT '',          -- 本地文件绝对路径
    remark     TEXT    NOT NULL DEFAULT '',          -- 备注
    yn         INTEGER NOT NULL DEFAULT 0,           -- 软删除标志（0=正常 1=已删除）
    create_by  TEXT    NOT NULL DEFAULT '',          -- 创建人
    update_by  TEXT    NOT NULL DEFAULT '',          -- 修改人
    created    INTEGER NOT NULL,                     -- 创建时间（Unix 毫秒）
    updated    INTEGER NOT NULL                      -- 最近修改时间（Unix 毫秒）
);

CREATE INDEX IF NOT EXISTS idx_images_created ON images(created DESC);

-- Videos metadata
CREATE TABLE IF NOT EXISTS videos (
    id         TEXT    PRIMARY KEY,                  -- 视频唯一标识（UUID）
    prompt     TEXT    NOT NULL DEFAULT '',          -- 生成提示词 / 标题
    model      TEXT    NOT NULL DEFAULT '',          -- 使用的模型（如 sora-2 / local_upload）
    size       TEXT    NOT NULL DEFAULT '',          -- 视频尺寸（如 1280x720 / imported）
    seconds    TEXT    NOT NULL DEFAULT '',          -- 时长（秒，如 4 / 8 / 12）
    path       TEXT    NOT NULL DEFAULT '',          -- 本地文件绝对路径
    remote_id  TEXT,                                 -- 远端任务 ID（异步生成时有值）
    remark     TEXT    NOT NULL DEFAULT '',          -- 备注
    yn         INTEGER NOT NULL DEFAULT 0,           -- 软删除标志（0=正常 1=已删除）
    create_by  TEXT    NOT NULL DEFAULT '',          -- 创建人
    update_by  TEXT    NOT NULL DEFAULT '',          -- 修改人
    created    INTEGER NOT NULL,                     -- 创建时间（Unix 毫秒）
    updated    INTEGER NOT NULL                      -- 最近修改时间（Unix 毫秒）
);

CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created DESC);

-- Agent profiles
CREATE TABLE IF NOT EXISTS agent (
    id            TEXT    PRIMARY KEY,               -- 代理唯一标识（UUID）
    slug          TEXT    NOT NULL,                  -- 短标识（spawn_agent 引用用，仅小写字母/数字/连字符/下划线）
    name          TEXT    NOT NULL,                  -- 代理显示名称
    remark        TEXT    NOT NULL DEFAULT '',       -- 代理简介 / 备注
    system_prompt TEXT    NOT NULL DEFAULT '',       -- 人格 / 角色系统提示词
    enabled       INTEGER NOT NULL DEFAULT 1,        -- 是否启用（0=禁用 1=启用）
    skills        TEXT,                              -- 技能白名单（JSON 数组；null=不限制 '[]'=无技能）
    spawnable     INTEGER NOT NULL DEFAULT 1,        -- 是否允许被 spawn_agent 调用（0=否 1=是）
    perms         TEXT    NOT NULL DEFAULT '{}',     -- 域权限覆盖（JSON 对象，domain→policy）
    workspace_dir TEXT,                              -- 代理独立工作目录绝对路径（新增时自动创建）
    sort          INTEGER NOT NULL DEFAULT 0,        -- 排序权重（越小越靠前）
    create_by     TEXT    NOT NULL DEFAULT '',       -- 创建人
    update_by     TEXT    NOT NULL DEFAULT '',       -- 修改人
    created       INTEGER NOT NULL,                  -- 创建时间（Unix 毫秒）
    updated       INTEGER NOT NULL,                  -- 最近修改时间（Unix 毫秒）
    yn            INTEGER NOT NULL DEFAULT 0         -- 软删除标志（0=正常 1=已删除）
);
-- 为已有数据库补列（幂等）
ALTER TABLE agent ADD COLUMN IF NOT EXISTS spawnable     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS perms         TEXT    NOT NULL DEFAULT '{}';
ALTER TABLE agent ADD COLUMN IF NOT EXISTS workspace_dir TEXT;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS sort          INTEGER NOT NULL DEFAULT 0;

-- Model profiles (replaces chatcms.json provider profiles)
CREATE TABLE IF NOT EXISTS model_profile (
    id             TEXT    PRIMARY KEY,                       -- 唯一标识（UUID）
    name           TEXT    NOT NULL,                          -- 显示名称
    kind           TEXT    NOT NULL,                          -- 'anthropic' | 'openai'
    api_key        TEXT    NOT NULL DEFAULT '',               -- API 密钥
    model          TEXT    NOT NULL,                          -- 模型 ID（如 claude-sonnet-4-6）
    base_url       TEXT,                                      -- 自定义接口地址（Ollama 等）
    tier           TEXT    NOT NULL DEFAULT 'cloud',          -- 'local' | 'cloud'
    weight         INTEGER NOT NULL DEFAULT 2,                -- 路由权重 1~4（越大越优先）
    context_window INTEGER NOT NULL DEFAULT 8192,             -- 最大 context token 数
    enabled        INTEGER NOT NULL DEFAULT 1,                -- 是否启用（0=禁用 1=启用）
    created        INTEGER NOT NULL,                          -- 创建时间（Unix 毫秒）
    updated        INTEGER NOT NULL                           -- 最近修改时间（Unix 毫秒）
);

CREATE INDEX IF NOT EXISTS idx_model_profile_tier_weight ON model_profile(tier, weight DESC);

-- 为 sessions 表补 profile_id 列（幂等）
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_id TEXT;
