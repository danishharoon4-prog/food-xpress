import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share, Plus, Smartphone, CheckCircle2 } from "lucide-react";

export const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
};

export const isStandaloneApp = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true);

type Props = {
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  label?: string;
};

export default function AddToHomeScreenButton({
  size = "default",
  variant = "default",
  className,
  label = "Add to Home Screen",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Smartphone className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-center">iPhone par app install karein</DialogTitle>
            <DialogDescription className="text-center">
              Safari me sirf 3 tap — Food Xpress ka icon aapki home screen par aa jayega.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Safari me neeche
                <Share className="h-4 w-4 text-primary" />
                <b>Share</b> button tap karein
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Scroll kar ke
                <Plus className="h-4 w-4 text-primary" />
                <b>Add to Home Screen</b> chunein
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Upar right me <b>Add</b> tap karein
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </span>
            </li>
          </ol>

          <p className="text-center text-xs text-muted-foreground">
            Chrome par bhi option hai, magar behtar result Safari me milta hai.
          </p>

          <Button className="w-full" onClick={() => setOpen(false)}>
            Samajh gaya
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
