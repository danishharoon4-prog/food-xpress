import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isMobile ? "top-center" : "top-right"}
      closeButton
      offset={isMobile ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : 16}
      toastOptions={{
        duration: 3500,
        unstyled: false,
        classNames: {
          toast: [
            "group toast fx-toast",
            "group-[.toaster]:border-0",
            "group-[.toaster]:shadow-[0_10px_40px_-12px_rgba(255,111,0,0.45)]",
            "group-[.toaster]:animate-scale-in",
            "group-[.toaster]:rounded-2xl",
            "group-[.toaster]:px-4 group-[.toaster]:py-3.5",
            "group-[.toaster]:text-[15px] group-[.toaster]:font-medium",
            "group-[.toaster]:text-white",
            "group-[.toaster]:backdrop-blur",
          ].join(" "),
          title: "group-[.toast]:text-[15px] group-[.toast]:font-bold group-[.toast]:text-white",
          description: "group-[.toast]:text-white/85 group-[.toast]:text-[13px] group-[.toast]:leading-snug",
          icon: "group-[.toast]:text-white",
          closeButton:
            "group-[.toast]:bg-white/15 group-[.toast]:border-0 group-[.toast]:text-white hover:group-[.toast]:bg-white/25",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-[hsl(24,100%,45%)] group-[.toast]:rounded-lg group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-white/20 group-[.toast]:text-white group-[.toast]:rounded-lg",
        },
      }}
      style={
        {
          // gradient default — success/error/warning override below via CSS
          "--normal-bg": "linear-gradient(135deg, #FF8A00 0%, #FF6F00 55%, #E53935 100%)",
          "--normal-text": "#ffffff",
          "--normal-border": "transparent",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster, toast };
