import DownloadApkButton from "@/components/DownloadApkButton";
import AddToHomeScreenButton, {
  isIOSDevice,
  isStandaloneApp,
} from "@/components/AddToHomeScreenButton";

type Props = {
  size?: "default" | "sm" | "lg";
  className?: string;
  androidLabel?: string;
  iosLabel?: string;
  showVersion?: boolean;
};

/** iPhone/iPad par "Add to Home Screen" guide, baqi sab par APK download. */
export default function InstallAppCta({
  size = "lg",
  className,
  androidLabel = "Download Android App",
  iosLabel = "Add to Home Screen",
  showVersion = false,
}: Props) {
  if (isStandaloneApp()) return null;

  if (isIOSDevice()) {
    return <AddToHomeScreenButton size={size} className={className} label={iosLabel} />;
  }

  return <DownloadApkButton size={size} className={className} label={androidLabel} showVersion={showVersion} />;
}
