import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const RELOAD_GUARD_KEY = "fx-mobile-live-reload-at";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RELOAD_GUARD_MS = 45 * 1000;

function getAssetSignatureFromDocument(doc: Document): string {
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
    .map((script) => script.getAttribute("src") || "")
    .filter(Boolean);

  const styles = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
    .map((link) => link.getAttribute("href") || "")
    .filter(Boolean);

  return [...scripts, ...styles].sort().join("|");
}

function isTypingNow(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tagName = active.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || active.hasAttribute("contenteditable");
}

function wasRecentlyReloaded(): boolean {
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
  return Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS;
}

function refreshCurrentRoute() {
  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("fx_app_refresh", String(Date.now()));
  window.location.replace(nextUrl.toString());
}

async function checkForPublishedUpdate() {
  if (!Capacitor.isNativePlatform()) return;
  if (document.visibilityState === "hidden") return;
  if (isTypingNow() || wasRecentlyReloaded()) return;

  const currentSignature = getAssetSignatureFromDocument(document);
  if (!currentSignature) return;

  const checkUrl = new URL("/", window.location.origin);
  checkUrl.searchParams.set("fx_update_check", String(Date.now()));

  try {
    const response = await fetch(checkUrl.toString(), {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) return;

    const html = await response.text();
    const latestDoc = new DOMParser().parseFromString(html, "text/html");
    const latestSignature = getAssetSignatureFromDocument(latestDoc);

    if (latestSignature && latestSignature !== currentSignature) {
      refreshCurrentRoute();
    }
  } catch {
    // Network may be offline or blocked; silently try again next resume/check.
  }
}

/**
 * Native app helper: when the published website changes, Android/iOS WebView can
 * keep the old page alive in memory. This checks the latest published asset
 * bundle on app launch/resume and refreshes only when a new deployment exists.
 */
export default function MobileLiveUpdate() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initialTimer = window.setTimeout(checkForPublishedUpdate, 2500);
    const interval = window.setInterval(checkForPublishedUpdate, CHECK_INTERVAL_MS);

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        void checkForPublishedUpdate();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    let removeAppListener: (() => void) | undefined;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void checkForPublishedUpdate();
    }).then((handle) => {
      removeAppListener = () => {
        void handle.remove();
      };
    });

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibilityHandler);
      removeAppListener?.();
    };
  }, []);

  return null;
}