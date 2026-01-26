import { useState, useEffect, useContext, useMemo } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, Check, X } from 'lucide-react';
import Loading from '../components/Loading';
import kanjiDataRaw from '../data/jlpt-kanji.json';

// Ensure kanjiData is accessible
const kanjiData = kanjiDataRaw;

export default function Session() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();
    console.log('Session mounted with state:', location.state);

    // State
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState('learning'); // 'learning' | 'practice'
    const [isFlipped, setIsFlipped] = useState(false);
    const [sessionResults, setSessionResults] = useState([]); // [{ word: '...', isCorrect: true }]

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

    // Derived State
    const currentWord = words[currentIndex];

    // Helper: Get Kanji Breakdown
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
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setIsFlipped(false);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + words.length) % words.length);
        setIsFlipped(false);
    };

    const startPractice = () => {
        // Shuffle words for practice
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        setWords(shuffled);
        setPhase('practice');
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    const handlePracticeAnswer = (isCorrect) => {
        const result = { word: currentWord.word, isCorrect };
        const newResults = [...sessionResults, result];
        setSessionResults(newResults);

        if (currentIndex >= words.length - 1) {
            const mode = location.state?.mode || 'new';
            navigate('/summary', { state: { results: newResults, words, mode } });
        } else {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    // Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (phase === 'learning') {
                if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleNext();
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handlePrev();
                if (e.key === ' ') startPractice();
            } else {
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

    if (loading) return <Loading message="Preparing Session..." />;
    if (!currentWord) return (
        <div className="app-container">
            <div className="flashcard" style={{ height: 'auto', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold' }}>No words loaded!</p>
                <button className="nav-button" onClick={() => navigate('/dashboard')} style={{ width: 'auto', padding: '0 2rem', borderRadius: '12px', marginTop: '1rem' }}>Back to Dashboard</button>
            </div>
        </div>
    );

    return (
        <div className="app-container">
            {/* Header / Progress */}
            <div style={{ position: 'absolute', top: '1rem', right: '2rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                {phase === 'learning' ? 'LEARNING MODE' : `PRACTICE: ${currentIndex + 1} / ${words.length}`}
            </div>

            <div key={currentIndex} className="animate-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* FLASHCARD */}
                {/* FLASHCARD */}
                <div
                    className={`flashcard ${phase === 'learning' || isFlipped ? 'flipped' : ''}`}
                    onClick={() => {
                        if (phase === 'practice') setIsFlipped(prev => !prev);
                    }}
                    style={{ cursor: phase === 'practice' ? 'pointer' : 'default' }}
                >
                    <div className="flashcard-inner">
                        {/* FRONT FACE: The Question (Large Kanji) */}
                        <div className="flashcard-front">
                            <h1 style={{
                                fontSize: '8rem',
                                margin: 0,
                                lineHeight: 1,
                                fontWeight: '800'
                            }}>
                                {currentWord.word}
                            </h1>
                            {phase === 'practice' && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold'
                                }}>
                                    CLICK OR SPACE TO FLIP
                                </div>
                            )}
                        </div>

                        {/* BACK FACE: The Answer (Detailed Info) */}
                        <div className="flashcard-back">
                            <h1 className="word-heading">
                                {currentWord.word}
                            </h1>

                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%'
                            }}>
                                <div className="sub-heading">
                                    <span>{currentWord.hiragana}</span>
                                    <span className="divider"></span>
                                    <span>{currentWord.romaji}</span>
                                </div>

                                <ul className="meanings-list">
                                    {currentWord.meanings.slice(0, 2).map((meaning, idx) => (
                                        <li key={idx} className="meaning-item">
                                            {meaning}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KANJI BREAKDOWN */}
                <div className="kanji-grid" style={{ marginTop: '3.5rem' }}>
                    {kanjiDetails.map((kanji) => {
                        const isKanjiFlipped = phase === 'learning' || isFlipped;
                        return (
                            <div
                                key={kanji.id}
                                className={`kanji-card ${isKanjiFlipped ? 'flipped' : ''}`}
                                onClick={() => { /* Optional: Allow individual flip? For now just sync with main card */ }}
                            >
                                <div className="kanji-card-inner">
                                    {/* Front: Character */}
                                    <div className="kanji-card-front" style={{ background: 'var(--col-orange)' }}>
                                        <h2 style={{ fontSize: '4.5rem', margin: 0, color: 'var(--col-black)' }}>{kanji.kanji}</h2>
                                    </div>

                                    {/* Back: Info */}
                                    <div className="kanji-card-back">
                                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{kanji.kanji}</div>
                                        <p className="kanji-desc" style={{ fontSize: '0.95rem', marginTop: '0.2rem', lineHeight: '1.2' }}>
                                            {kanji.description.split(' means ')[1]?.split('.')[0] || kanji.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* STATIC CONTROLS */}
            {phase === 'learning' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <button
                        className="see-more-btn"
                        onClick={startPractice}
                        style={{ fontSize: '1.2rem', padding: '0.75rem 2rem' }}
                    >
                        Start Practice Mode
                    </button>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        USE KEYS 'A' AND 'D' OR ARROWS TO NAVIGATE
                    </p>
                </div>
            )}

            {phase === 'practice' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                        <span><span style={{ color: '#ef4444' }}>A / ←</span> : INCORRECT</span>
                        <span><span style={{ color: '#22c55e' }}>D / →</span> : CORRECT</span>
                    </div>
                </div>
            )}
        </div>
    );
}
