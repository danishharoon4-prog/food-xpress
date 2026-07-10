import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Hand, Zap } from "lucide-react";
import { useNavPrefs } from "@/hooks/useNavPrefs";

export function NavigationSettings() {
  const { prefs, update } = useNavPrefs();

  const sensitivityLabel =
    prefs.swipeThreshold <= 40 ? "Very high"
    : prefs.swipeThreshold <= 60 ? "High"
    : prefs.swipeThreshold <= 90 ? "Medium"
    : prefs.swipeThreshold <= 120 ? "Low" : "Very low";

  const speedLabel =
    prefs.animationSpeed <= 0.5 ? "Very fast"
    : prefs.animationSpeed <= 0.85 ? "Fast"
    : prefs.animationSpeed <= 1.15 ? "Normal"
    : prefs.animationSpeed <= 1.6 ? "Slow" : "Very slow";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Hand className="w-5 h-5 text-primary" />
          Swipe &amp; Navigation
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Control bottom-nav swipe gestures and tab-switch animation speed.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="swipe-enabled" className="flex items-center gap-2 text-sm font-medium">
              <Hand className="w-4 h-4" /> Swipe to switch tabs
            </Label>
            <p className="text-xs text-muted-foreground">
              Swipe left/right anywhere on the screen to move between bottom-nav tabs.
            </p>
          </div>
          <Switch
            id="swipe-enabled"
            checked={prefs.swipeEnabled}
            onCheckedChange={(v) => update({ swipeEnabled: v })}
          />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Swipe sensitivity</Label>
            <span className="text-xs text-muted-foreground">
              {sensitivityLabel} · {prefs.swipeThreshold}px
            </span>
          </div>
          <Slider
            min={30}
            max={150}
            step={10}
            value={[160 - prefs.swipeThreshold]}
            disabled={!prefs.swipeEnabled}
            onValueChange={([v]) => update({ swipeThreshold: 160 - v })}
          />
          <p className="text-xs text-muted-foreground">
            Higher sensitivity means smaller swipes trigger a tab change.
          </p>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" /> Animation speed
            </Label>
            <span className="text-xs text-muted-foreground">
              {speedLabel} · {prefs.animationSpeed.toFixed(2)}x
            </span>
          </div>
          <Slider
            min={30}
            max={200}
            step={5}
            value={[Math.round(200 - prefs.animationSpeed * 100)]}
            onValueChange={([v]) =>
              update({ animationSpeed: Math.max(0.3, (200 - v) / 100) })
            }
          />
          <p className="text-xs text-muted-foreground">
            Controls how quickly pages fade during tab switches.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
