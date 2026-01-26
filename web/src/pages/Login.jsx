import { useState, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [initials, setInitials] = useState('');
    const [status, setStatus] = useState('idle'); // idle, checking, confirm_login, confirm_register
    const { login } = useContext(UserContext);
    const navigate = useNavigate();

    const handleCheck = async (e) => {
        e.preventDefault();
        if (initials.length !== 3) return;
        setStatus('checking');

        try {
            const res = await fetch(`/api/user/${initials}`);
            if (res.ok) {
                setStatus('confirm_login'); // User exists
            } else if (res.status === 404) {
                setStatus('confirm_register'); // User does not exist
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
        const success = await login(initials);
        if (success) navigate('/dashboard');
    };

    const reset = () => {
        setStatus('idle');
        setInitials('');
    };

    return (
        <div className="app-container">
            <div className="flashcard" style={{ height: 'auto', minHeight: '300px', width: '400px', padding: '3rem', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 className="word-heading" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>TenKanji</h1>
                    <p className="sub-heading" style={{ justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>てんかんじ</p>
                </div>

                {status === 'idle' || status === 'checking' ? (
                    <form onSubmit={handleCheck} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                Enter 3 Initials
                            </label>
                            <input
                                type="text"
                                maxLength={3}
                                value={initials}
                                onChange={e => setInitials(e.target.value.toUpperCase())}
                                placeholder="ABC"
                                disabled={status === 'checking'}
                                style={{
                                    fontSize: '2rem',
                                    textAlign: 'center',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '2px solid var(--col-black)',
                                    background: 'var(--col-white)',
                                    color: 'var(--col-black)',
                                    width: '100%',
                                    fontWeight: '800',
                                    letterSpacing: '0.5rem',
                                    boxShadow: 'inset 4px 4px 0px 0px rgba(0,0,0,0.05)'
                                }}
                            />
                        </div>
                        <button
                            type="submit"
                            className="see-more-btn"
                            disabled={initials.length !== 3 || status === 'checking'}
                            style={{
                                width: '100%',
                                fontSize: '1.2rem',
                                marginTop: '0.5rem',
                                opacity: (initials.length === 3 && status !== 'checking') ? 1 : 0.5,
                                cursor: (initials.length === 3 && status !== 'checking') ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {status === 'checking' ? 'Checking...' : 'Continue →'}
                        </button>
                        {initials.length > 0 && initials.length < 3 && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', margin: 0 }}>
                                {3 - initials.length} more characters needed
                            </p>
                        )}
                    </form>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', animation: 'scale-in 0.2s ease' }}>
                        <div style={{ padding: '1rem', background: status === 'confirm_login' ? '#dcfce7' : '#fff7ed', border: '2px solid var(--col-black)', borderRadius: '12px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {status === 'confirm_login' ? `Welcome back, ${initials}!` : `New Account: ${initials}`}
                            </p>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                {status === 'confirm_login' ? 'This account already exists.' : 'This account is available.'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={reset}
                                className="nav-button"
                                style={{ borderRadius: '12px', width: 'auto', padding: '0 1rem', fontSize: '1rem', height: '50px' }}
                            >
                                Back
                            </button>
                            <button
                                onClick={handleLogin}
                                className="see-more-btn"
                                style={{ flex: 1, marginTop: 0, fontSize: '1.2rem', background: status === 'confirm_login' ? '#22c55e' : 'var(--col-orange)', border: '2px solid var(--col-black)', color: status === 'confirm_login' ? 'white' : 'black' }}
                            >
                                {status === 'confirm_login' ? 'Login' : 'Create & Start'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
