CREATE TABLE IF NOT EXISTS cables (
 id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'Neprogramate',
 scheduled_week TEXT, patrolled_week TEXT, version INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
UPDATE points SET category=category||'/Finalizate',version=version+1
WHERE category IN ('TTI (1)/Pichetare','TTI (1)/Predari amplasament');
