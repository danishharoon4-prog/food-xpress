import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Gauge } from "lucide-react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useToast } from "@/hooks/use-toast";

export function MotionSettings() {
  const { motionEnabled, reduceMotion, setMotionEnabled, setReduceMotion } =
    useMotionPreference();
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Motion &amp; Animations
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Control page transitions, hover effects and scroll reveals across the app.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="motion-enabled" className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="w-4 h-4" /> Enable animations
            </Label>
            <p className="text-xs text-muted-foreground">
              Turn off to disable every animation and transition in the app.
            </p>
          </div>
          <Switch
            id="motion-enabled"
            checked={motionEnabled}
            onCheckedChange={(v) => {
              setMotionEnabled(v);
              toast({
                title: v ? "Animations enabled" : "Animations disabled",
                description: v
                  ? "You'll see full motion across the app."
                  : "All animations and transitions are now off.",
              });
            }}
          />
        </div>

        <div className="flex items-start justify-between gap-4 pt-1 border-t">
          <div className="space-y-0.5 pt-4">
            <Label htmlFor="reduce-motion" className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="w-4 h-4" /> Reduced motion
            </Label>
            <p className="text-xs text-muted-foreground">
              Override your device setting — keep essential fades but remove movement,
              blur and scale effects.
            </p>
          </div>
          <Switch
            id="reduce-motion"
            className="mt-4"
            checked={reduceMotion}
            disabled={!motionEnabled}
            onCheckedChange={(v) => {
              setReduceMotion(v);
              toast({
                title: v ? "Reduced motion on" : "Reduced motion off",
              });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
