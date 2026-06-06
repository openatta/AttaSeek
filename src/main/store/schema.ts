/**
 * SQLite schema — audit_logs, token_usage, permission_policies (active).
 * Legacy tables (sessions, session_events, memory_entries, app_state)
 * retained for historical data read-back; new writes go to ~/.atta/seek/ plain-text files.
 */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  renderer_hint TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  editable INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_versions (
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, version),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Session',
  activity TEXT NOT NULL DEFAULT 'chat',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_events_session
  ON session_events(session_id, created_at);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL DEFAULT 'L2',
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  session_id TEXT,
  task_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory_entries(scope, scope_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  session_id TEXT,
  project_id TEXT,
  event_type TEXT NOT NULL,
  tool_id TEXT,
  risk_level TEXT,
  input_summary TEXT,
  output_summary TEXT,
  permission_result TEXT,
  artifact_refs TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_logs(session_id, created_at);

CREATE TABLE IF NOT EXISTS permission_policies (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  tool_id TEXT,
  plugin_id TEXT,
  risk_level TEXT,
  decision TEXT NOT NULL DEFAULT 'ask',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  interface_type TEXT NOT NULL CHECK(interface_type IN ('openai_compatible','anthropic')),
  endpoint_url TEXT NOT NULL,
  models TEXT NOT NULL DEFAULT '[]',
  default_model TEXT NOT NULL,
  extra_params TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Migration: add models column to pre-existing model_configs tables safely
-- (SQLite throws if column already exists, so we check first)
-- This runs as part of schema init; ignored if column already present

CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  session_id TEXT,
  task_id TEXT,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (config_id) REFERENCES model_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_usage_config ON token_usage(config_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id);
`
