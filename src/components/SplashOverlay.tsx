import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import splashVideo from '@/assets/splash.mp4.asset.json';

/**
 * Video splash — shown ONLY on native mobile app (Android/iOS).
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem('splash_shown', '1');
    // Safety fallback in case video fails/never ends
    const maxT = setTimeout(() => setExiting(true), 8000);
    const hideT = setTimeout(() => setVisible(false), 8800);
    return () => {
      clearTimeout(maxT);
      clearTimeout(hideT);
    };
  }, [visible]);

  const handleEnded = () => {
    setExiting(true);
    setTimeout(() => setVisible(false), 600);
  };

  if (!isNative || !visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
