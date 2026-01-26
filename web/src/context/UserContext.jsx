import { createContext, useState, useEffect } from 'react';

export const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load user from localStorage on mount if available (persistence)
    useEffect(() => {
        const savedInitials = localStorage.getItem('kanji_user_initials');
        if (savedInitials) {
            fetchUser(savedInitials);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async (initials) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/user/${initials}`);
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                localStorage.setItem('kanji_user_initials', initials);
            } else {
                // If user not found but we had it in local storage, maybe clear it?
                // Or keep it invalid.
                console.error('User not found');
                localStorage.removeItem('kanji_user_initials');
                setUser(null);
            }
        } catch (err) {
            console.error('Error fetching user:', err);
        } finally {
            setLoading(false);
        }
    };

    const login = async (initials) => {
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initials })
            });
            if (!res.ok) throw new Error('Login failed');
            const userData = await res.json();
            setUser(userData);
            localStorage.setItem('kanji_user_initials', userData.initials);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('kanji_user_initials');
    };

    const updateSettings = async (chunkSize) => {
        if (!user) return;
        try {
            await fetch(`/api/user/${user.initials}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chunkSize })
            });
            setUser(prev => ({ ...prev, chunk_size: chunkSize }));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <UserContext.Provider value={{ user, loading, login, logout, updateSettings }}>
            {children}
        </UserContext.Provider>
    );
}
