import { useEffect, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import lottieAsset from "@/assets/delivery.lottie.asset.json";

const DURATION_MS = 3000;

function isNativeApp() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return (
    !!w.Capacitor?.isNativePlatform?.() ||
    /(capacitor|android|ios)/i.test(w.location?.protocol || "") ||
    w.location?.protocol === "capacitor:"
  );
}

export function SplashOverlay() {
  const [show, setShow] = useState(() => isNativeApp());
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (!show) return;
    const fadeT = setTimeout(() => setFade(true), DURATION_MS - 400);
    const hideT = setTimeout(() => setShow(false), DURATION_MS);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(hideT);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "linear-gradient(135deg,#fff7f0 0%,#ffe4d1 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fade ? 0 : 1,
        transition: "opacity 400ms ease-out",
      }}
    >
      <div style={{ width: "min(80vw, 380px)", aspectRatio: "1 / 1" }}>
        <DotLottieReact src={lottieAsset.url} autoplay loop />
      </div>
    </div>
  );
}

export default SplashOverlay;
