'use client';

import { useEffect } from 'react';

/** Servis çalışanını yalnızca üretimde kaydeder (geliştirmede önbellek karışıklığı yaratır). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Kayıt başarısız olursa uygulama normal çalışmaya devam eder.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
