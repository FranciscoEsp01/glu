use rusqlite::{Connection, Result};
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn init<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                template_type TEXT NOT NULL,
                category TEXT NOT NULL,
                executive_summary TEXT,
                action_items TEXT,
                key_decisions TEXT,
                manual_notes TEXT,
                raw_transcript TEXT,
                audio_path TEXT,
                is_starred INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Full-Text Search FTS5 Table
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts5(
                meeting_id UNINDEXED,
                title,
                transcript,
                summary
            )",
            [],
        )?;

        Ok(Self { conn })
    }
}
