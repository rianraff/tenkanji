const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { supabase } = require('./database');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Load words dictionary
const wordsPath = path.resolve(__dirname, 'words.json');
let wordsData = [];
try {
    wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
    console.log('Successfully loaded words.json');
} catch (err) {
    console.error('Error loading words.json:', err.message);
}

// Simple ping at the root of the app
app.get('/api/ping', (req, res) => res.json({ message: 'pong', time: new Date().toISOString() }));

// API Routes
app.post('/api/login', async (req, res) => {
    const { initials } = req.body;
    if (!initials || initials.length !== 3) return res.status(400).json({ error: 'Initials must be 3 characters' });
    const upperInitials = initials.toUpperCase();
    try {
        const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();
        if (fetchError && fetchError.code === 'PGRST116') {
            await supabase.from('users').insert({ initials: upperInitials });
        }
        const { data: updatedUser, error: finalFetchError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();
        if (finalFetchError) throw finalFetchError;
        res.json(updatedUser);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/:initials', async (req, res) => {
    const { initials } = req.params;
    const upperInitials = initials.toUpperCase();
    try {
        const { data: user, error: userError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();
        if (userError || !user) return res.status(404).json({ error: 'User not found' });
        const { count: masteredCount, error: countError } = await supabase.from('word_status').select('*', { count: 'exact', head: true }).eq('user_initials', upperInitials).eq('status', 2);
        if (countError) throw countError;
        res.json({ ...user, masteredCount: masteredCount || 0, totalWords: wordsData.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/words/chunk', async (req, res) => {
    const { initials, size, mode } = req.query;
    const chunkSize = parseInt(size) || 10;
    const userInitials = initials.toUpperCase();
    try {
        const { data: masteredRows, error: masteredError } = await supabase.from('word_status').select('word').eq('user_initials', userInitials).eq('status', 2);
        if (masteredError) throw masteredError;
        const masteredSet = new Set(masteredRows.map(row => row.word));
        const chunk = [];
        let startIndex = -1;
        if (mode === 'review') {
            const { data: rows, error: reviewError } = await supabase.from('word_status').select('word').eq('user_initials', userInitials).eq('status', 2).order('last_reviewed', { ascending: true }).limit(chunkSize);
            if (reviewError) throw reviewError;
            const reviewWords = rows.map(r => r.word);
            wordsData.forEach((w, i) => { if (reviewWords.includes(w.word)) chunk.push({ ...w, id: i, index: i }); });
        } else {
            for (let i = 0; i < wordsData.length; i++) {
                if (!masteredSet.has(wordsData[i].word)) {
                    if (chunk.length === 0) startIndex = i;
                    chunk.push({ ...wordsData[i], id: i, index: i });
                    if (chunk.length >= chunkSize) break;
                }
            }
        }
        res.json({ chunk, startIndex, totalMastered: masteredSet.size, totalWords: wordsData.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/progress', async (req, res) => {
    const { initials, results } = req.body;
    const userInitials = initials.toUpperCase();
    try {
        for (const result of results) {
            const { data: currentStatus } = await supabase.from('word_status').select('correct_count, wrong_count').eq('user_initials', userInitials).eq('word', result.word).single();
            const cCount = (currentStatus?.correct_count || 0) + (result.isCorrect ? 1 : 0);
            const wCount = (currentStatus?.wrong_count || 0) + (result.isCorrect ? 0 : 1);
            await supabase.from('word_status').upsert({ user_initials: userInitials, word: result.word, status: result.isCorrect ? 2 : 1, correct_count: cCount, wrong_count: wCount, last_reviewed: new Date().toISOString() }, { onConflict: 'user_initials, word' });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fallback for any other /api routes
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

module.exports = app;
