const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { supabase } = require('./database');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load words dictionary - using multiple path strategies for bundle compatibility
const getWordsData = () => {
    try {
        const paths = [
            path.join(__dirname, 'words.json'),
            path.join(process.cwd(), 'api', 'words.json'),
            path.join(process.cwd(), 'words.json')
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) {
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            }
        }
        return [];
    } catch (err) {
        console.error('Failed to load words.json:', err.message);
        return [];
    }
};

const wordsData = getWordsData();

const router = express.Router();

router.get('/ping', (req, res) => res.json({
    message: 'pong',
    supabaseConnected: !!supabase,
    wordsLoaded: wordsData.length
}));

router.get('/user/:initials', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database client not initialized. Check Vercel Env Vars.' });

    const { initials } = req.params;
    const upperInitials = initials.toUpperCase();
    try {
        const { data: user, error: userError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();
        if (userError || !user) return res.status(404).json({ error: 'User not found' });

        const { count: masteredCount, error: countError } = await supabase.from('word_status').select('*', { count: 'exact', head: true }).eq('user_initials', upperInitials).eq('status', 2);

        res.json({ ...user, masteredCount: masteredCount || 0, totalWords: wordsData.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database client not initialized.' });
    const { initials } = req.body;
    if (!initials || initials.length !== 3) return res.status(400).json({ error: 'Initials must be 3 characters' });
    const upperInitials = initials.toUpperCase();
    try {
        const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();
        if (fetchError && fetchError.code === 'PGRST116') {
            await supabase.from('users').insert({ initials: upperInitials });
        }
        const { data: updatedUser, error: finalFetchError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();
        res.json(updatedUser);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/words/chunk', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database client not initialized.' });
    const { initials, size, mode } = req.query;
    const chunkSize = parseInt(size) || 10;
    const userInitials = initials.toUpperCase();
    try {
        const { data: masteredRows, error: masteredError } = await supabase.from('word_status').select('word').eq('user_initials', userInitials).eq('status', 2);
        const masteredSet = new Set(masteredRows?.map(row => row.word) || []);
        const chunk = [];
        let startIndex = -1;
        if (mode === 'review') {
            const { data: rows } = await supabase.from('word_status').select('word').eq('user_initials', userInitials).eq('status', 2).order('last_reviewed', { ascending: true }).limit(chunkSize);
            const reviewWords = rows?.map(r => r.word) || [];
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

router.post('/progress', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database client not initialized.' });
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

// Load kanji data for filtering
const getKanjiData = () => {
    try {
        const paths = [
            path.join(__dirname, 'jlpt-kanji.json'),
            path.join(process.cwd(), 'api', 'jlpt-kanji.json'),
            path.join(process.cwd(), 'web', 'src', 'data', 'jlpt-kanji.json')
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) {
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            }
        }
        return [];
    } catch (err) {
        return [];
    }
};

const kanjiData = getKanjiData();

// Daily Challenge Endpoint
router.get('/daily', async (req, res) => {
    const { initials } = req.query;
    if (!initials) return res.status(400).json({ error: 'Initials required' });

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Simple deterministic seed from date
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
        hash = ((hash << 5) - hash) + today.charCodeAt(i);
        hash |= 0;
    }
    const seed = Math.abs(hash);

    // Filter words that have at least one kanji in our database
    const validWords = wordsData.filter(wordObj => {
        if (!wordObj.word) return false;
        return wordObj.word.split('').some(char =>
            kanjiData.some(k => k.kanji === char)
        );
    });

    // Deterministic shuffle
    const shuffled = [...validWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (seed + i) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const chunk = shuffled.slice(0, 10).map((w, i) => ({ ...w, id: i, index: i }));

    res.json({
        date: today,
        chunk,
        totalWords: validWords.length
    });
});

app.use('/api', router);
app.use('/', router);

module.exports = app;
