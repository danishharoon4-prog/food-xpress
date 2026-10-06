import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import { Zap } from "lucide-react";
import { useNavPrefs } from "@/hooks/useNavPrefs";

export function NavigationSettings() {
  const { prefs, update } = useNavPrefs();

  const speedLabel =
    prefs.animationSpeed <= 0.5 ? "Very fast"
    : prefs.animationSpeed <= 0.85 ? "Fast"
    : prefs.animationSpeed <= 1.15 ? "Normal"
    : prefs.animationSpeed <= 1.6 ? "Slow" : "Very slow";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Navigation
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Control the tab-switch animation speed.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
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
