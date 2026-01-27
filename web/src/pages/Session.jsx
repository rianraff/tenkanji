import { useState, useEffect, useContext, useMemo } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';
import Loading from '../components/Loading';
import kanjiDataRaw from '../data/jlpt-kanji.json';
import clickSound from '../assets/click-sound.mp3';

// Ensure kanjiData is accessible
const kanjiData = kanjiDataRaw;

export default function Session() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const playClick = () => {
        const audio = new Audio(clickSound);
        audio.currentTime = 0.55;
        audio.play().catch(e => console.error("Audio play failed:", e));
    };

    useEffect(() => {
        if (!location.state) {
            navigate('/dashboard');
        }
    }, [location, navigate]);

    if (!location.state) return null;

    // State
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState('learning'); // 'learning' | 'practice'
    const [flipState, setFlipState] = useState('none'); // 'none' | 'up' | 'down'
    const [animState, setAnimState] = useState('idle'); // 'idle' | 'exiting-left' | 'exiting-right' | 'entering-left' | 'entering-right'
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [sessionResults, setSessionResults] = useState([]); // [{ word: '...', isCorrect: true }]
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Load Words on Mount
    useEffect(() => {
        if (!user) return;

        // Check if words were passed via navigation (e.g. Retry)
        if (location.state?.retryWords) {
            let wordsToUse = location.state.retryWords;
            if (location.state.startPhase === 'practice') {
                setPhase('practice');
                // Optional: Shuffle for practice
                wordsToUse = [...wordsToUse].sort(() => Math.random() - 0.5);
            }
            setWords(wordsToUse);
            setLoading(false);
            return;
        }

        const fetchWords = async () => {
            const mode = location.state?.mode || 'new';
            const size = 10;
            console.log('Fetching words with enforced size:', size);

            try {
                const res = await fetch(`/api/words/chunk?initials=${user.initials}&size=${size}&mode=${mode}`);
                if (!res.ok) throw new Error('Failed to fetch words');
                const data = await res.json();

                // Filter out words without kanji breakdown if required
                const filtered = data.chunk.filter(wordObj => {
                    if (!wordObj.word) return false;
                    return wordObj.word.split('').some(char =>
                        kanjiData.some(k => k.kanji === char)
                    );
                });

                // SHUFFLE if practice mode is requested immediately (e.g. Flashback)
                const startPhase = location.state?.startPhase;
                if (startPhase === 'practice') {
                    setPhase('practice');
                    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
                    setWords(shuffled);
                } else {
                    setWords(filtered);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchWords();
    }, [user, location.state]);
    // Window Resize Listener
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Derived State
    const currentWord = words[currentIndex];

    // Helper: Get Kanji Breakdown for a specific word
    const getKanjiDetails = (wordObj) => {
        if (!wordObj || !wordObj.word) return [];
        const chars = wordObj.word.split('');
        const details = chars
            .map((char) => kanjiData.find((k) => k.kanji === char))
            .filter((item) => item !== undefined);
        const uniqueDetails = Array.from(new Set(details.map(d => d.id)))
            .map(id => details.find(d => d.id === id));
        return uniqueDetails;
    };

    const kanjiDetails = useMemo(() => getKanjiDetails(currentWord), [currentWord]);
    const nextKanjiDetails = useMemo(() => words[currentIndex + 1] ? getKanjiDetails(words[currentIndex + 1]) : [], [words, currentIndex]);

    // Handlers
    const renderCardContent = (word, details, isNext = false) => (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* KANJI BREAKDOWN */}
            <div className="kanji-grid">
                {details.map((kanji) => {
                    const kanjiFlipClass = phase === 'learning' ? 'k-flipped-up' :
                        (isNext ? '' : (flipState === 'up' ? 'k-flipped-up' : flipState === 'down' ? 'k-flipped-down' : ''));
                    return (
                        <div key={kanji.id} className={`kanji-card ${kanjiFlipClass}`}>
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

            {/* FLASHCARD */}
            <div
                className={`flashcard ${phase === 'learning' ? 'flipped-up' :
                    (isNext ? '' : (flipState === 'up' ? 'flipped-up' : flipState === 'down' ? 'flipped-down' : ''))}`}
                onClick={() => {
                    if (!isNext && phase === 'practice') setFlipState(prev => prev === 'none' ? 'up' : 'none');
                }}
                onTouchStart={isNext ? null : handleTouchStart}
                onTouchEnd={isNext ? null : handleTouchEnd}
                style={{ cursor: !isNext && phase === 'practice' ? 'pointer' : 'default', marginTop: '3.5rem' }}
            >
                <div className="flashcard-inner">
                    <div className="flashcard-front">
                        <h1 style={{ fontSize: 'clamp(4rem, 20vw, 8rem)', margin: 0, lineHeight: 1, fontWeight: '800' }}>
                            {word.word}
                        </h1>
                        {!isNext && phase === 'practice' && (
                            <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                {windowWidth < 450 ? 'SWIPE UP TO FLIP' : 'CLICK OR SPACE TO FLIP'}
                            </div>
                        )}
                    </div>
                    <div className="flashcard-back">
                        <h1 className="word-heading">{word.word}</h1>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            <div className="sub-heading">
                                <span>{word.hiragana}</span>
                                <span className="divider"></span>
                                <span>{word.romaji}</span>
                            </div>
                            <ul className="meanings-list">
                                {word.meanings.slice(0, 2).map((meaning, idx) => (
                                    <li key={idx} className="meaning-item">{meaning}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const handleNext = () => {
        if (isTransitioning || currentIndex >= words.length - 1) return;
        setIsTransitioning(true);
        setAnimState('exiting-left');
        setTimeout(() => {
            setCurrentIndex((prev) => prev + 1);
            setFlipState('none');
            setAnimState('entering-right');
            setTimeout(() => {
                setIsTransitioning(false);
            }, 300);
        }, 300);
    };

    const handlePrev = () => {
        if (isTransitioning || currentIndex <= 0) return;
        setIsTransitioning(true);
        setAnimState('exiting-right');
        setTimeout(() => {
            setCurrentIndex((prev) => prev - 1);
            setFlipState('none');
            setAnimState('entering-left');
            setTimeout(() => {
                setIsTransitioning(false);
            }, 300);
        }, 300);
    };

    const startPractice = () => {
        playClick();
        // Shuffle words for practice
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        setWords(shuffled);
        setPhase('practice');
        setCurrentIndex(0);
        setFlipState('none');
        setAnimState('idle'); // Reset animation
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
            // Swipe Down (diffY < -50) -> Flip Downside
            // Swipe Up (diffY > 50) -> Flip Upside (or toggle)
            if (diffY < -50) {
                setFlipState(prev => prev === 'none' ? 'down' : 'none');
            } else {
                setFlipState(prev => prev === 'none' ? 'up' : 'none');
            }
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
        if (isTransitioning || currentIndex >= words.length) return;
        setIsTransitioning(true);

        const result = { word: currentWord.word, isCorrect };
        const newResults = [...sessionResults, result];
        setSessionResults(newResults);

        if (currentIndex >= words.length - 1) {
            const mode = location.state?.mode || 'new';
            // Reset transition state before navigating or state change to avoid stuckness
            setTimeout(() => {
                navigate('/summary', { state: { results: newResults, words, mode } });
                setIsTransitioning(false);
            }, 300);
        } else {
            // Correct -> Slide Right (Inverted for practice flow), Wrong -> Slide Left
            // Actually user said: "one card move to right" for learning, maybe they want the same for practice
            // Let's stick to: Practice Wrong -> Left, Practice Correct -> Right
            setAnimState(isCorrect ? 'exiting-right' : 'exiting-left');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setFlipState('none');
                setAnimState('idle');
                setTimeout(() => {
                    setIsTransitioning(false);
                }, 300);
            }, 300);
        }
    };

    // Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (phase === 'learning') {
                if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleNext();
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handlePrev();
                if (e.key === ' ' && currentIndex === words.length - 1) startPractice();
            } else {
                if (e.code === 'Space') {
                    e.preventDefault();
                    if (!isTransitioning) setFlipState(prev => prev === 'none' ? 'up' : 'none');
                }
                if (e.key === 'd' || e.key === 'D') handlePracticeAnswer(true);
                if (e.key === 'a' || e.key === 'A') handlePracticeAnswer(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [phase, currentIndex, words, sessionResults, flipState, isTransitioning]);

    if (loading) return <Loading message="Preparing Session..." />;
    if (!currentWord) return (
        <div className="app-container">
            <div className="flashcard" style={{ height: 'auto', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold' }}>No words loaded!</p>
                <button className="nav-button" onClick={() => { playClick(); navigate('/dashboard'); }} style={{ width: 'auto', padding: '0 2rem', borderRadius: '12px', marginTop: '1rem' }}>Back to Dashboard</button>
            </div>
        </div>
    );

    return (
        <div className="app-container" style={{
            padding: '4rem 1.5rem',
            overflowY: 'auto',
            justifyContent: 'flex-start',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            {/* Header / Progress - Now part of the flow */}
            <div style={{
                width: '100%',
                maxWidth: '800px',
                display: 'flex',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                marginBottom: '2rem',
                letterSpacing: '0.1em'
            }}>
                {phase === 'learning' ? `LEARNING: ${currentIndex + 1} / ${words.length}` : `PRACTICE: ${currentIndex + 1} / ${words.length}`}
            </div>

            {phase === 'learning' ? (
                <div key={currentIndex} className={
                    animState === 'exiting-left' ? 'animate-exit-left' :
                        animState === 'exiting-right' ? 'animate-exit-right' :
                            animState === 'entering-left' ? 'animate-enter-left' :
                                animState === 'entering-right' ? 'animate-enter-right' :
                                    'animate-enter'
                } style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {renderCardContent(currentWord, kanjiDetails)}
                </div>
            ) : (
                <div className="card-stack">
                    {/* Next Card (Underneath) */}
                    {currentIndex < words.length - 1 && (
                        <div className="stacked-card next">
                            {renderCardContent(words[currentIndex + 1], nextKanjiDetails, true)}
                        </div>
                    )}

                    {/* Current Card (Top) */}
                    <div key={currentIndex} className={`stacked-card current ${animState === 'exiting-left' ? 'animate-exit-left' :
                        animState === 'exiting-right' ? 'animate-exit-right' :
                            animState === 'entering-left' ? 'animate-enter-left' :
                                animState === 'entering-right' ? 'animate-enter-right' :
                                    'animate-practice-reveal'
                        }`}>
                        {renderCardContent(currentWord, kanjiDetails)}
                    </div>
                </div>
            )}

            {/* STATIC CONTROLS */}
            {phase === 'learning' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <button
                        className="see-more-btn"
                        onClick={startPractice}
                        disabled={currentIndex !== words.length - 1}
                        style={{
                            fontSize: '1.2rem',
                            padding: '0.75rem 2rem',
                            opacity: currentIndex === words.length - 1 ? 1 : 0.5,
                            cursor: currentIndex === words.length - 1 ? 'pointer' : 'not-allowed',
                            filter: currentIndex === words.length - 1 ? 'none' : 'grayscale(1)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        Start Practice Mode
                    </button>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        {windowWidth < 450 ? 'SWIPE LEFT/RIGHT TO NAVIGATE' : 'USE KEYS A/D OR ARROWS TO NAVIGATE'}
                    </p>
                </div>
            )}

            {phase === 'practice' && (
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
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <ArrowLeft size={16} strokeWidth={3} /> {windowWidth < 450 ? 'LEFT' : 'KEY A'}
                                </span> : WRONG
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    {windowWidth < 450 ? 'RIGHT' : 'KEY D'} <ArrowRight size={16} strokeWidth={3} />
                                </span> : CORRECT
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
