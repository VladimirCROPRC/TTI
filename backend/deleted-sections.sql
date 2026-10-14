CREATE TABLE IF NOT EXISTS deleted_cable_sections (
 section_id TEXT PRIMARY KEY REFERENCES cable_sections(id),
 deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
