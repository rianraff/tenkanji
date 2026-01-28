import { createContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Helper to ensure user exists in our backend database (SQLite/Supabase-DB)
    const syncUserWithBackend = async (sessionUser) => {
        try {
            const { email, user_metadata } = sessionUser;
            const full_name = user_metadata.full_name || user_metadata.name || email.split('@')[0];
            const avatar_url = user_metadata.avatar_url;

            const res = await fetch('/api/auth/google-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, full_name, avatar_url })
            });

            if (res.ok) {
                const userData = await res.json();
                return userData;
            }
        } catch (err) {
            console.error("Backend sync failed", err);
        }
        return null;
    };

    useEffect(() => {
        let mounted = true;

        const initSession = async () => {
            // 1. Check Supabase Session (Google Login)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Determine initials via Backend Sync now, not locally
                const backendUser = await syncUserWithBackend(session.user);

                if (mounted && backendUser) {
                    setUser({ ...session.user, ...backendUser }); // Merge auth user + db user (initials)
                    setLoading(false);
                } else if (mounted) {
                    // Fallback if sync failed?
                    setLoading(false);
                }
                return;
            }

            // 2. Fallback: Check LocalStorage (Legacy Login)
            const savedInitials = localStorage.getItem('kanji_user_initials');
            if (savedInitials) {
                try {
                    const res = await fetch(`/api/user/${savedInitials}`);
                    if (res.ok) {
                        const userData = await res.json();
                        if (mounted) setUser(userData);
                    } else {
                        localStorage.removeItem('kanji_user_initials');
                        if (mounted) setUser(null);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            if (mounted) setLoading(false);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const backendUser = await syncUserWithBackend(session.user);
                if (mounted && backendUser) setUser({ ...session.user, ...backendUser });
            } else {
                if (mounted && !localStorage.getItem('kanji_user_initials')) setUser(null);
            }
        });

        initSession();

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const loginWithGoogle = async () => {
        // Explicitly use the current window origin (e.g. http://localhost:8080)
        const redirectTo = window.location.origin;
        console.log('Logging in with Google, redirecting to:', redirectTo);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo
            }
        });
        if (error) console.error('Google login error:', error.message);
    };

    const loginLegacy = async (initials, password) => {
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initials, password })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Login failed');
            }

            const userData = await res.json();
            setUser(userData);
            localStorage.setItem('kanji_user_initials', userData.initials);
            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, error: err.message };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('kanji_user_initials');
        setUser(null);
    };

    const updateSettings = async (chunkSize) => {
        if (!user || !user.initials) return;
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
        <UserContext.Provider value={{ user, loading, loginWithGoogle, loginLegacy, logout, updateSettings }}>
            {children}
        </UserContext.Provider>
    );
}
