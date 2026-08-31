import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';

export function useAntiCheat(isActive = true) {
    const { notify } = useNotification();
    const [isBlurred, setIsBlurred] = useState(false);
    const [violations, setViolations] = useState(0);
    
    const violationsRef = useRef(0);
    const hasLeftRef = useRef(false);
    const lastWarnedTimeRef = useRef(0);

    const onUserLeft = useCallback(() => {
        if (!isActive) return;
        setIsBlurred(true);
        hasLeftRef.current = true;
    }, [isActive]);

    const onUserReturned = useCallback(() => {
        if (!isActive) return;
        setIsBlurred(false);

        const now = Date.now();
        // Prevent duplicate events within 2.5 seconds
        if (hasLeftRef.current && (now - lastWarnedTimeRef.current > 2500)) {
            hasLeftRef.current = false;
            lastWarnedTimeRef.current = now;

            violationsRef.current += 1;
            const newCount = violationsRef.current;
            setViolations(newCount);

            if (newCount <= 3) {
                notify({
                    type: 'error',
                    title: `ANTI-CHEAT WARNING (${newCount}/3)`,
                    message: 'You left the application screen! 3 violations will result in automatic exit.',
                    duration: 7000,
                });
            }
        }
    }, [isActive, notify]);

    const handleVisibilityChange = useCallback(() => {
        if (document.hidden) {
            onUserLeft();
        } else {
            onUserReturned();
        }
    }, [onUserLeft, onUserReturned]);

    const handleBlur = useCallback(() => {
        onUserLeft();
    }, [onUserLeft]);

    const handleFocus = useCallback(() => {
        onUserReturned();
    }, [onUserReturned]);

    const handleKeyDown = useCallback((e) => {
        if (!isActive) return;
        
        // Prevent PrintScreen or common screenshot shortcuts
        if (e.key === 'PrintScreen' || (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's'))) {
            e.preventDefault();
            try {
                navigator.clipboard.writeText('');
            } catch {}

            const now = Date.now();
            if (now - lastWarnedTimeRef.current > 2500) {
                lastWarnedTimeRef.current = now;
                violationsRef.current += 1;
                const newCount = violationsRef.current;
                setViolations(newCount);

                if (newCount <= 3) {
                    notify({
                        type: 'error',
                        title: `ANTI-CHEAT WARNING (${newCount}/3)`,
                        message: 'Screenshots are disabled during active sessions.',
                        duration: 7000,
                    });
                }
            }
        }
    }, [isActive, notify]);

    const handleCopy = useCallback((e) => {
        if (!isActive) return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastWarnedTimeRef.current > 2000) {
            lastWarnedTimeRef.current = now;
            notify({
                type: 'warning',
                title: 'ANTI-CHEAT',
                message: 'Copying code is disabled.',
                duration: 3000,
            });
        }
    }, [isActive, notify]);

    useEffect(() => {
        if (!isActive) return;

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('copy', handleCopy);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('copy', handleCopy);
        };
    }, [isActive, handleVisibilityChange, handleBlur, handleFocus, handleKeyDown, handleCopy]);

    return {
        isBlurred,
        violations,
    };
}
