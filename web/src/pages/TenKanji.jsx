import { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Share2, Trophy } from 'lucide-react';
import Loading from '../components/Loading';
import StudySession from '../components/StudySession';
import kanjiDataRaw from '../data/jlpt-kanji.json';
import clickSound from '../assets/click-sound.mp3';

const kanjiData = kanjiDataRaw;

export default function TenKanji() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const playClick = () => {
        const audio = new Audio(clickSound);
        audio.currentTime = 0.55;
        audio.play().catch(e => console.error("Audio play failed:", e));
    };

    useEffect(() => {
        if (!location.state?.fromDashboard) {
            navigate('/dashboard');
        }
    }, [location, navigate]);

    // State
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionResults, setSessionResults] = useState([]); // [{ word: '...', isCorrect: true }]
    const [dailyDate, setDailyDate] = useState('');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // UI State
    const [isCompleted, setIsCompleted] = useState(false);

    // Load Daily Words
    useEffect(() => {
        if (!user || !location.state?.fromDashboard) return;

        const fetchDaily = async () => {
            try {
                const res = await fetch(`/api/daily?initials=${user.initials}`);
                if (!res.ok) throw new Error('Failed to fetch daily words');
                const data = await res.json();

                if (data.completed && data.completedData) {
                    setSessionResults(data.completedData.results || []);
                    setIsCompleted(true);
                    setDailyDate(data.date);
                    setWords(data.chunk || []);
                } else {
                    // Filter out words without kanji breakdown
                    const filtered = data.chunk.filter(wordObj => {
                        if (!wordObj.word) return false;
                        return wordObj.word.split('').some(char =>
                            kanjiData.some(k => k.kanji === char)
                        );
                    });

                    setWords(filtered);
                    setDailyDate(data.date);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDaily();
    }, [user, location.state]);

    // Window Resize Listener
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleComplete = (results, finalWords) => {
        setSessionResults(results);
        setIsCompleted(true);

        const score = results.filter(r => r.isCorrect).length;

        // Save word-by-word progress
        fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initials: user.initials, results: results })
        }).catch(err => console.error('Failed to save progress:', err));

        // Mark daily challenge as complete
        const recordCompletion = async () => {
            try {
                const res = await fetch('/api/daily/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        initials: user.initials,
                        score: score,
                        results: results
                    })
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    console.error('Failed to record daily challenge:', errorData);
                    alert(`Warning: Could not save daily challenge result. ${errorData.error || ''}`);
                }
            } catch (err) {
                console.error('Network error recording daily challenge:', err);
            }
        };
        recordCompletion();
    };

    const handleShare = () => {
        const score = sessionResults.filter(r => r.isCorrect).length;
        const grid = sessionResults.map(r => r.isCorrect ? '🟩' : '🟥').join('');
        const text = `TenKanji ${dailyDate}\nScore: ${score}/10\n${grid}\nhttps://kanji-quizzer.vercel.app/ten-kanji`;

        if (navigator.share) {
            navigator.share({
                title: 'Today\'s TenKanji',
                text: text,
            });
        } else {
            navigator.clipboard.writeText(text);
            alert('Results copied to clipboard!');
        }
    };

    const handleExit = () => {
        playClick();
        navigate('/dashboard');
    };

    if (!location.state?.fromDashboard) return null;
    if (loading) return <Loading message="Loading Today's TenKanji..." />;

    // Show "No Content" if not completed but no words
    if (!isCompleted && (!words || words.length === 0)) {
        return (
            <div className="app-container" style={{ textAlign: 'center' }}>
                <div className="flashcard" style={{ height: 'auto', textAlign: 'center' }}>
                    <p style={{ fontWeight: 'bold' }}>No words found for today!</p>
                    <button className="nav-button" onClick={handleExit} style={{ width: 'auto', padding: '0 2rem', borderRadius: '12px', marginTop: '1rem' }}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    if (isCompleted) {
        // Reuse the exact completion UI from before
        const score = sessionResults.filter(r => r.isCorrect).length;
        const streak = 1; // Placeholder for future streak logic

        return (
            <div className="app-container" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', padding: '1rem' }}>
                <div className="animate-enter" style={{
                    background: 'white',
                    padding: 'clamp(1rem, 3vw, 2rem)',
                    borderRadius: '24px',
                    border: '4px solid var(--col-black)',
                    boxShadow: '8px 8px 0px 0px var(--col-black)',
                    maxWidth: '500px',
                    width: '100%',
                    height: 'min(800px, 85vh)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'clamp(0.5rem, 2vw, 1rem)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '6px',
                        background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)',
                        backgroundSize: '200% 100%',
                        animation: 'gradient-move 3s linear infinite',
                        zIndex: 10
                    }} />

                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0rem' }}>
                        <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                            {dailyDate}
                        </p>
                        <Trophy size={windowWidth < 450 ? 50 : 70} color="var(--col-orange)" />
                        <h1 style={{ fontSize: 'clamp(1.8rem, 7vw, 2.5rem)', margin: 0, fontFamily: 'Noto Sans JP' }}>お疲れ様！</h1>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: 'clamp(0.5rem, 1.5vw, 0.8rem)',
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '16px',
                        border: '2px solid var(--col-gray)',
                        width: '100%',
                        boxSizing: 'border-box',
                        overflowY: 'auto',
                        flex: 1,
                        alignContent: 'start'
                    }}>
                        {sessionResults.map((res, i) => (
                            <div key={i} style={{
                                width: 'clamp(6rem, 20vw, 5rem)',
                                height: 'clamp(3rem, 10vw, 2.5rem)',
                                flex: '0 0 auto',
                                background: 'white',
                                borderRadius: '10px',
                                border: `2px solid ${res.isCorrect ? '#22c55e' : '#ef4444'}`,
                                color: res.isCorrect ? '#22c55e' : '#ef4444',
                                boxShadow: `3px 3px 0px 0px ${res.isCorrect ? '#16a34a' : '#dc2626'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '750',
                                fontSize: 'clamp(0.8rem, 3.5vw, 1.2rem)',
                                padding: '0.5rem',
                                boxSizing: 'border-box',
                                textAlign: 'center'
                            }}>
                                {res.word}
                            </div>
                        ))}
                    </div>

                    <div style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            className="see-more-btn"
                            onClick={() => { playClick(); handleShare(); }}
                            style={{
                                width: '100%',
                                height: '50px',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                margin: 0
                            }}
                        >
                            <Share2 size={20} /> SHARE RESULTS
                        </button>

                        <button
                            onClick={handleExit}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                color: 'var(--text-secondary)',
                                padding: '0.5rem'
                            }}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes gradient-move {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 200% 50%; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <StudySession
            words={words}
            initialPhase="learning"
            onComplete={handleComplete}
            onExit={handleExit}
            headerRenderer={(phase, currentIndex, total) => (
                <div style={{
                    position: 'absolute',
                    top: '2rem',
                    right: '1rem',
                    left: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    zIndex: 20
                }}>
                    {phase === 'learning' ? `LEARNING: ${currentIndex + 1} / ${total}` : `PRACTICE: ${currentIndex + 1} / ${total}`}
                </div>
            )}
        />
    );
}
