const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { db, initDb } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Initialize DB
initDb();

// Load words dictionary
const wordsPath = path.join(__dirname, 'words.json');
const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

// API Routes

// Login / Register
app.post('/api/login', (req, res) => {
    const { initials } = req.body;
    if (!initials || initials.length !== 3) {
        return res.status(400).json({ error: 'Initials must be 3 characters' });
    }
    const upperInitials = initials.toUpperCase();

    try {
        const user = db.prepare('SELECT * FROM users WHERE initials = ?').get(upperInitials);
        if (!user) {
            db.prepare('INSERT INTO users (initials) VALUES (?)').run(upperInitials);
        }
        const updatedUser = db.prepare('SELECT * FROM users WHERE initials = ?').get(upperInitials);
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Profile + Stats
app.get('/api/user/:initials', (req, res) => {
    const { initials } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE initials = ?').get(initials.toUpperCase());

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Stats
    const masteredCount = db.prepare('SELECT COUNT(*) as count FROM word_status WHERE user_initials = ? AND status = 2').get(initials.toUpperCase()).count;

    res.json({ ...user, masteredCount, totalWords: wordsData.length });
});

// Update Settings
app.put('/api/user/:initials/settings', (req, res) => {
    const { initials } = req.params;
    const { chunkSize } = req.body;

    db.prepare('UPDATE users SET chunk_size = ? WHERE initials = ?').run(chunkSize, initials.toUpperCase());
    res.json({ success: true });
});

// Get Chunk (New or Review)
app.get('/api/words/chunk', (req, res) => {
    const { initials, size, mode } = req.query;
    console.log(`[GET /words/chunk] mode=${mode}, size=${size}, initials=${initials}`);
    const chunkSize = parseInt(size) || 10;
    const userInitials = initials.toUpperCase();

    // Get all mastered words
    const masteredWords = db.prepare('SELECT word FROM word_status WHERE user_initials = ? AND status = 2').all(userInitials).map(row => row.word);
    const masteredSet = new Set(masteredWords);

    const chunk = [];
    let startIndex = -1;

    if (mode === 'review') {
        // Fetch words already mastered
        // Pick oldest reviewed first or just sequential mastered
        const rows = db.prepare('SELECT word FROM word_status WHERE user_initials = ? AND status = 2 ORDER BY last_reviewed ASC LIMIT ?').all(userInitials, chunkSize);
        console.log(`[Review Mode] Found ${rows.length} rows for ${userInitials}`);
        const reviewWords = rows.map(r => r.word);

        wordsData.forEach((w, i) => {
            if (reviewWords.includes(w.word)) {
                chunk.push({ ...w, id: i, index: i });
            }
        });
    } else {
        // Mode: Learn New
        for (let i = 0; i < wordsData.length; i++) {
            if (!masteredSet.has(wordsData[i].word)) {
                if (chunk.length === 0) startIndex = i;
                chunk.push({ ...wordsData[i], id: i, index: i });
                if (chunk.length >= chunkSize) break;
            }
        }
    }

    res.json({
        chunk,
        startIndex,
        totalMastered: masteredSet.size,
        totalWords: wordsData.length
    });
});

// Get All Words Status (for Dashboard Carousel)
app.get('/api/words/status', (req, res) => {
    const { initials } = req.query;
    const userInitials = initials.toUpperCase();

    const statusRows = db.prepare('SELECT word, status FROM word_status WHERE user_initials = ?').all(userInitials);
    const statusMap = {};
    statusRows.forEach(row => {
        statusMap[row.word] = row.status;
    });

    const wordsWithStatus = wordsData.map(w => ({
        word: w.word,
        status: statusMap[w.word] || 0
    }));

    res.json(wordsWithStatus);
});

// Submit Progress
app.post('/api/progress', (req, res) => {
    const { initials, results } = req.body;
    const userInitials = initials.toUpperCase();

    // Update Streak
    const today = new Date().toISOString().split('T')[0];
    const user = db.prepare('SELECT last_active_date, streak FROM users WHERE initials = ?').get(userInitials);

    if (user && user.last_active_date !== today) {
        let newStreak = user.streak || 0;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (user.last_active_date === yesterdayStr) {
            newStreak += 1;
        } else {
            newStreak = 1;
        }
        db.prepare('UPDATE users SET streak = ?, last_active_date = ? WHERE initials = ?').run(newStreak, today, userInitials);
    }

    const insertStmt = db.prepare(`
    INSERT INTO word_status (user_initials, word, status, correct_count, wrong_count, last_reviewed)
    VALUES (@initials, @word, @status, @correct, @wrong, CURRENT_TIMESTAMP)
    ON CONFLICT(user_initials, word) DO UPDATE SET
    status = @status,
    correct_count = correct_count + @correct,
    wrong_count = wrong_count + @wrong,
    last_reviewed = CURRENT_TIMESTAMP
  `);

    const updateTransaction = db.transaction((results) => {
        for (const result of results) {
            const isMastered = result.isCorrect ? 2 : 1; // 2 = mastered, 1 = seen/retry needed?
            // Actually, if they fail, status should technically not be mastered.
            // But the requirement says "Must get 100% correct before advancing".
            // This endpoint is likely called AT THE END of a perfect session presumably?
            // Or maybe called per retry?
            // If result.isCorrect is true, we assume they finally got it right? 
            // Let's assume the frontend only sends "isCorrect: true" for words that are truly done.
            // But for "Retry wrongs", we might send mixed results?
            // Logic: If user marks Correct (D), status -> 2. If Wrong (A), status -> 1 (or keep 0/1).

            insertStmt.run({
                initials: initials.toUpperCase(),
                word: result.word,
                status: result.isCorrect ? 2 : 1,
                correct: result.isCorrect ? 1 : 0,
                wrong: result.isCorrect ? 0 : 1
            });
        }
    });

    try {
        updateTransaction(results);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
