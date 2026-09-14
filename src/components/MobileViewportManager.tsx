import { useEffect } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

const KEYBOARD_THRESHOLD = 140;
const MOBILE_LAYOUT_MAX_WIDTH = 1023;

export default function MobileViewportManager() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const updateViewport = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const keyboardHeight = Math.max(0, window.innerHeight - visibleHeight - viewportTop);
      const active = document.activeElement;
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable);

      root.style.setProperty('--app-visible-height', `${visibleHeight}px`);

      // Android WebView can resize both window.innerHeight and visualViewport,
      // which makes keyboardHeight report zero. On mobile layouts, focused
      // editable fields are therefore the reliable fallback signal.
      const isMobileLayout = window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH;
      const keyboardOpen = isEditable && (keyboardHeight > KEYBOARD_THRESHOLD || isMobileLayout);
      root.classList.toggle('mobile-keyboard-open', keyboardOpen);
    };

    const onFocusChange = () => window.setTimeout(updateViewport, 50);
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);

    if (Capacitor.isNativePlatform()) {
      root.classList.add('native-app');
      void SystemBars.show().catch(() => undefined);
      void SystemBars.setStyle({ style: SystemBarsStyle.Default }).catch(() => undefined);
    }

    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
      root.classList.remove('mobile-keyboard-open');
    };
  }, []);

  return null;
}