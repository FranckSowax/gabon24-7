import { useState, useEffect, useCallback } from 'react';

export function useDailyUsage(userId: string | undefined, limit: number) {
  const [count, setCount] = useState(0);
  
  const getStorageKey = useCallback(() => {
    if (!userId) return null;
    const today = new Date().toISOString().split('T')[0];
    return `gabon24_usage_${userId}_${today}`;
  }, [userId]);

  const updateCount = useCallback(() => {
    const key = getStorageKey();
    if (key) {
      const stored = localStorage.getItem(key);
      setCount(stored ? parseInt(stored, 10) : 0);
    }
  }, [getStorageKey]);

  useEffect(() => {
    updateCount();
    // Listen for storage events (cross-tab) and custom events (same-tab)
    const handleStorageChange = () => updateCount();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('gabon24_usage_updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('gabon24_usage_updated', handleStorageChange);
    };
  }, [updateCount]);

  const increment = useCallback(() => {
    if (!userId) return;
    const key = getStorageKey();
    if (key) {
      const current = parseInt(localStorage.getItem(key) || '0', 10);
      const newCount = current + 1;
      localStorage.setItem(key, newCount.toString());
      // Dispatch custom event to notify other instances
      window.dispatchEvent(new Event('gabon24_usage_updated'));
      setCount(newCount);
    }
  }, [userId, getStorageKey]);

  const checkAccess = useCallback(() => {
    if (!userId) return false;
    const key = getStorageKey();
    if (!key) return false;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    return limit === -1 || current < limit; // -1 means unlimited
  }, [userId, limit, getStorageKey]);

  const hasReachedLimit = limit > -1 && count >= limit;

  return { count, increment, hasReachedLimit, checkAccess };
}
