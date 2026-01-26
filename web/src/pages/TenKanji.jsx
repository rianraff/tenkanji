import { useState, useEffect, useContext, useMemo } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, X, Share2, Trophy, Calendar } from 'lucide-react';
import Loading from '../components/Loading';
import kanjiDataRaw from '../data/jlpt-kanji.json';

const kanjiData = kanjiDataRaw;

export default function TenKanji() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();

    // State
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState('learning'); // 'learning' | 'practice' | 'complete'
    const [isFlipped, setIsFlipped] = useState(false);
    const [dailyDate, setDailyDate] = useState('');
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);

    // Load Daily Words
    useEffect(() => {
        if (!user) return;

        const fetchDaily = async () => {
            try {
                const res = await fetch(`/api/daily?initials=${user.initials}`);
                if (!res.ok) throw new Error('Failed to fetch daily words');
                const data = await res.json();

                // Filter out words without kanji breakdown
                const filtered = data.chunk.filter(wordObj => {
                    if (!wordObj.word) return false;
                    return wordObj.word.split('').some(char =>
                        kanjiData.some(k => k.kanji === char)
                    );
                });

                setWords(filtered);
                setDailyDate(data.date);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDaily();
    }, [user]);

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

        // Vertical Swipe (Practice Mode)
        if (phase === 'practice' && diffY > 50 && Math.abs(diffX) < 50) {
            setIsFlipped(prev => !prev);
        }

        // Horizontal Swipe (Learning Mode)
        if (phase === 'learning' && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                handleNext();
            } else {
                handlePrev();
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
            // Save progress to backend
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initials: user.initials, results: newResults })
            });
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
            <div className="app-container" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)' }}>
                <div className="animate-enter" style={{
                    background: 'white',
                    padding: '3rem',
                    borderRadius: '24px',
                    border: '4px solid var(--col-black)',
                    boxShadow: '8px 8px 0px 0px var(--col-black)',
                    maxWidth: '500px',
                    width: '90%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.5rem',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '8px',
                        background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)',
                        backgroundSize: '200% 100%',
                        animation: 'gradient-move 3s linear infinite'
                    }} />

                    <Trophy size={64} color="var(--col-orange)" />

                    <h1 style={{ fontSize: '3rem', margin: 0, fontFamily: 'Noto Sans JP' }}>お疲れ様！</h1>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 'bold', margin: 0 }}>
                        DAILY TENKANJI COMPLETED
                    </p>

                    <div style={{ display: 'flex', gap: '2rem', margin: '1rem 0' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{score}/10</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.6 }}>SCORE</div>
                        </div>
                        <div style={{ width: '2px', background: 'var(--col-gray)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{streak}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.6 }}>STREAK</div>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '0.75rem',
                        padding: '1.5rem',
                        background: '#f9fafb',
                        borderRadius: '16px',
                        border: '2px solid var(--col-gray)'
                    }}>
                        {sessionResults.map((res, i) => (
                            <div key={i} style={{
                                width: '45px',
                                height: '45px',
                                background: res.isCorrect ? '#22c55e' : '#ef4444',
                                borderRadius: '10px',
                                border: '2px solid var(--col-black)',
                                boxShadow: '2px 2px 0px 0px var(--col-black)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '900',
                                fontSize: '1.2rem'
                            }}>
                                {res.isCorrect ? '✓' : '✗'}
                            </div>
                        ))}
                    </div>

                    <button
                        className="see-more-btn"
                        onClick={handleShare}
                        style={{
                            width: '100%',
                            height: '60px',
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            marginTop: '1rem'
                        }}
                    >
                        <Share2 size={24} /> SHARE RESULTS
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        Back to Dashboard
                    </button>
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
        <div className="app-container">
            <div key={currentIndex} className="animate-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                            <h1 className="main-kanji-display" style={{ fontSize: '8rem', margin: 0, fontWeight: '800' }}>{currentWord.word}</h1>
                            {phase === 'practice' && (
                                <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    CLICK TO FLIP
                                </div>
                            )}
                        </div>

                        <div className="flashcard-back">
                            <h1 className="word-heading">{currentWord.word}</h1>
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

                <div className="kanji-grid" style={{ marginTop: '1.5rem' }}>
                    {kanjiDetails.map((kanji) => {
                        const isKanjiFlipped = phase === 'learning' || isFlipped;
                        return (
                            <div key={kanji.id} className={`kanji-card ${isKanjiFlipped ? 'flipped' : ''}`}>
                                <div className="kanji-card-inner">
                                    <div className="kanji-card-front" style={{ background: 'var(--col-orange)' }}>
                                        <h2 style={{ fontSize: '4.5rem', margin: 0 }}>{kanji.kanji}</h2>
                                    </div>
                                    <div className="kanji-card-back">
                                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{kanji.kanji}</div>
                                        <p className="kanji-desc" style={{ fontSize: '0.95rem', marginTop: '0.2rem' }}>
                                            {kanji.description.split(' means ')[1]?.split('.')[0] || kanji.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                    <>
                        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                            <button
                                className="nav-button"
                                onClick={handlePrev}
                                disabled={currentIndex === 0}
                                style={{ flex: 1, opacity: currentIndex === 0 ? 0.4 : 1, borderRadius: '12px' }}
                            >
                                <ChevronLeft /> PREV
                            </button>
                            <button
                                className="nav-button"
                                onClick={handleNext}
                                disabled={currentIndex === words.length - 1}
                                style={{ flex: 1, opacity: currentIndex === words.length - 1 ? 0.4 : 1, borderRadius: '12px' }}
                            >
                                NEXT <ChevronRight />
                            </button>
                        </div>
                        <button
                            className="see-more-btn"
                            onClick={startPractice}
                            disabled={currentIndex !== words.length - 1}
                            style={{
                                width: '100%',
                                opacity: currentIndex === words.length - 1 ? 1 : 0.5,
                                cursor: currentIndex === words.length - 1 ? 'pointer' : 'not-allowed',
                                filter: currentIndex === words.length - 1 ? 'none' : 'grayscale(1)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            START PRACTICE
                        </button>
                    </>
                ) : (
                    <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                        <button
                            className="nav-button"
                            onClick={() => handlePracticeAnswer(false)}
                            style={{ flex: 1, background: '#fee2e2', color: '#ef4444', borderRadius: '12px' }}
                        >
                            <X /> WRONG
                        </button>
                        <button
                            className="nav-button"
                            onClick={() => handlePracticeAnswer(true)}
                            style={{ flex: 1, background: '#dcfce7', color: '#22c55e', borderRadius: '12px' }}
                        >
                            <Check /> CORRECT
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
