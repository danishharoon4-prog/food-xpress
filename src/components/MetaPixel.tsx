import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { META_PIXEL_ID, initMetaPixel, pixelTrack } from "@/lib/metaPixel";

/** Ensures the Meta Pixel is loaded and fires a PageView on SPA route changes. */
const MetaPixel = () => {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    // index.html already fires the initial PageView
    if (first.current) {
      first.current = false;
      return;
    }
    pixelTrack("PageView");
  }, [location.pathname]);

  return null;
};

export default MetaPixel;
