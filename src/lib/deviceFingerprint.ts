// Simple non-tracking device fingerprint — combines a few stable client hints.
// Not for anti-fraud; only to distinguish "same browser" vs "new browser".
export function getDeviceFingerprint(): string {
  try {
    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < parts.length; i++) {
      hash = ((hash << 5) - hash) + parts.charCodeAt(i);
      hash |= 0;
    }
    return 'fp_' + Math.abs(hash).toString(36);
  } catch {
    return 'fp_unknown';
  }
}
