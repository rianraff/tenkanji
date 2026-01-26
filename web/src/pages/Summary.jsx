import { useContext, useState } from 'react';
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

    if (results.length === 0) return <div>No results found. <button onClick={() => navigate('/dashboard')}>Home</button></div>;

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
            <div className="flashcard" style={{ height: 'auto', gap: '2rem', width: 'min(1200px, 95vw)', padding: 'min(3rem, 5vw)', margin: '2rem 0' }}>

                {/* Header Section: Horizontal Layout */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 300px' }}>
                        <h1 className="word-heading" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', margin: 0 }}>
                            {isPerfect ? 'Perfect!' : 'Complete!'}
                        </h1>
                        {isPerfect && <span style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}>🎉</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '1rem' }}>
                        <p className="sub-heading" style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', margin: 0, justifyContent: 'flex-end' }}>
                            SCORE: {correctCount} / {results.length}
                        </p>
                        <p className="sub-heading" style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', margin: 0, fontWeight: '800', justifyContent: 'flex-end', color: isPerfect ? '#22c55e' : 'var(--text-secondary)' }}>
                            ({accuracy}%)
                        </p>
                    </div>
                </div>

                {/* List Section */}
                <div style={{
                    width: '100%',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: 'var(--col-white)',
                    border: '2px solid var(--col-black)',
                    padding: '1rem',
                    borderRadius: '12px',
                    boxShadow: 'inset 4px 4px 0px 0px rgba(0,0,0,0.05)'
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
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem' }}>
                                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{word.word}</span>
                                    <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>{word.hiragana}</span>
                                </div>
                                <div>
                                    {isCorrect ? <Check color="#22c55e" size={28} strokeWidth={3} /> : <X color="#ef4444" size={28} strokeWidth={3} />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Buttons Section */}
                <div style={{ display: 'flex', gap: '2rem', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    {!isPerfect && (
                        <button
                            className="see-more-btn"
                            onClick={handleRetry}
                            style={{
                                background: '#ffe4e6',
                                borderColor: 'var(--col-black)',
                                color: '#ef4444',
                                flex: 2
                            }}
                        >
                            Retry Missed Words
                        </button>
                    )}

                    {isPerfect ? (
                        <>
                            <button
                                onClick={handleFinish}
                                className="nav-button"
                                style={{
                                    borderRadius: '12px',
                                    width: 'auto',
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    padding: '1rem 2rem',
                                    height: 'auto',
                                    flex: 1
                                }}
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={saveAndNext}
                                className="see-more-btn"
                                style={{
                                    marginTop: 0,
                                    fontSize: '1.2rem',
                                    flex: 1,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '0.8rem',
                                    height: 'auto',
                                    padding: '1rem 2rem'
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
                            style={{ width: 'auto', borderRadius: '12px', fontSize: '1.2rem', background: 'var(--col-white)', padding: '1rem 2rem', flex: 1 }}
                        >
                            Finish
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
