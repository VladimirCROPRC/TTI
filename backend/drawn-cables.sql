CREATE TABLE IF NOT EXISTS drawn_cables (
 id TEXT PRIMARY KEY REFERENCES cables(id),
 name TEXT NOT NULL, coordinates TEXT NOT NULL
);
