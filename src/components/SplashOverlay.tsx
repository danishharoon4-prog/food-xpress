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
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use absolute CDN URL so the native WebView (capacitor:// / https://localhost)
  // can resolve the /__l5e/ Lovable asset path.
  const videoSrc = /^https?:\/\//.test(splashVideo.url)
    ? splashVideo.url
    : `https://food-xpress.lovable.app${splashVideo.url}`;

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem('splash_shown', '1');
    const maxT = setTimeout(() => setExiting(true), 8000);
    const hideT = setTimeout(() => setVisible(false), 8800);
    return () => {
      clearTimeout(maxT);
      clearTimeout(hideT);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => v.play().catch((e) => console.warn('[splash] play blocked', e));
    tryPlay();
  }, [visible]);

  const handleEnded = () => {
    setExiting(true);
    setTimeout(() => setVisible(false), 600);
  };

  const handleError = (e: any) => {
    console.warn('[splash] video failed to load', e, videoSrc);
    setFailed(true);
    setTimeout(() => setExiting(true), 1200);
    setTimeout(() => setVisible(false), 1800);
  };

  if (!isNative || !visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {!failed ? (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          muted
          playsInline
          // @ts-ignore - webkit attr for iOS inline
          webkit-playsinline="true"
          preload="auto"
          onEnded={handleEnded}
          onError={handleError}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-white text-center px-6">
          <div className="text-2xl font-bold mb-2">Food Xpress</div>
          <div className="text-sm opacity-70">Loading…</div>
        </div>
      )}
    </div>
  );
}
