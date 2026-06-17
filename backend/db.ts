import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'station.db');

import fs from 'fs';
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db: Database.Database = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('courier','recipient','admin')),
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_no TEXT UNIQUE NOT NULL,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      pickup_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','picked_up','expired')),
      entered_by INTEGER NOT NULL,
      entered_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      picked_up_at TEXT,
      picked_up_by INTEGER,
      FOREIGN KEY (entered_by) REFERENCES users(id),
      FOREIGN KEY (picked_up_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_packages_recipient_phone ON packages(recipient_phone);
    CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
    CREATE INDEX IF NOT EXISTS idx_packages_tracking_no ON packages(tracking_no);
    CREATE INDEX IF NOT EXISTS idx_packages_entered_at ON packages(entered_at);
  `);
}

export default db;
