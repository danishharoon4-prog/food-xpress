import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { META_PIXEL_ID, initMetaPixel, pixelTrack } from "@/lib/metaPixel";

/** Loads the Meta Pixel and fires a PageView on every route change. */
const MetaPixel = () => {
  const location = useLocation();

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    pixelTrack("PageView");
  }, [location.pathname]);

  return null;
};

export default MetaPixel;
