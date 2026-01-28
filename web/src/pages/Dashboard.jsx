import { useContext, useState, useEffect } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, RotateCcw, Calendar, Flame } from 'lucide-react';
import Loading from '../components/Loading';
import clickSound from '../assets/click-sound.mp3';

export default function Dashboard() {
    const { user, logout, updateSettings } = useContext(UserContext);
    const navigate = useNavigate();
    const [mode, setMode] = useState(null); // null | 'new' | 'review'
    const [masteredCount, setMasteredCount] = useState(0);
    const [loadingStats, setLoadingStats] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    const [dailyCompleted, setDailyCompleted] = useState(false);
    const [streak, setStreak] = useState(0);

    const playClick = () => {
        const audio = new Audio(clickSound);
        audio.currentTime = 0.55; // Skip initial silence
        audio.play().catch(e => console.error("Audio play failed:", e));
    };

    // Forced chunk size 10 per requirements
    const chunkSize = 10;

    useEffect(() => {
        if (!user) return;
        // Logic kept for potential future use or if needed for "Flashback" validation
        const fetchStats = async () => {
            try {
                const res = await fetch(`/api/user/${user.initials}`);
                if (res.ok) {
                    const data = await res.json();
                    setMasteredCount(data.masteredCount);
                }

                // Check daily completion
                const dailyRes = await fetch(`/api/daily?initials=${user.initials}&t=${Date.now()}`);
                if (dailyRes.ok) {
                    const dailyData = await dailyRes.json();
                    setDailyCompleted(dailyData.completed);
                    setStreak(dailyData.streak || 0);
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
                    playClick();
                    logout();
                    navigate('/');
                }}
                style={{
                    position: 'absolute',
                    top: '2rem',
                    right: '1rem',
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

            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
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
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', textTransform: 'uppercase' }}>Modes</p>

                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        minHeight: '150px'
                    }}>
                        {/* Mode Selectors */}
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    playClick();
                                    setMode('new');
                                }}
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
                                onClick={() => {
                                    playClick();
                                    setMode('review');
                                }}
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
                            disabled={!mode}
                            onClick={() => {
                                playClick();
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
                                fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                                borderRadius: '12px',
                                boxShadow: !mode ? 'none' : '4px 4px 0px 0px var(--col-black)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.2rem',
                                background: !mode ? '#94a3b8' : '#14213d',
                                color: 'var(--col-white)',
                                cursor: !mode ? 'not-allowed' : 'pointer',
                                opacity: !mode ? 0.7 : 1,
                                transition: 'all 0.3s ease',
                                border: '2px solid var(--col-black)'
                            }}
                        >
                            <span style={{ fontWeight: '800' }}>START</span>
                            <span style={{ fontSize: 'clamp(0.6rem, 2vw, 0.8rem)', fontWeight: 'bold' }}>
                                {mode === 'new' ? 'NEW WORDS' : mode === 'review' ? 'FLASHBACK' : 'SELECT MODE'}
                            </span>
                        </button>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', textTransform: 'uppercase' }}>Daily Challenge</p>
                        <button
                            onClick={() => {
                                playClick();
                                navigate('/ten-kanji', { state: { fromDashboard: true } });
                            }}
                            style={{
                                width: '100%',
                                height: 'clamp(60px, 15vw, 80px)',
                                borderRadius: '12px',
                                border: '2px solid var(--col-black)',
                                background: dailyCompleted ? '#22c55e' : '#a855f7',
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
                            <Calendar size={28} />
                            <span>{dailyCompleted ? 'DAILY COMPLETED' : 'DAILY CHALLENGE'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.6rem', borderRadius: '16px' }}>
                                <Flame size={20} fill={dailyCompleted ? "#fbbf24" : "#cbd5e1"} color={dailyCompleted ? "#fbbf24" : "#cbd5e1"} strokeWidth={2.5} />
                                <span style={{ fontSize: '1.2rem' }}>{streak}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
