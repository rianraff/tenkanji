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
const wordsPath = path.join(__dirname, 'words.json');
const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

router.post('/login', async (req, res) => {
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

router.get('/user/:initials', async (req, res) => {
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

router.put('/user/:initials/settings', async (req, res) => {
    const { initials } = req.params;
    const { chunkSize } = req.body;
    try {
        const { error } = await supabase.from('users').update({ chunk_size: chunkSize }).eq('initials', initials.toUpperCase());
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/words/chunk', async (req, res) => {
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

router.get('/words/status', async (req, res) => {
    const { initials } = req.query;
    const userInitials = initials.toUpperCase();
    try {
        const { data: statusRows, error } = await supabase.from('word_status').select('word, status').eq('user_initials', userInitials);
        if (error) throw error;
        const statusMap = {};
        statusRows.forEach(row => { statusMap[row.word] = row.status; });
        const wordsWithStatus = wordsData.map(w => ({ word: w.word, status: statusMap[w.word] || 0 }));
        res.json(wordsWithStatus);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/progress', async (req, res) => {
    const { initials, results } = req.body;
    const userInitials = initials.toUpperCase();
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: user, error: userError } = await supabase.from('users').select('last_active_date, streak').eq('initials', userInitials).single();
        if (userError) throw userError;
        if (user && user.last_active_date !== today) {
            let newStreak = user.streak || 0;
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (user.last_active_date === yesterdayStr) newStreak += 1; else newStreak = 1;
            await supabase.from('users').update({ streak: newStreak, last_active_date: today }).eq('initials', userInitials);
        }
        for (const result of results) {
            const { data: currentStatus } = await supabase.from('word_status').select('correct_count, wrong_count').eq('user_initials', userInitials).eq('word', result.word).single();
            const cCount = (currentStatus?.correct_count || 0) + (result.isCorrect ? 1 : 0);
            const wCount = (currentStatus?.wrong_count || 0) + (result.isCorrect ? 0 : 1);
            await supabase.from('word_status').upsert({ user_initials: userInitials, word: result.word, status: result.isCorrect ? 2 : 1, correct_count: cCount, wrong_count: wCount, last_reviewed: new Date().toISOString() }, { onConflict: 'user_initials, word' });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Use the router for ANY path that hits this function
app.use('/api', router);
app.use('/', router);

// Catch-all for Express 404s
app.use((req, res) => {
    res.status(404).json({
        error: 'Backend route not found',
        url: req.url,
        path: req.path
    });
});

module.exports = app;
