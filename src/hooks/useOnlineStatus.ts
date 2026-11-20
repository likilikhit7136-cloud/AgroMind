import { useEffect, useState } from 'react';

const SIM_OFFLINE_KEY = 'plantwise_simulated_offline';

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIM_OFFLINE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = (next?: boolean) => {
    setSimulatedOffline((prev) => {
      const value = typeof next === 'boolean' ? next : !prev;
      try {
        localStorage.setItem(SIM_OFFLINE_KEY, String(value));
      } catch {
        // Ignore storage quota errors
      }
      return value;
    });
  };

  return {
    isOnline: browserOnline && !simulatedOffline,
    browserOnline,
    simulatedOffline,
    toggleSimulatedOffline,
  };
}
