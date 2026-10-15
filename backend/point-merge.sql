CREATE TABLE IF NOT EXISTS point_merges (
 id TEXT PRIMARY KEY, signature TEXT NOT NULL, snapshot TEXT NOT NULL,
 applied INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS merged_point_photos (
 point_id TEXT NOT NULL REFERENCES points(id), src TEXT NOT NULL, caption TEXT NOT NULL,
 merge_id TEXT NOT NULL REFERENCES point_merges(id), PRIMARY KEY(point_id,src)
);
