export function isLovablePreviewNotificationContext() {
  if (typeof window === 'undefined') return false;

  let embedded = false;
  try {
    embedded = window.self !== window.top;
  } catch {
    embedded = true;
  }

  const host = window.location.hostname;
  const previewHost =
    host.startsWith('id-preview--') ||
    host.startsWith('preview--') ||
    host.endsWith('.lovableproject.com') ||
    host.endsWith('.lovableproject-dev.com');

  return embedded || previewHost;
}

export function openNotificationPermissionTab() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('enableNotifications', '1');
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}