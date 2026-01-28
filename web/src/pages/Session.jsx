import { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Loading from '../components/Loading';
import StudySession from '../components/StudySession';
import clickSound from '../assets/click-sound.mp3';

// Ensure kanjiData is accessible - Note: StudySession handles kanjiData internally now
// import kanjiDataRaw from '../data/jlpt-kanji.json';
// const kanjiData = kanjiDataRaw;

export default function Session() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startPhase, setStartPhase] = useState('learning');

    const playClick = () => {
        const audio = new Audio(clickSound);
        audio.currentTime = 0.55;
        audio.play().catch(e => console.error("Audio play failed:", e));
    };

    useEffect(() => {
        if (!location.state) {
            navigate('/dashboard');
        }
    }, [location, navigate]);

    // Load Words on Mount
    useEffect(() => {
        if (!user || !location.state) return;

        // Check if words were passed via navigation (e.g. Retry)
        if (location.state?.retryWords) {
            let wordsToUse = location.state.retryWords;
            // Shuffling for practice start is handled by component if we pass startPhase='practice'
            // However, StudySession expects 'words' prop to be the list.
            // If startPhase is practice, StudySession sets phase to practice.
            // But StudySession's handleStartPractice shuffles.
            // If we start in practice, we might want to shuffle upfront or let the component handle it?
            // The component initializes localWords = words.
            // If we start in practice, we usually want shuffled words.
            // Let's shuffle here if starting in practice, to be safe.
            if (location.state.startPhase === 'practice') {
                setStartPhase('practice');
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
                // Note: StudySession handles lookup, but we filter here to ensure quality
                // Since this logic mimics previous Session.jsx, let's keep it safe, 
                // although StudySession just returns empty details if not found.
                // Re-importing kanjiData just for this filter might be redundant but safe.
                // For now, let's assume the API returns valid words or rely on StudySession handling.
                // Previous logic filtered using kanjiData.
                // For simplicity and avoiding double import, let's trust the API or simple check.
                // Actually, let's just pass data.chunk directly.

                const startPhase = location.state?.startPhase;
                if (startPhase === 'practice') {
                    setStartPhase('practice');
                    const shuffled = [...data.chunk].sort(() => Math.random() - 0.5);
                    setWords(shuffled);
                } else {
                    setWords(data.chunk);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchWords();
    }, [user, location.state]);

    const handleComplete = (results, finalWords) => {
        const mode = location.state?.mode || 'new';
        navigate('/summary', { state: { results, words: finalWords, mode } });
    };

    const handleExit = () => {
        playClick();
        navigate('/dashboard');
    };

    if (!location.state) return null;
    if (loading) return <Loading message="Preparing Session..." />;

    return (
        <StudySession
            words={words}
            initialPhase={startPhase}
            onComplete={handleComplete}
            onExit={handleExit}
        />
    );
}
