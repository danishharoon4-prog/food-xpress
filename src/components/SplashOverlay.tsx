import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Premium animated splash — shown ONLY on native mobile app (Android/iOS).
 * Skipped entirely on web. Displays once per app session.
 */
export function SplashOverlay() {
  const isNative =
    typeof window !== 'undefined' &&
    (Capacitor?.isNativePlatform?.() ?? false);

  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!(Capacitor?.isNativePlatform?.() ?? false)) return false;
    return !sessionStorage.getItem('splash_shown');
  });

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem('splash_shown', '1');
    const t = setTimeout(() => setVisible(false), 5200);
    return () => clearTimeout(t);
  }, [visible]);

  if (!isNative || !visible) return null;

  return (
    <div className="fx-splash fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      {/* Animated gradient backdrop */}
      <div className="fx-splash-bg absolute inset-0" />
      {/* Glow orbs */}
      <div className="fx-orb fx-orb-1" />
      <div className="fx-orb fx-orb-2" />
      <div className="fx-orb fx-orb-3" />

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-5 select-none px-8">
        {/* Ring loader around monogram */}
        <div className="fx-ring-wrap">
          <div className="fx-ring" />
          <div className="fx-ring fx-ring-2" />
          <div className="fx-monogram">
            <span>FX</span>
          </div>
        </div>

        <h1 className="fx-title font-black tracking-tight text-white text-5xl sm:text-6xl md:text-7xl text-center">
          <span className="fx-word">FOOD</span>{' '}
          <span className="fx-word fx-word-2">EXPRESS</span>
        </h1>

        <p className="fx-tagline text-white/90 text-sm sm:text-base tracking-[0.35em] uppercase">
          Fast • Fresh • Delivered
        </p>

        <div className="fx-bar" />
      </div>

      <style>{`
        .fx-splash-bg {
          background:
            radial-gradient(circle at 20% 20%, #ffb347 0%, transparent 45%),
            radial-gradient(circle at 80% 30%, #ff3d7f 0%, transparent 50%),
            radial-gradient(circle at 50% 90%, #ff6f00 0%, transparent 55%),
            linear-gradient(135deg, #ff6f00 0%, #e53935 55%, #b91c1c 100%);
          background-size: 200% 200%;
          animation: fxGradientShift 6s ease-in-out infinite;
        }
        @keyframes fxGradientShift {
          0%, 100% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; }
          50% { background-position: 100% 50%, 0% 50%, 50% 0%, 100% 100%; }
        }

        .fx-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(60px);
          opacity: 0.55;
          animation: fxFloat 7s ease-in-out infinite;
        }
        .fx-orb-1 { width: 260px; height: 260px; background: #ffd27a; top: -60px; left: -60px; }
        .fx-orb-2 { width: 320px; height: 320px; background: #ff3d7f; bottom: -80px; right: -80px; animation-delay: 1.2s; }
        .fx-orb-3 { width: 200px; height: 200px; background: #ffffff; top: 40%; left: 60%; opacity: 0.25; animation-delay: 2.4s; }
        @keyframes fxFloat {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(20px,-25px) scale(1.08); }
        }

        .fx-ring-wrap {
          position: relative;
          width: 130px;
          height: 130px;
          display: grid;
          place-items: center;
          animation: fxPopIn 0.7s cubic-bezier(.2,.9,.2,1.2) both;
        }
        .fx-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 3px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          animation: fxSpin 1.2s linear infinite;
        }
        .fx-ring-2 {
          inset: 10px;
          border: 2px solid rgba(255,255,255,0.15);
          border-bottom-color: #fff;
          animation: fxSpin 1.8s linear infinite reverse;
        }
        .fx-monogram {
          width: 92px; height: 92px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.14);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.35);
          display: grid; place-items: center;
          color: #fff;
          font-weight: 900;
          font-size: 32px;
          letter-spacing: 0.02em;
          box-shadow: 0 20px 45px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4);
          animation: fxPulse 2.2s ease-in-out infinite;
        }
        @keyframes fxSpin { to { transform: rotate(360deg); } }
        @keyframes fxPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 20px 45px rgba(0,0,0,0.25), 0 0 0 0 rgba(255,255,255,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 20px 45px rgba(0,0,0,0.35), 0 0 0 18px rgba(255,255,255,0); }
        }

        .fx-title {
          text-shadow: 0 6px 24px rgba(0,0,0,0.25);
        }
        .fx-word {
          display: inline-block;
          animation: fxWordIn 0.9s cubic-bezier(.2,.7,.2,1) both;
        }
        .fx-word-2 {
          animation-delay: 0.3s;
          background: linear-gradient(180deg,#fff 0%,#ffe6b3 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        @keyframes fxWordIn {
          0% { opacity: 0; transform: translateY(28px) scale(0.92); letter-spacing: 0.5em; filter: blur(6px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: -0.01em; }
        }

        .fx-tagline {
          opacity: 0;
          animation: fxFadeUp 0.8s ease-out 0.9s both;
        }
        @keyframes fxFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 0.9; transform: translateY(0); }
        }

        .fx-bar {
          margin-top: 4px;
          height: 4px;
          width: 0;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(255,255,255,0.3), #fff, rgba(255,255,255,0.3));
          box-shadow: 0 0 20px rgba(255,255,255,0.6);
          animation: fxBar 1.4s cubic-bezier(.2,.7,.2,1) 1.1s forwards;
        }
        @keyframes fxBar {
          0% { width: 0; opacity: 0.4; }
          100% { width: 180px; opacity: 1; }
        }

        @keyframes fxPopIn {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }

        .fx-splash {
          animation: fxSplashOut 5.2s ease-in-out forwards;
        }
        @keyframes fxSplashOut {
          0%, 88% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
