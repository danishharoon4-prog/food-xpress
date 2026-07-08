import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMotionPreference } from "@/hooks/useMotionPreference";


// Site-wide typography: Sora (display/headings) + Manrope (body)
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/300.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";

initMotionPreference();
createRoot(document.getElementById("root")!).render(<App />);

