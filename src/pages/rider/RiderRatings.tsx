import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

export default function RiderRatings() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Ratings & Reviews</h2>
      <Card>
        <CardContent className="py-10 text-center">
          <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Your ratings and reviews will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
