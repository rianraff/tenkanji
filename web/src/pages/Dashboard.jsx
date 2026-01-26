import { useContext, useState, useEffect } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, RotateCcw, Calendar } from 'lucide-react';
import Loading from '../components/Loading';

export default function Dashboard() {
    const { user, logout, updateSettings } = useContext(UserContext);
    const navigate = useNavigate();
    const [mode, setMode] = useState('new'); // 'new' | 'review'
    const [masteredCount, setMasteredCount] = useState(0);
    const [loadingStats, setLoadingStats] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

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
        <div className="app-container" style={{ padding: '1rem' }}>
            {/* User Badge */}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    logout();
                    navigate('/');
                }}
                style={{
                    position: 'absolute',
                    top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                    right: '1.5rem',
                    background: isHovered ? '#ef4444' : 'var(--col-white)',
                    color: isHovered ? 'white' : 'var(--col-black)',
                    border: '2px solid var(--col-black)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    boxShadow: '4px 4px 0px 0px var(--col-black)',
                    zIndex: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '100px',
                    textAlign: 'center',
                    fontSize: 'clamp(0.7rem, 2.5vw, 0.9rem)'
                }}
            >
                {isHovered ? 'LOGOUT' : `WELCOME, ${user.initials}`}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 className="word-heading" style={{ fontSize: 'clamp(3.5rem, 15vw, 5.5rem)', marginBottom: '0.5rem' }}>TenKanji</h1>
                <p className="sub-heading" style={{ justifyContent: 'center', fontSize: 'clamp(1.5rem, 6vw, 2rem)', fontWeight: 'bold' }}>てんかんじ</p>
            </div>

            <div className="flashcard" style={{
                height: 'auto',
                gap: '2rem',
                width: 'min(500px, 95vw)',
                zIndex: 10,
                alignItems: 'stretch',
                textAlign: 'left',
                padding: 'min(3rem, 6vw)',
                boxSizing: 'border-box'
            }}>
                {/* Controls Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', textTransform: 'uppercase' }}>Session Controls</p>

                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        minHeight: '150px'
                    }}>
                        {/* Mode Selectors */}
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                onClick={() => setMode('new')}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
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
                                    padding: '1rem',
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
                                        startPhase: mode === 'review' ? 'practice' : 'learning'
                                    }
                                });
                            }}
                            style={{
                                flex: 3,
                                height: '100%',
                                padding: '0.5rem',
                                marginTop: 0,
                                fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                                borderRadius: '12px',
                                boxShadow: '4px 4px 0px 0px var(--col-black)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.2rem',
                                background: 'var(--col-black)',
                                color: 'var(--col-white)'
                            }}
                        >
                            <span>START</span>
                            <span style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.9rem)', fontWeight: 'normal' }}>{mode === 'new' ? 'NEW WORDS' : 'FLASHBACK'}</span>
                        </button>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', textTransform: 'uppercase' }}>Daily Challenge</p>
                        <button
                            onClick={() => navigate('/ten-kanji')}
                            style={{
                                width: '100%',
                                height: 'clamp(60px, 15vw, 80px)',
                                borderRadius: '12px',
                                border: '2px solid var(--col-black)',
                                background: '#a855f7',
                                color: 'white',
                                fontWeight: '800',
                                fontSize: 'clamp(1rem, 5vw, 1.5rem)',
                                boxShadow: '4px 4px 0px 0px var(--col-black)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                transition: 'all 0.1s ease',
                                cursor: 'pointer'
                            }}
                        >
                            <Calendar size={28} /> DAILY CHALLENGE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
