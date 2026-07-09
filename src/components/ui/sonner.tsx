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
      richColors
      closeButton
      offset={isMobile ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : 16}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:animate-scale-in group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3.5 group-[.toaster]:text-[15px] group-[.toaster]:font-medium",
          title: "group-[.toast]:text-[15px] group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[13px] group-[.toast]:leading-snug",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[hsl(var(--success))]",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive",
          warning: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[hsl(var(--warning))]",
          info: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[hsl(var(--info))]",
        },
      }}
      {...props}
    />
  );
};


export { Toaster, toast };
