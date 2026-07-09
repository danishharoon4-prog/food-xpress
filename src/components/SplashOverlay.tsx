import { useEffect, useState } from 'react';

/**
 * In-app animated splash. Shows once per app session on top of the UI.
 * Solid orange background, no image — only animated "FOOD EXPRESS" text.
 */
export function SplashOverlay() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('splash_shown');
  });

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem('splash_shown', '1');
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center animate-splash-out"
      style={{ backgroundColor: '#FF6F00' }}
    >
      <div className="flex flex-col items-center gap-3 select-none">
        <h1 className="splash-text text-white font-black tracking-tight text-5xl sm:text-6xl md:text-7xl">
          <span className="splash-word">FOOD</span>{' '}
          <span className="splash-word splash-word-2">EXPRESS</span>
        </h1>
        <div className="splash-bar h-1 rounded-full bg-white/70" />
      </div>

      <style>{`
        @keyframes splashWordIn {
          0% { opacity: 0; transform: translateY(24px) scale(0.9); letter-spacing: 0.5em; }
          60% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: -0.01em; }
        }
        @keyframes splashBar {
          0% { width: 0; opacity: 0; }
          40% { opacity: 1; }
          100% { width: 140px; opacity: 1; }
        }
        @keyframes splashOut {
          0%, 80% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        .splash-word {
          display: inline-block;
          animation: splashWordIn 0.7s cubic-bezier(.2,.7,.2,1) both;
        }
        .splash-word-2 { animation-delay: 0.25s; }
        .splash-bar { animation: splashBar 0.9s ease-out 0.4s both; }
        .animate-splash-out { animation: splashOut 1.8s ease-in-out forwards; }
      `}</style>
    </div>
  );
}
