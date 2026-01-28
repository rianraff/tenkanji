import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import kanjiDataRaw from '../data/jlpt-kanji.json';
import clickSound from '../assets/click-sound.mp3';

// Ensure kanjiData is accessible
const kanjiData = kanjiDataRaw;

export default function StudySession({
    words,
    initialPhase = 'learning',
    onComplete,
    onExit,
    headerRenderer
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState(initialPhase);
    const [flipState, setFlipState] = useState('none'); // 'none' | 'up' | 'down'
    const [animState, setAnimState] = useState('idle'); // 'idle' | 'exiting-left' | 'exiting-right' | 'entering-left' | 'entering-right'
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [sessionResults, setSessionResults] = useState([]); // [{ word: '...', isCorrect: true }]
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    const playClick = () => {
        const audio = new Audio(clickSound);
        audio.currentTime = 0.55;
        audio.play().catch(e => console.error("Audio play failed:", e));
    };

    // Window Resize Listener
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
            <div className="kanji-grid" style={{ marginBottom: '3.5rem' }}>
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
                style={{ cursor: !isNext && phase === 'practice' ? 'pointer' : 'default' }}
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
        // Since we are moving to practice, we might want to let the parent know or just handle it internally.
        // In existing code, it shuffles words.
        // We can do an internal shuffle or assume props update?
        // Let's do internal shuffle for now as it's common behavior
        // But props.words are "fixed" usually.
        // Actually, existing code: setWords(shuffled).
        // Modifying prop data is bad. We should have a local words state if we shuffle.
        // BUT wait, if we shuffle, indices change.
        // Let's defer shuffle to a method that updates a local state copy of words?
        // Yes, let's keep a local copy of words.
    };

    // We need local words state to support shuffling
    const [localWords, setLocalWords] = useState(words);

    // Update local words if props change (e.g. initial load)
    useEffect(() => {
        setLocalWords(words);
        setCurrentIndex(0);
        setPhase(initialPhase);
    }, [words, initialPhase]);

    const handleStartPractice = () => {
        playClick();
        const shuffled = [...localWords].sort(() => Math.random() - 0.5);
        setLocalWords(shuffled);
        setPhase('practice');
        setCurrentIndex(0);
        setFlipState('none');
        setAnimState('idle');
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
        if (isTransitioning || currentIndex >= localWords.length) return;
        setIsTransitioning(true);

        const result = { word: currentWord.word, isCorrect };
        const newResults = [...sessionResults, result];
        setSessionResults(newResults);

        if (currentIndex >= localWords.length - 1) {
            // Finished
            setTimeout(() => {
                onComplete(newResults, localWords);
                setIsTransitioning(false);
            }, 300);
        } else {
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
                if (e.key === ' ' && currentIndex === localWords.length - 1) handleStartPractice();
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
    }, [phase, currentIndex, localWords, sessionResults, flipState, isTransitioning]);

    if (!currentWord) return (
        <div className="app-container">
            <div className="flashcard" style={{ height: 'auto', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold' }}>No words loaded!</p>
                <button className="nav-button" onClick={onExit} style={{ width: 'auto', padding: '0 2rem', borderRadius: '12px', marginTop: '1rem' }}>Back to Dashboard</button>
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
            {/* Exit Button */}
            <button
                onClick={() => { playClick(); onExit(); }}
                style={{
                    position: 'absolute',
                    top: '1.5rem',
                    left: '1.5rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    zIndex: 50,
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                aria-label="Exit to Dashboard"
            >
                <Home size={32} strokeWidth={2.5} />
            </button>
            {/* Header / Progress */}
            {headerRenderer ? headerRenderer(phase, currentIndex, localWords.length) : (
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
                    {phase === 'learning' ? `LEARNING: ${currentIndex + 1} / ${localWords.length}` : `PRACTICE: ${currentIndex + 1} / ${localWords.length}`}
                </div>
            )}

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
                    {currentIndex < localWords.length - 1 && (
                        <div className="stacked-card next">
                            {renderCardContent(localWords[currentIndex + 1], nextKanjiDetails, true)}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        className="see-more-btn"
                        onClick={handleStartPractice}
                        disabled={currentIndex !== localWords.length - 1}
                        style={{
                            fontSize: '1.2rem',
                            padding: '0.75rem 2rem',
                            opacity: currentIndex === localWords.length - 1 ? 1 : 0.5,
                            cursor: currentIndex === localWords.length - 1 ? 'pointer' : 'not-allowed',
                            filter: currentIndex === localWords.length - 1 ? 'none' : 'grayscale(1)',
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', padding: '0 1rem', marginTop: '2rem' }}>
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
