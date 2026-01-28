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
    const { initials, password } = req.body; // Password might be undefined for legacy users temporarily? No, requirement says "require password".

    if (!initials || initials.length !== 3) return res.status(400).json({ error: 'Initials must be 3 characters' });
    const upperInitials = initials.toUpperCase();

    try {
        // Fetch user
        const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('initials', upperInitials).single();

        // If user doesn't exist, Create New Account
        if (fetchError && fetchError.code === 'PGRST116') {
            if (!password) return res.status(400).json({ error: 'Password required for new account' });

            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({ initials: upperInitials, password: password }) // Ensure 'password' column exists in Supabase
                .select()
                .single();

            if (createError) throw createError;
            return res.json(newUser);
        }

        // User Exists - Check Password
        if (user) {
            // If user has a password set, check it
            if (user.password && user.password !== password) {
                return res.status(401).json({ error: 'Incorrect password' });
            }
            // If user exists but has NO password (legacy), maybe allow login and ask to set it? 
            // Or enforcing "Require password" means we mandate it.
            // For now, if provided password matches or user has no password (first migration login?), update it?
            if (!user.password && password) {
                await supabase.from('users').update({ password }).eq('initials', upperInitials);
                user.password = password;
            } else if (!user.password && !password) {
                return res.status(400).json({ error: 'Legacy account detected. Please set a password.' });
            }

            return res.json(user);
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper for Initials Generation
const generateInitials = (fullName) => {
    if (!fullName) return 'ABC';
    const words = fullName.trim().toUpperCase().split(/\s+/);
    let raw = '';
    if (words.length >= 3) {
        raw = words[0][0] + words[1][0] + words[2][0];
    } else if (words.length === 2) {
        raw = words[0][0] + words[1][0] + words[1][0]; // Reuse 2nd word's first letter
    } else if (words.length === 1) {
        raw = words[0][0] + words[0][0] + words[0][0]; // Reuse 3 times
    } else {
        return 'ABC';
    }
    return raw;
};

router.post('/auth/google-sync', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database client not initialized.' });
    const { email, full_name, avatar_url } = req.body;

    try {
        // 1. Check if user with this email already exists
        // Need 'email' column in users table. If not present, we rely on metadata or assume legacy users don't have email.
        // Assuming user creates 'email' column alongside 'password'.
        const { data: existingUser } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

        if (existingUser) {
            return res.json(existingUser);
        }

        // 2. Generate Initials
        let baseInitials = generateInitials(full_name);
        let finalInitials = baseInitials;

        // 3. Uniqueness Check & Collision Resolution
        // Try up to 10 times (suffix 0-9)
        let isUnique = false;
        let suffix = 0;

        while (!isUnique && suffix <= 10) {
            const { data: collision } = await supabase.from('users').select('initials').eq('initials', finalInitials).maybeSingle();
            if (!collision) {
                isUnique = true;
            } else {
                // Collision! Modify 3rd char to be a digit
                finalInitials = baseInitials.substring(0, 2) + suffix.toString();
                suffix++;
            }
        }

        if (!isUnique) throw new Error('Could not generate unique initials after 10 retries.');

        // 4. Create User
        // Note: Google users don't necessarily need a password for this flow, 
        // OR we set a random one, OR we leave it null.
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
                initials: finalInitials,
                email: email,
                full_name: full_name,
                // avatar_url: avatar_url // if column exists
            })
            .select()
            .single();

        if (insertError) throw insertError;
        res.json(newUser);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
        // Log study session for streak
        await supabase.from('study_logs').insert({
            user_initials: userInitials,
            date: new Date().toISOString().split('T')[0],
            activity_type: 'normal_session'
        });
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
    res.set('Cache-Control', 'no-store');
    const { initials } = req.query;
    if (!initials) return res.status(400).json({ error: 'Initials required' });

    const userInitials = initials.toUpperCase();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // Variables for debug scope
        let uniqueDates = [];

        // Get Current Date YYYY-MM-DD (Universal-ish)
        const now = new Date();
        let todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        let yesterdayStr = yesterday.toISOString().split('T')[0];

        let currentCheck = '';
        let debugError = null;

        // Check if already completed today
        let completedData = null;
        let streak = 0;

        if (supabase) {
            // ... (keep existing fetch logic)
            // Fetch today's status
            const { data, error } = await supabase
                .from('daily_challenges')
                .select('*')
                .eq('user_initials', userInitials)
                .eq('date', today)
                .maybeSingle();

            if (error) {
                console.error('Supabase error fetching daily challenge:', error);
            } else if (data) {
                completedData = data;
            }

            // Calculate Streak - Merge sources
            const { data: challengeDates, error: cError } = await supabase
                .from('daily_challenges')
                .select('date')
                .eq('user_initials', userInitials);

            const { data: logDates, error: lError } = await supabase
                .from('study_logs')
                .select('date')
                .eq('user_initials', userInitials);


            if (cError) debugError = `Challenge Error: ${cError.message}`;
            if (lError) debugError = `Log Error (Ignored): ${lError.message}`;

            if (!cError) {
                const combinedDates = [
                    ...(challengeDates?.map(d => d.date) || []),
                    ...(lError ? [] : (logDates?.map(d => d.date) || []))
                ];
                uniqueDates = [...new Set(combinedDates)].sort().reverse();

                // If user hasn't done today, streak continues if they did yesterday
                currentCheck = uniqueDates.includes(todayStr) ? todayStr : yesterdayStr;

                // If user didn't do today OR yesterday, streak is broken -> 0
                if (uniqueDates.includes(currentCheck)) {
                    // Start counting
                    streak = 0;
                    let checkDate = new Date(currentCheck);

                    // Helper to format Date to YYYY-MM-DD
                    const toIsoDate = (d) => d.toISOString().split('T')[0];

                    while (uniqueDates.includes(toIsoDate(checkDate))) {
                        streak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    }
                } else {
                    streak = 0;
                }
            }
        }



        // Robust deterministic seed from date (YYYYMMDD to integer)
        const dateStr = today.replace(/-/g, '');
        const seedBase = parseInt(dateStr, 10);

        // Linear Congruential Generator (LCG) for better distribution
        // Constants from Numerical Recipes
        const m = 4294967296; // 2^32
        const a = 1664525;
        const c = 1013904223;

        // Helper function for next random number
        let z = seedBase;
        const nextRand = () => {
            z = (a * z + c) % m;
            return z / m;
        };

        // Filter words that have at least one kanji in our database
        // Sort first to ensure absolute identical starting state across servers/restarts
        const validWords = wordsData
            .filter(wordObj => {
                if (!wordObj.word) return false;
                return wordObj.word.split('').some(char =>
                    kanjiData.some(k => k.kanji === char)
                );
            })
            .sort((a, b) => a.word.localeCompare(b.word));

        // Deterministic Fisher-Yates shuffle using LCG
        const shuffled = [...validWords];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(nextRand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Take first 10
        const chunk = shuffled.slice(0, 10).map((w, i) => ({ ...w, id: i, index: i }));

        res.json({
            date: today,
            chunk,
            totalWords: validWords.length,
            completed: !!completedData,
            completedData: completedData,
            streak: streak
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record Daily Challenge Completion
router.post('/daily/complete', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database client not initialized.' });

    const { initials, score, results } = req.body;
    if (!initials) return res.status(400).json({ error: 'Initials required' });

    const userInitials = initials.toUpperCase();
    const today = new Date().toISOString().split('T')[0];

    try {
        console.log(`Recording daily completion for ${userInitials} on ${today} with score ${score}`);
        const { data, error } = await supabase
            .from('daily_challenges')
            .upsert({
                user_initials: userInitials,
                date: today,
                score: score,
                results: results,
                completed_at: new Date().toISOString()
            }, { onConflict: 'user_initials, date' });

        if (error) {
            console.error('Supabase error recording daily challenge:', error);
            throw error;
        }
        res.json({ success: true, data });

        // Also log to study_logs for consolidated streak tracking
        await supabase.from('study_logs').insert({
            user_initials: userInitials,
            date: today,
            activity_type: 'daily_challenge'
        });
    } catch (err) {
        console.error('API /daily/complete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.use('/api', router);
app.use('/', router);

module.exports = app;
