import { useContext, useState, useEffect } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, RotateCcw } from 'lucide-react';
import Loading from '../components/Loading';

export default function Dashboard() {
    const { user, updateSettings } = useContext(UserContext);
    const navigate = useNavigate();
    const [mode, setMode] = useState('new'); // 'new' | 'review'
    const [masteredCount, setMasteredCount] = useState(0);
    const [loadingStats, setLoadingStats] = useState(true);

    // Forced chunk size 10 per requirements
    const chunkSize = 10;

    useEffect(() => {
        if (!user) return;
        // Logic kept for potential future use or if needed for "Flashback" validation
        const fetchStats = async () => {
            // ... data fetching logic ...
            try {
                const res = await fetch(`/api/user/${user.initials}`);
                if (res.ok) {
                    const data = await res.json();
                    setMasteredCount(data.masteredCount);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingStats(false);
            }
        };
        fetchStats();
    }, [user]);

    if (!user || loadingStats) return <Loading />;

    // Hardcoded logic for now as requested
    // "Force user to use 10 chunking method" -> We just use 10 when starting session

    return (
        <div className="app-container">
            {/* User Badge */}
            <div style={{
                position: 'absolute',
                top: '2rem',
                right: '2rem',
                background: 'var(--col-white)',
                border: '2px solid var(--col-black)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 'bold',
                boxShadow: '4px 4px 0px 0px var(--col-black)',
                zIndex: 20
            }}>
                WELCOME, {user.initials}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h1 className="word-heading" style={{ fontSize: '5rem', marginBottom: '0.5rem' }}>TenKanji</h1>
                <p className="sub-heading" style={{ justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold' }}>てんかんじ</p>
            </div>

            <div className="flashcard" style={{ height: 'auto', gap: '2rem', width: '500px', zIndex: 10, alignItems: 'stretch', textAlign: 'left' }}>
                {/* Controls Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', textTransform: 'uppercase' }}>Session Controls</p>

                    <div style={{ display: 'flex', gap: '1rem', height: '150px' }}>
                        {/* Mode Selectors */}
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                onClick={() => setMode('new')}
                                style={{
                                    flex: 1,
                                    borderRadius: '12px',
                                    border: '2px solid var(--col-black)',
                                    background: mode === 'new' ? 'var(--col-orange)' : 'var(--col-white)',
                                    color: 'var(--col-black)',
                                    fontWeight: '800',
                                    boxShadow: mode === 'new' ? 'inset 4px 4px 0px 0px rgba(0,0,0,0.2)' : '4px 4px 0px 0px var(--col-black)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.1s ease',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <BookOpen size={20} /> NEW WORDS
                            </button>
                            <button
                                onClick={() => setMode('review')}
                                disabled={masteredCount === 0}
                                style={{
                                    flex: 1,
                                    borderRadius: '12px',
                                    border: '2px solid var(--col-black)',
                                    background: mode === 'review' ? 'var(--col-orange)' : 'var(--col-white)',
                                    color: 'var(--col-black)',
                                    fontWeight: '800',
                                    boxShadow: mode === 'review' ? 'inset 4px 4px 0px 0px rgba(0,0,0,0.2)' : '4px 4px 0px 0px var(--col-black)',
                                    opacity: masteredCount === 0 ? 0.5 : 1,
                                    cursor: masteredCount === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.1s ease',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <RotateCcw size={20} /> FLASHBACK
                            </button>
                        </div>

                        {/* Start Button */}
                        <button
                            className="see-more-btn"
                            onClick={() => {
                                updateSettings(10);
                                navigate('/session', {
                                    state: {
                                        mode,
                                        size: 10,
                                        // If Flashback (review), start immediately in practice
                                        startPhase: mode === 'review' ? 'practice' : 'learning'
                                    }
                                });
                            }}
                            style={{
                                flex: 3,
                                height: '100%',
                                padding: '0',
                                marginTop: 0,
                                fontSize: '2rem',
                                borderRadius: '12px',
                                boxShadow: '4px 4px 0px 0px var(--col-black)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'var(--col-white)', /* Make it distinct or orange? Usually Start is primary. */
                                background: 'var(--col-black)',
                                color: 'var(--col-white)'
                            }}
                        >
                            <span>START</span>
                            <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>{mode === 'new' ? 'NEW WORDS' : 'FLASHBACK'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
