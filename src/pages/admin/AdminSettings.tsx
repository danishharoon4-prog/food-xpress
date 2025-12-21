import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardContent className="py-10 text-center">
          <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Platform settings coming soon.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Delivery radius, pricing rules, commission rates, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
