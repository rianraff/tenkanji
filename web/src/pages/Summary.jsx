import { useContext, useState, useEffect } from 'react';
import Loading from '../components/Loading';
import { UserContext } from '../context/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, X } from 'lucide-react';

export default function Summary() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const { results, words, mode } = location.state || { results: [], words: [], mode: 'new' };
    const [saving, setSaving] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (results.length === 0) {
            navigate('/dashboard');
        }
    }, [results, navigate]);

    if (results.length === 0) return null;

    const correctCount = results.filter(r => r.isCorrect).length;
    const accuracy = Math.round((correctCount / results.length) * 100);
    const isPerfect = accuracy === 100;

    const saveProgress = async () => {
        try {
            setSaving(true);
            await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initials: user.initials,
                    results
                })
            });
            return true;
        } catch (err) {
            console.error(err);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleFinish = async () => {
        await saveProgress();
        navigate('/dashboard');
    };

    const handleRetry = async () => {
        // Save current progress (so correct words are counted)
        await saveProgress();

        const wrongWords = words.filter(w => {
            const res = results.find(r => r.word === w.word);
            return res && !res.isCorrect;
        });

        navigate('/session', { state: { retryWords: wrongWords, startPhase: 'practice', mode } });
    };

    const saveAndNext = async () => {
        await saveProgress();
        // Continue in the same mode
        const nextMode = mode === 'review' ? 'review' : 'new';
        const startPhase = nextMode === 'review' ? 'practice' : 'learning';

        navigate('/session', { state: { mode: nextMode, startPhase } });
    };

    return (
        <div className="app-container" style={{ padding: '1rem', overflowY: 'auto', justifyContent: 'flex-start' }}>
            {saving && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(229, 229, 229, 0.8)',
                    zIndex: 100,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <Loading message="Saving Progress..." />
                </div>
            )}
            <div style={{
                height: 'auto',
                minHeight: '400px',
                width: 'min(800px, 95vw)',
                padding: windowWidth < 600 ? '1.5rem' : '3rem',
                margin: '2rem 0',
                display: 'flex',
                flexDirection: 'column',
                gap: windowWidth < 600 ? '1.5rem' : '2.5rem',
                background: 'var(--col-white)',
                border: '2px solid var(--col-black)',
                borderRadius: '24px',
                boxShadow: 'var(--shadow)',
                position: 'relative',
                boxSizing: 'border-box'
            }}>

                {/* Header Section: Horizontal Layout */}
                <div style={{
                    display: 'flex',
                    alignItems: windowWidth < 600 ? 'center' : 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    flexDirection: windowWidth < 600 ? 'column' : 'row',
                    gap: '1rem',
                    textAlign: windowWidth < 600 ? 'center' : 'left'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h1 className="word-heading" style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', margin: 0 }}>
                            {isPerfect ? 'Perfect!' : 'Complete!'}
                        </h1>
                        {isPerfect && <span style={{ fontSize: 'clamp(2rem, 8vw, 3rem)' }}>🎉</span>}
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '0.8rem',
                        justifyContent: windowWidth < 600 ? 'center' : 'flex-end'
                    }}>
                        <p className="sub-heading" style={{ fontSize: 'clamp(1rem, 4vw, 1.3rem)', margin: 0 }}>
                            SCORE: {correctCount} / {results.length}
                        </p>
                        <p className="sub-heading" style={{
                            fontSize: 'clamp(1rem, 4vw, 1.3rem)',
                            margin: 0,
                            fontWeight: '800',
                            color: isPerfect ? '#22c55e' : 'var(--text-secondary)'
                        }}>
                            ({accuracy}%)
                        </p>
                    </div>
                </div>

                {/* List Section */}
                <div style={{
                    width: '100%',
                    maxHeight: '40vh',
                    overflowY: 'auto',
                    background: '#f8fafc',
                    border: '2px solid var(--col-black)',
                    padding: '0.5rem',
                    borderRadius: '16px',
                    boxShadow: 'inset 4px 4px 0px 0px rgba(0,0,0,0.05)',
                    boxSizing: 'border-box'
                }}>
                    {words.map((word, idx) => {
                        const result = results.find(r => r.word === word.word);
                        const isCorrect = result?.isCorrect;

                        return (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1rem',
                                borderBottom: idx === words.length - 1 ? 'none' : '1px solid var(--col-gray)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: windowWidth < 600 ? '0.8rem' : '1.5rem' }}>
                                    <span style={{ fontSize: windowWidth < 600 ? '1.4rem' : '1.8rem', fontWeight: 'bold' }}>{word.word}</span>
                                    <span style={{ fontSize: windowWidth < 600 ? '0.9rem' : '1.1rem', color: 'var(--text-secondary)' }}>{word.hiragana}</span>
                                </div>
                                <div>
                                    {isCorrect ? <Check color="#22c55e" size={windowWidth < 600 ? 20 : 28} strokeWidth={3} /> : <X color="#ef4444" size={windowWidth < 600 ? 20 : 28} strokeWidth={3} />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Buttons Section */}
                <div style={{
                    display: 'flex',
                    gap: windowWidth < 600 ? '1rem' : '1.5rem',
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: windowWidth < 600 ? 'column' : 'row',
                    marginTop: '0.5rem',
                    boxSizing: 'border-box'
                }}>
                    {!isPerfect && (
                        <button
                            className="see-more-btn"
                            onClick={handleRetry}
                            style={{
                                background: '#ffe4e6',
                                borderColor: 'var(--col-black)',
                                color: '#ef4444',
                                flex: 1,
                                width: '100%',
                                marginTop: 0
                            }}
                        >
                            Retry Missed Words
                        </button>
                    )}

                    {isPerfect ? (
                        <>
                            <button
                                onClick={handleFinish}
                                className="see-more-btn"
                                style={{
                                    borderRadius: '999px',
                                    width: '100%',
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    padding: '0.75rem 2rem',
                                    height: 'auto',
                                    flex: 1,
                                    marginTop: 0,
                                    background: 'var(--col-white)'
                                }}
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={saveAndNext}
                                className="see-more-btn"
                                style={{
                                    marginTop: 0,
                                    fontSize: '1.1rem',
                                    flex: 1,
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '0.8rem',
                                    height: 'auto',
                                    padding: '0.75rem 2rem'
                                }}
                            >
                                <span>Next Set</span>
                                <span>→</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleFinish}
                            className="see-more-btn"
                            style={{
                                width: '100%',
                                borderRadius: '999px',
                                fontSize: '1.1rem',
                                background: 'var(--col-white)',
                                padding: '0.75rem 2rem',
                                flex: 1,
                                marginTop: 0
                            }}
                        >
                            Finish
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
