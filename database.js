const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'kanji-app.db');
const db = sqlite3(dbPath);

function initDb() {
  // Create Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      initials TEXT PRIMARY KEY,
      chunk_size INTEGER DEFAULT 10,
      streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Word Status table
  // status: 0 = new, 1 = seen, 2 = mastered
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_status (
      user_initials TEXT,
      word TEXT,
      status INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      last_reviewed DATETIME,
      PRIMARY KEY (user_initials, word),
      FOREIGN KEY (user_initials) REFERENCES users(initials)
    )
  `);

  console.log('Database initialized');
}

module.exports = { db, initDb };
