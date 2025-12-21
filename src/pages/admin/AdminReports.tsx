import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function AdminReports() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reports</h2>

      <Card>
        <CardContent className="py-10 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Reports dashboard coming soon.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Daily/weekly/monthly order reports, revenue breakdown, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
