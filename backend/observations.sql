CREATE TABLE IF NOT EXISTS observations (
 id TEXT PRIMARY KEY,
 point_id TEXT NOT NULL REFERENCES points(id),
 text TEXT NOT NULL,
 created_at TEXT NOT NULL,
 legacy INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS observations_point_date ON observations(point_id,created_at);
INSERT OR IGNORE INTO observations(id,point_id,text,created_at,legacy)
SELECT 'legacy-'||id,id,notes,replace(updated_at,' ','T')||'Z',1 FROM points WHERE trim(notes) <> '';
