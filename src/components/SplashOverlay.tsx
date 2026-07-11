import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import splashAsset from "@/assets/splash.gif.asset.json";

/**
 * Native-only splash overlay. Shows the branded GIF on app launch,
 * then fades out. Does not render on web.
 */
export default function SplashOverlay() {
  const isNative = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.();
  const [visible, setVisible] = useState(isNative);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    const fadeTimer = setTimeout(() => setFading(true), 5000);
    const hideTimer = setTimeout(() => setVisible(false), 5600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [isNative]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 600ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <img
        src={splashAsset.url}
        alt="Food Express"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
}
