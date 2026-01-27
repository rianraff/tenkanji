import { useState, useEffect, useContext, useMemo } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, X, Share2, Trophy, Calendar } from 'lucide-react';
import Loading from '../components/Loading';
import kanjiDataRaw from '../data/jlpt-kanji.json';

const kanjiData = kanjiDataRaw;

export default function TenKanji() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!location.state?.fromDashboard) {
            navigate('/dashboard');
        }
    }, [location, navigate]);

    if (!location.state?.fromDashboard) return null;

    // State
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState('learning'); // 'learning' | 'practice' | 'complete'
    const [isFlipped, setIsFlipped] = useState(false);
    const [sessionResults, setSessionResults] = useState([]); // [{ word: '...', isCorrect: true }]
    const [dailyDate, setDailyDate] = useState('');
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Load Daily Words
    useEffect(() => {
        if (!user) return;

        const fetchDaily = async () => {
            try {
                const res = await fetch(`/api/daily?initials=${user.initials}`);
                if (!res.ok) throw new Error('Failed to fetch daily words');
                const data = await res.json();

                if (data.completed && data.completedData) {
                    setSessionResults(data.completedData.results || []);
                    setPhase('complete');
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
    }, [user]);

    // Window Resize Listener
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Derived State
    const currentWord = words[currentIndex];
    const kanjiDetails = useMemo(() => {
        if (!currentWord || !currentWord.word) return [];
        const chars = currentWord.word.split('');
        const details = chars
            .map((char) => kanjiData.find((k) => k.kanji === char))
            .filter((item) => item !== undefined);
        const uniqueDetails = Array.from(new Set(details.map(d => d.id)))
            .map(id => details.find(d => d.id === id));
        return uniqueDetails;
    }, [currentWord]);

    // Handlers
    const handleNext = () => {
        if (currentIndex < words.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const startPractice = () => {
        // Shuffle words for practice session
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        setWords(shuffled);
        setPhase('practice');
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    const handleTouchStart = (e) => {
        setTouchStartX(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const handleTouchEnd = (e) => {
        if (!touchStartX || !touchStartY) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        // Vertical Swipe -> Flip (Practice Mode)
        if (phase === 'practice' && Math.abs(diffY) > 50 && Math.abs(diffX) < 50) {
            setIsFlipped(prev => !prev);
        }

        // Horizontal Swipe
        if (Math.abs(diffX) > 50 && Math.abs(diffY) < 50) {
            if (phase === 'learning') {
                if (diffX > 0) handleNext(); // Left swipe -> Next
                else handlePrev(); // Right swipe -> Previous
            } else if (phase === 'practice') {
                if (diffX > 0) handlePracticeAnswer(false); // Left swipe -> Wrong
                else handlePracticeAnswer(true); // Right swipe -> Correct
            }
        }

        setTouchStartX(null);
        setTouchStartY(null);
    };

    const handlePracticeAnswer = (isCorrect) => {
        const result = { word: currentWord.word, isCorrect };
        const newResults = [...sessionResults, result];
        setSessionResults(newResults);

        if (currentIndex >= words.length - 1) {
            setPhase('complete');
            const score = newResults.filter(r => r.isCorrect).length;

            // Save word-by-word progress
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initials: user.initials, results: newResults })
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
                            results: newResults
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
        } else {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
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

    // Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (phase === 'learning') {
                if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleNext();
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handlePrev();
                if (e.key === ' ' && currentIndex === words.length - 1) startPractice();
            } else if (phase === 'practice') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    setIsFlipped(prev => !prev);
                }
                if (e.key === 'd' || e.key === 'D') handlePracticeAnswer(true);
                if (e.key === 'a' || e.key === 'A') handlePracticeAnswer(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [phase, currentIndex, words, sessionResults, isFlipped]);

    if (loading) return <Loading message="Loading Today's TenKanji..." />;

    if (!currentWord) {
        return (
            <div className="app-container" style={{ textAlign: 'center' }}>
                <div className="flashcard" style={{ height: 'auto', textAlign: 'center' }}>
                    <p style={{ fontWeight: 'bold' }}>No words found for today!</p>
                    <button className="nav-button" onClick={() => navigate('/dashboard')} style={{ width: 'auto', padding: '0 2rem', borderRadius: '12px', marginTop: '1rem' }}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    if (phase === 'complete') {
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
                            onClick={handleShare}
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
                            onClick={() => navigate('/dashboard')}
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
        <div className="app-container" style={{ padding: '1rem', overflowY: 'auto', justifyContent: 'center' }}>
            {/* Header / Progress */}
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
                {phase === 'learning' ? 'LEARNING MODE' : `DAILY PROGRESS: ${currentIndex + 1} / ${words.length}`}
            </div>

            <div key={currentIndex} className="animate-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem' }}>
                <div className="kanji-grid" style={{ marginBottom: '3.5rem' }}>
                    {kanjiDetails.map((kanji) => {
                        const isKanjiFlipped = phase === 'learning' || isFlipped;
                        return (
                            <div key={kanji.id} className={`kanji-card ${isKanjiFlipped ? 'flipped' : ''}`}>
                                <div className="kanji-card-inner">
                                    <div className="kanji-card-front" style={{ background: 'var(--col-orange)' }}>
                                        <h2 style={{ fontSize: '4.5rem', margin: 0, color: 'var(--col-black)' }}>{kanji.kanji}</h2>
                                    </div>
                                    <div className="kanji-card-back">
                                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{kanji.kanji}</div>
                                        <p className="kanji-desc" style={{ fontSize: '0.95rem', marginTop: '0.2rem', lineHeight: '1.2' }}>
                                            {(kanji.description.split(' means ')[1] || kanji.description).split(';')[0].split('.')[0]}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div
                    className={`flashcard ${phase === 'learning' || isFlipped ? 'flipped' : ''}`}
                    onClick={() => {
                        if (phase === 'practice') setIsFlipped(prev => !prev);
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    style={{ cursor: phase === 'practice' ? 'pointer' : 'default' }}
                >
                    <div className="flashcard-inner">
                        <div className="flashcard-front">
                            <h1 style={{ fontSize: 'clamp(4rem, 20vw, 8rem)', margin: 0, fontWeight: '800', lineHeight: 1 }}>{currentWord.word}</h1>
                            {phase === 'practice' && (
                                <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {windowWidth < 450 ? 'SWIPE UP TO FLIP' : 'CLICK OR SPACE TO FLIP'}
                                </div>
                            )}
                        </div>

                        <div className="flashcard-back">
                            <h1 className="word-heading">{currentWord.word}</h1>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="sub-heading">
                                    <span>{currentWord.hiragana}</span>
                                    <span className="divider"></span>
                                    <span>{currentWord.romaji}</span>
                                </div>
                                <ul className="meanings-list">
                                    {currentWord.meanings.slice(0, 2).map((meaning, idx) => (
                                        <li key={idx} className="meaning-item">{meaning}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                maxWidth: '500px'
            }}>
                {phase === 'learning' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <button
                            className="see-more-btn"
                            onClick={startPractice}
                            disabled={currentIndex !== words.length - 1}
                            style={{
                                width: 'auto',
                                padding: '0.75rem 2rem',
                                opacity: currentIndex === words.length - 1 ? 1 : 0.5,
                                cursor: currentIndex === words.length - 1 ? 'pointer' : 'not-allowed',
                                filter: currentIndex === words.length - 1 ? 'none' : 'grayscale(1)',
                                transition: 'all 0.3s ease',
                                fontSize: '1.2rem'
                            }}
                        >
                            Start Practice Mode
                        </button>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                            {windowWidth < 450 ? 'SWIPE LEFT/RIGHT TO NAVIGATE' : 'USE KEYS A/D OR ARROWS TO NAVIGATE'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', padding: '0 1rem' }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.8rem',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: 'var(--text-secondary)',
                            textAlign: 'center'
                        }}>
                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <span><span style={{ color: '#ef4444' }}>{windowWidth < 450 ? '← SWIPE LEFT' : 'KEY A / ←'}</span> : WRONG</span>
                                <span><span style={{ color: '#22c55e' }}>{windowWidth < 450 ? 'SWIPE RIGHT →' : 'KEY D / →'}</span> : CORRECT</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
