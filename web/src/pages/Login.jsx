import { useState, useContext, useEffect } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import clickSound from '../assets/click-sound.mp3';

export default function Login() {
    const [initials, setInitials] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('idle'); // idle, checking, confirm_login (ask pass), confirm_register (create pass), logging_in
    const [userExists, setUserExists] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const { user, loginLegacy, loginWithGoogle } = useContext(UserContext);
    const navigate = useNavigate();

    // Auto-redirect if already logged in (e.g. after Google OAuth redirect)
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const playClick = () => {
        const audio = new Audio(clickSound);
        audio.currentTime = 0.55;
        audio.play().catch(e => console.error("Audio play failed:", e));
    };
    const handleCheck = async (e) => {
        e.preventDefault();
        playClick();
        setErrorMsg('');
        if (initials.length !== 3) return;
        setStatus('checking');

        try {
            const res = await fetch(`/api/user/${initials}`);
            if (res.ok) {
                setUserExists(true);
                // User exists, ask for password to login
                setStatus('confirm_login');
            } else if (res.status === 404) {
                setUserExists(false);
                // User new, ask for password to create
                setStatus('confirm_register');
            } else {
                alert('Error checking user');
                setStatus('idle');
            }
        } catch (err) {
            console.error(err);
            setStatus('idle');
        }
    };

    const handleLogin = async () => {
        if (!password) {
            setErrorMsg('Password required');
            return;
        }
        setErrorMsg('');
        const { success, error } = await loginLegacy(initials, password);
        if (success) {
            navigate('/dashboard');
        } else {
            setErrorMsg(error || 'Login failed');
            setStatus(userExists ? 'confirm_login' : 'confirm_register');
        }
    };

    const reset = () => {
        setStatus('idle');
        setInitials('');
        setPassword('');
        setUserExists(false);
        setErrorMsg('');
    };

    return (
        <div className="app-container">
            <div className="flashcard" style={{
                height: 'auto',
                minHeight: '300px',
                width: 'min(400px, 90vw)',
                padding: 'min(3rem, 5vw)',
                flexDirection: 'column',
                gap: '2rem'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 className="word-heading" style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', marginBottom: '0.5rem' }}>TenKanji</h1>
                    <p className="sub-heading" style={{ justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>てんかんじ</p>
                </div>

                {status === 'idle' || status === 'checking' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.5rem' }}>
                        <form onSubmit={handleCheck} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', width: '100%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                    Characters that represent you. Anything, really.
                                </label>
                                <input
                                    type="text"
                                    maxLength={3}
                                    value={initials}
                                    onChange={e => setInitials(e.target.value.toUpperCase())}
                                    placeholder="ABC"
                                    disabled={status === 'checking'}
                                    style={{
                                        fontSize: 'clamp(1.5rem, 6vw, 2rem)',
                                        textAlign: 'center',
                                        padding: 'clamp(0.6rem, 3vw, 1rem)',
                                        borderRadius: '12px',
                                        border: '2px solid var(--col-black)',
                                        background: 'var(--col-white)',
                                        color: 'var(--col-black)',
                                        width: 'min(100%, 250px)',
                                        fontWeight: '800',
                                        letterSpacing: '0.5rem',
                                        boxShadow: 'inset 4px 4px 0px 0px rgba(0,0,0,0.05)',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <button
                                type="submit"
                                className="see-more-btn"
                                disabled={initials.length !== 3 || status === 'checking'}
                                style={{
                                    width: 'min(100%, 250px)',
                                    fontSize: 'clamp(1rem, 4vw, 1.2rem)',
                                    padding: '0.6rem 1rem',
                                    marginTop: '0.2rem',
                                    opacity: (initials.length === 3 && status !== 'checking') ? 1 : 0.5,
                                    cursor: (initials.length === 3 && status !== 'checking') ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {status === 'checking' ? (
                                    <>
                                        <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px', boxShadow: 'none' }}></div>
                                        CHECKING...
                                    </>
                                ) : (
                                    'Continue →'
                                )}
                            </button>
                            {initials.length > 0 && initials.length < 3 && (
                                <p style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', margin: 0 }}>
                                    {3 - initials.length} more characters needed
                                </p>
                            )}
                        </form>

                        <div style={{ display: 'flex', alignItems: 'center', width: 'min(100%, 250px)', gap: '0.5rem' }}>
                            <div style={{ flex: 1, height: '2px', background: 'var(--col-black)', opacity: 0.1 }}></div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>OR</span>
                            <div style={{ flex: 1, height: '2px', background: 'var(--col-black)', opacity: 0.1 }}></div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                playClick();
                                loginWithGoogle();
                            }}
                            className="see-more-btn"
                            style={{
                                width: 'min(100%, 250px)',
                                fontSize: '1rem',
                                padding: '0.8rem 1rem',
                                background: 'white',
                                color: 'black',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.8rem',
                                marginTop: 0
                            }}
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" style={{ width: '20px', height: '20px' }} />
                            Log in with Google
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', animation: 'scale-in 0.2s ease' }}>
                        <div style={{ padding: '1rem', background: userExists ? '#dcfce7' : '#fff7ed', border: '2px solid var(--col-black)', borderRadius: '12px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {userExists ? `Welcome back, ${initials}!` : `New Account: ${initials}`}
                            </p>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                {userExists ? 'Enter password to continue.' : 'Create a password to start.'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        playClick();
                                        setStatus('logging_in');
                                        handleLogin();
                                    }
                                }}
                                disabled={status === 'logging_in'}
                                style={{
                                    fontSize: '1.5rem',
                                    textAlign: 'center',
                                    padding: '0.8rem 1rem',
                                    borderRadius: '12px',
                                    border: '2px solid var(--col-black)',
                                    background: 'var(--col-white)',
                                    color: 'var(--col-black)',
                                    width: 'min(100%, 250px)',
                                    fontWeight: '800',
                                    letterSpacing: '0.1rem',
                                    boxShadow: 'inset 4px 4px 0px 0px rgba(0,0,0,0.05)',
                                    outline: 'none'
                                }}
                            />
                            {errorMsg && (
                                <p style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', margin: 0 }}>
                                    {errorMsg}
                                </p>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    playClick();
                                    reset();
                                }}
                                className="nav-button"
                                disabled={status === 'logging_in'}
                                style={{ borderRadius: '12px', width: 'auto', padding: '0 1rem', fontSize: '1rem', height: '50px', opacity: status === 'logging_in' ? 0.5 : 1 }}
                            >
                                Back
                            </button>
                            <button
                                onClick={async () => {
                                    playClick();
                                    setStatus('logging_in');
                                    await handleLogin();
                                }}
                                className="see-more-btn"
                                disabled={status === 'logging_in' || !password}
                                style={{
                                    flex: 1,
                                    marginTop: 0,
                                    fontSize: '1.2rem',
                                    background: userExists ? '#22c55e' : 'var(--col-orange)',
                                    border: '2px solid var(--col-black)',
                                    color: userExists ? 'white' : 'black',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    opacity: (status === 'logging_in' || !password) ? 0.8 : 1
                                }}
                            >
                                {status === 'logging_in' ? (
                                    <>
                                        <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px', boxShadow: 'none', borderTopColor: 'white', borderRightColor: 'white' }}></div>
                                        STARTING...
                                    </>
                                ) : (
                                    userExists ? 'Login' : 'Create & Start'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
