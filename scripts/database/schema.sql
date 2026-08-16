PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL DEFAULT 'New Chat',
    pinned     INTEGER NOT NULL DEFAULT 0,
    agent_id   TEXT,
    yn         INTEGER NOT NULL DEFAULT 0,
    create_by  TEXT    NOT NULL DEFAULT '',
    update_by  TEXT    NOT NULL DEFAULT '',
    created    INTEGER NOT NULL,
    updated    INTEGER NOT NULL
);

-- Messages (belongs to session)
CREATE TABLE IF NOT EXISTS messages (
    id         TEXT    PRIMARY KEY,
    session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    yn         INTEGER NOT NULL DEFAULT 0,
    create_by  TEXT    NOT NULL DEFAULT '',
    update_by  TEXT    NOT NULL DEFAULT '',
    created    INTEGER NOT NULL,
    updated    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created);

-- Knowledge base entries
CREATE TABLE IF NOT EXISTS knowledge (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    content     TEXT    NOT NULL DEFAULT '',
    tags        TEXT    NOT NULL DEFAULT '[]',
    visibility  TEXT    NOT NULL DEFAULT 'private',
    kind        TEXT    NOT NULL DEFAULT 'note',
    slug        TEXT    NOT NULL DEFAULT '',
    yn          INTEGER NOT NULL DEFAULT 0,
    create_by   TEXT    NOT NULL DEFAULT '',
    update_by   TEXT    NOT NULL DEFAULT '',
    created     INTEGER NOT NULL,
    updated     INTEGER NOT NULL
);

-- Knowledge site profile (singleton row id=1)
CREATE TABLE IF NOT EXISTS knowledge_site_profile (
    id           INTEGER PRIMARY KEY DEFAULT 1,
    handle       TEXT    NOT NULL DEFAULT 'me',
    display_name TEXT    NOT NULL DEFAULT 'ChatCMS User',
    bio          TEXT    NOT NULL DEFAULT '',
    yn           INTEGER NOT NULL DEFAULT 0,
    create_by    TEXT    NOT NULL DEFAULT '',
    update_by    TEXT    NOT NULL DEFAULT '',
    created      INTEGER NOT NULL DEFAULT 0,
    updated      INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO knowledge_site_profile (id) VALUES (1);

-- Tool permission audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT    PRIMARY KEY,
    ts            INTEGER NOT NULL,
    session_id    TEXT    NOT NULL,
    agent_id      TEXT,
    domain        TEXT    NOT NULL,
    tool_name     TEXT    NOT NULL,
    input_summary TEXT    NOT NULL DEFAULT '',
    decision      TEXT    NOT NULL,
    run_mode      TEXT    NOT NULL,
    mode_name     TEXT    NOT NULL DEFAULT '',
    grant_used    INTEGER NOT NULL DEFAULT 0,
    remark        TEXT    NOT NULL DEFAULT '',
    yn            INTEGER NOT NULL DEFAULT 0,
    create_by     TEXT    NOT NULL DEFAULT '',
    update_by     TEXT    NOT NULL DEFAULT '',
    created       INTEGER NOT NULL DEFAULT 0,
    updated       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);

-- Skill packages
CREATE TABLE IF NOT EXISTS skill_pkg (
    id                       TEXT    PRIMARY KEY,
    name                     TEXT    NOT NULL UNIQUE,
    description              TEXT    NOT NULL DEFAULT '',
    emoji                    TEXT    NOT NULL DEFAULT '',
    body                     TEXT    NOT NULL DEFAULT '',
    file_path                TEXT    NOT NULL DEFAULT '',
    source                   TEXT    NOT NULL DEFAULT 'manual',
    pkg_name                 TEXT,
    homepage                 TEXT,
    enabled                  INTEGER NOT NULL DEFAULT 1,
    user_invocable           INTEGER NOT NULL DEFAULT 1,
    disable_model_invocation INTEGER NOT NULL DEFAULT 0,
    yn                       INTEGER NOT NULL DEFAULT 0,
    create_by                TEXT    NOT NULL DEFAULT '',
    update_by                TEXT    NOT NULL DEFAULT '',
    created                  INTEGER NOT NULL,
    updated                  INTEGER NOT NULL
);

-- Images metadata
CREATE TABLE IF NOT EXISTS images (
    id         TEXT    PRIMARY KEY,
    prompt     TEXT    NOT NULL DEFAULT '',
    model      TEXT    NOT NULL DEFAULT '',
    size       TEXT    NOT NULL DEFAULT '',
    path       TEXT    NOT NULL DEFAULT '',
    remark     TEXT    NOT NULL DEFAULT '',
    yn         INTEGER NOT NULL DEFAULT 0,
    create_by  TEXT    NOT NULL DEFAULT '',
    update_by  TEXT    NOT NULL DEFAULT '',
    created    INTEGER NOT NULL,
    updated    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_images_created ON images(created DESC);

-- Videos metadata
CREATE TABLE IF NOT EXISTS videos (
    id         TEXT    PRIMARY KEY,
    prompt     TEXT    NOT NULL DEFAULT '',
    model      TEXT    NOT NULL DEFAULT '',
    size       TEXT    NOT NULL DEFAULT '',
    seconds    TEXT    NOT NULL DEFAULT '',
    path       TEXT    NOT NULL DEFAULT '',
    remote_id  TEXT,
    remark     TEXT    NOT NULL DEFAULT '',
    yn         INTEGER NOT NULL DEFAULT 0,
    create_by  TEXT    NOT NULL DEFAULT '',
    update_by  TEXT    NOT NULL DEFAULT '',
    created    INTEGER NOT NULL,
    updated    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created DESC);
