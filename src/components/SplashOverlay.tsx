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
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem('splash_shown', '1');
    const exitT = setTimeout(() => setExiting(true), 5200);
    const hideT = setTimeout(() => setVisible(false), 6000);
    return () => {
      clearTimeout(exitT);
      clearTimeout(hideT);
    };
  }, [visible]);

  if (!isNative || !visible) return null;

  return (
    <div
      className={`fx-splash fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${
        exiting ? 'fx-exit' : ''
      }`}
    >
      {/* Animated conic gradient backdrop */}
      <div className="fx-splash-bg absolute inset-0" />
      <div className="fx-splash-conic absolute inset-0" />
      <div className="fx-noise absolute inset-0" />

      {/* Floating glow orbs */}
      <div className="fx-orb fx-orb-1" />
      <div className="fx-orb fx-orb-2" />
      <div className="fx-orb fx-orb-3" />
      <div className="fx-orb fx-orb-4" />

      {/* Floating sparkles */}
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className={`fx-spark fx-spark-${i + 1}`} />
      ))}

      {/* Rising food emojis */}
      <span className="fx-emoji fx-emoji-1">🍔</span>
      <span className="fx-emoji fx-emoji-2">🍕</span>
      <span className="fx-emoji fx-emoji-3">🌮</span>
      <span className="fx-emoji fx-emoji-4">🍟</span>
      <span className="fx-emoji fx-emoji-5">🥤</span>
      <span className="fx-emoji fx-emoji-6">🍩</span>

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-6 select-none px-8">
        {/* Rings + monogram */}
        <div className="fx-ring-wrap">
          <div className="fx-pulse-halo" />
          <div className="fx-pulse-halo fx-pulse-halo-2" />
          <div className="fx-ring" />
          <div className="fx-ring fx-ring-2" />
          <div className="fx-ring fx-ring-3" />
          <div className="fx-monogram">
            <span className="fx-monogram-text">FX</span>
            <span className="fx-monogram-shine" />
          </div>
          {/* Orbiting dots */}
          <div className="fx-orbit">
            <span className="fx-orbit-dot" />
          </div>
          <div className="fx-orbit fx-orbit-rev">
            <span className="fx-orbit-dot fx-orbit-dot-2" />
          </div>
        </div>

        <h1 className="fx-title font-black tracking-tight text-white text-5xl sm:text-6xl md:text-7xl text-center">
          {'FOOD'.split('').map((c, i) => (
            <span
              key={`f-${i}`}
              className="fx-letter"
              style={{ animationDelay: `${0.1 + i * 0.08}s` }}
            >
              {c}
            </span>
          ))}
          <span className="inline-block w-3 sm:w-4" />
          {'EXPRESS'.split('').map((c, i) => (
            <span
              key={`e-${i}`}
              className="fx-letter fx-letter-gold"
              style={{ animationDelay: `${0.55 + i * 0.07}s` }}
            >
              {c}
            </span>
          ))}
        </h1>

        <p className="fx-tagline text-white/95 text-sm sm:text-base tracking-[0.4em] uppercase">
          Fast • Fresh • Delivered
        </p>

        <div className="fx-bar-wrap">
          <div className="fx-bar" />
        </div>
      </div>

      <style>{`
        .fx-splash-bg {
          background: linear-gradient(135deg, #ff6f00 0%, #e53935 55%, #b91c1c 100%);
        }
        .fx-splash-conic {
          background: conic-gradient(from 0deg at 50% 50%,
            #ff8a00 0deg,
            #ff3d7f 90deg,
            #b91c1c 180deg,
            #ff6f00 270deg,
            #ff8a00 360deg);
          opacity: 0.55;
          filter: blur(40px);
          animation: fxConic 8s linear infinite;
        }
        @keyframes fxConic { to { transform: rotate(360deg); } }

        .fx-noise {
          background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 3px 3px;
          opacity: 0.35;
          mix-blend-mode: overlay;
        }

        .fx-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.6;
          animation: fxFloat 6s ease-in-out infinite;
        }
        .fx-orb-1 { width: 280px; height: 280px; background: #ffd27a; top: -80px; left: -80px; }
        .fx-orb-2 { width: 340px; height: 340px; background: #ff3d7f; bottom: -100px; right: -100px; animation-delay: 1.2s; }
        .fx-orb-3 { width: 220px; height: 220px; background: #ffffff; top: 40%; left: 65%; opacity: 0.3; animation-delay: 2.4s; }
        .fx-orb-4 { width: 180px; height: 180px; background: #6c5ce7; top: 55%; left: -40px; opacity: 0.4; animation-delay: 3.2s; }
        @keyframes fxFloat {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(30px,-30px) scale(1.12); }
        }

        /* Sparkles */
        .fx-spark {
          position: absolute;
          width: 6px; height: 6px;
          background: #fff;
          border-radius: 9999px;
          box-shadow: 0 0 12px #fff, 0 0 24px #ffd27a;
          opacity: 0;
          animation: fxSparkle 3.2s ease-in-out infinite;
        }
        ${Array.from({ length: 14 })
          .map((_, i) => {
            const top = (i * 37) % 95;
            const left = (i * 53) % 95;
            const delay = ((i * 0.27) % 3).toFixed(2);
            const scale = (0.6 + ((i * 0.13) % 1.2)).toFixed(2);
            return `.fx-spark-${i + 1} { top: ${top}%; left: ${left}%; animation-delay: ${delay}s; transform: scale(${scale}); }`;
          })
          .join('\n')}
        @keyframes fxSparkle {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1.4); }
        }

        /* Rising food emojis */
        .fx-emoji {
          position: absolute;
          bottom: -60px;
          font-size: 34px;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));
          animation: fxRise 5.5s ease-in infinite;
          opacity: 0;
        }
        .fx-emoji-1 { left: 8%;  animation-delay: 0.2s; }
        .fx-emoji-2 { left: 24%; animation-delay: 1.4s; font-size: 40px; }
        .fx-emoji-3 { left: 42%; animation-delay: 0.8s; }
        .fx-emoji-4 { left: 62%; animation-delay: 2.0s; font-size: 38px; }
        .fx-emoji-5 { left: 78%; animation-delay: 1.0s; }
        .fx-emoji-6 { left: 90%; animation-delay: 2.6s; font-size: 32px; }
        @keyframes fxRise {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
        }

        /* Ring stack */
        .fx-ring-wrap {
          position: relative;
          width: 160px;
          height: 160px;
          display: grid;
          place-items: center;
          animation: fxPopIn 0.9s cubic-bezier(.2,.9,.2,1.3) both;
        }
        .fx-pulse-halo {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 65%);
          animation: fxHalo 2.4s ease-out infinite;
        }
        .fx-pulse-halo-2 { animation-delay: 1.2s; }
        @keyframes fxHalo {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .fx-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 3px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          animation: fxSpin 1.4s linear infinite;
        }
        .fx-ring-2 {
          inset: 12px;
          border: 2px solid rgba(255,255,255,0.18);
          border-bottom-color: #fff;
          animation: fxSpin 2s linear infinite reverse;
        }
        .fx-ring-3 {
          inset: 24px;
          border: 2px dashed rgba(255,255,255,0.25);
          animation: fxSpin 6s linear infinite;
        }
        .fx-monogram {
          position: relative;
          width: 100px; height: 100px;
          border-radius: 9999px;
          background: linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.10));
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1.5px solid rgba(255,255,255,0.5);
          display: grid; place-items: center;
          color: #fff;
          overflow: hidden;
          box-shadow: 0 20px 45px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.5);
          animation: fxPulse 2.2s ease-in-out infinite;
        }
        .fx-monogram-text {
          font-weight: 900;
          font-size: 36px;
          letter-spacing: 0.02em;
          text-shadow: 0 2px 10px rgba(0,0,0,0.25);
        }
        .fx-monogram-shine {
          position: absolute;
          top: 0; left: -60%;
          width: 60%; height: 100%;
          background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
          transform: skewX(-20deg);
          animation: fxShine 2.6s ease-in-out infinite;
        }
        @keyframes fxShine {
          0%   { left: -70%; }
          60%  { left: 130%; }
          100% { left: 130%; }
        }
        @keyframes fxSpin { to { transform: rotate(360deg); } }
        @keyframes fxPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 20px 45px rgba(0,0,0,0.25), 0 0 0 0 rgba(255,255,255,0.4); }
          50% { transform: scale(1.07); box-shadow: 0 24px 55px rgba(0,0,0,0.35), 0 0 0 22px rgba(255,255,255,0); }
        }

        /* Orbiting dots */
        .fx-orbit {
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          animation: fxSpin 3.2s linear infinite;
        }
        .fx-orbit-rev { animation: fxSpin 4.6s linear infinite reverse; inset: -14px; }
        .fx-orbit-dot {
          position: absolute;
          top: -4px; left: 50%;
          transform: translateX(-50%);
          width: 10px; height: 10px;
          background: #fff;
          border-radius: 9999px;
          box-shadow: 0 0 12px #fff, 0 0 24px #ffd27a;
        }
        .fx-orbit-dot-2 { background: #ffd27a; box-shadow: 0 0 12px #ffd27a, 0 0 24px #ff3d7f; width: 8px; height: 8px; }

        /* Title letters */
        .fx-title { text-shadow: 0 6px 24px rgba(0,0,0,0.30); }
        .fx-letter {
          display: inline-block;
          opacity: 0;
          transform: translateY(30px) rotateX(-90deg) scale(0.8);
          transform-origin: 50% 100%;
          animation: fxLetterIn 0.7s cubic-bezier(.2,.7,.2,1.3) forwards;
        }
        .fx-letter-gold {
          background: linear-gradient(180deg, #fff 0%, #ffe6b3 60%, #ffb347 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        @keyframes fxLetterIn {
          0%   { opacity: 0; transform: translateY(30px) rotateX(-90deg) scale(0.8); filter: blur(6px); }
          60%  { opacity: 1; filter: blur(0); transform: translateY(-4px) rotateX(0deg) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
        }

        /* Tagline */
        .fx-tagline {
          opacity: 0;
          animation: fxFadeUp 0.9s ease-out 1.4s both, fxTagPulse 2s ease-in-out 2.3s infinite;
        }
        @keyframes fxFadeUp {
          from { opacity: 0; transform: translateY(12px) letter-spacing: 0.6em; }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fxTagPulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.55; }
        }

        /* Loading bar */
        .fx-bar-wrap {
          margin-top: 6px;
          height: 5px;
          width: 200px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.18);
          overflow: hidden;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
          opacity: 0;
          animation: fxFadeUp 0.6s ease-out 1.6s forwards;
        }
        .fx-bar {
          height: 100%;
          width: 0;
          background: linear-gradient(90deg, #ffd27a, #fff, #ff3d7f, #fff, #ffd27a);
          background-size: 200% 100%;
          border-radius: 9999px;
          box-shadow: 0 0 20px rgba(255,255,255,0.7);
          animation: fxBarFill 3.4s cubic-bezier(.4,0,.2,1) 1.7s forwards, fxBarShimmer 1.6s linear infinite 1.7s;
        }
        @keyframes fxBarFill {
          0%   { width: 0; }
          100% { width: 100%; }
        }
        @keyframes fxBarShimmer {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes fxPopIn {
          from { opacity: 0; transform: scale(0.5) rotate(-20deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        /* Exit */
        .fx-exit { animation: fxSplashOut 0.8s cubic-bezier(.6,0,.4,1) forwards; }
        @keyframes fxSplashOut {
          0%   { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: 0; transform: scale(1.15); filter: blur(12px); visibility: hidden; }
        }
      `}</style>
    </div>
  );
}
