import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, TrendingUp, MessageSquare, Award, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type RatingRow = {
  id: string;
  rider_rating: number | null;
  review_text: string | null;
  created_at: string;
  order_id: string;
  customer_id: string | null;
  customer_name?: string;
  order_number?: string;
};

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${px} ${i <= Math.round(value) ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

export default function RiderRatings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingRow[]>([]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!rider) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('ratings')
      .select('id, rider_rating, review_text, created_at, order_id, customer_id')
      .eq('rider_id', rider.id)
      .not('rider_rating', 'is', null)
      .order('created_at', { ascending: false });

    const rows = (data || []) as RatingRow[];

    // Fetch customer names + order numbers
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean))) as string[];
    const orderIds = Array.from(new Set(rows.map((r) => r.order_id)));

    const [{ data: profiles }, { data: orders }] = await Promise.all([
      customerIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', customerIds)
        : Promise.resolve({ data: [] as any[] }),
      orderIds.length
        ? supabase.from('orders').select('id, order_number').in('id', orderIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    const orderMap = new Map((orders || []).map((o: any) => [o.id, o.order_number]));

    setRatings(
      rows.map((r) => ({
        ...r,
        customer_name: (r.customer_id && nameMap.get(r.customer_id)) || 'Customer',
        order_number: orderMap.get(r.order_id) || '',
      })),
    );
    setLoading(false);
  };

  const { avg, total, distribution, reviewsCount } = useMemo(() => {
    const scores = ratings.map((r) => Number(r.rider_rating || 0)).filter((n) => n > 0);
    const total = scores.length;
    const avg = total ? scores.reduce((a, b) => a + b, 0) / total : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: scores.filter((s) => Math.round(s) === star).length,
    }));
    const reviewsCount = ratings.filter((r) => r.review_text && r.review_text.trim()).length;
    return { avg, total, distribution, reviewsCount };
  }, [ratings]);

  const badge = useMemo(() => {
    if (avg >= 4.8) return { label: 'Top Rated', tone: 'gradient-primary text-primary-foreground' };
    if (avg >= 4.5) return { label: 'Excellent', tone: 'bg-success text-success-foreground' };
    if (avg >= 4.0) return { label: 'Great', tone: 'bg-info text-info-foreground' };
    if (avg > 0) return { label: 'Getting Started', tone: 'bg-muted text-foreground' };
    return null;
  }, [avg]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-display font-bold">Ratings & Reviews</h2>
          <p className="text-muted-foreground text-sm mt-1">
            See what customers are saying about your deliveries.
          </p>
        </div>
        {badge && (
          <Badge className={`${badge.tone} px-4 py-1.5 text-sm font-semibold shadow-md`}>
            <Award className="w-4 h-4 mr-1.5" />
            {badge.label}
          </Badge>
        )}
      </div>

      {/* Summary hero */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="gradient-hero p-6 md:p-8">
          <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center">
            <div className="text-center md:text-left">
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-6xl md:text-7xl font-display font-bold text-gradient-gold">
                  {avg.toFixed(1)}
                </span>
                <span className="text-xl text-muted-foreground font-medium">/5</span>
              </div>
              <div className="mt-2 flex justify-center md:justify-start">
                <Stars value={avg} size="lg" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on <span className="font-semibold text-foreground">{total}</span> rating{total === 1 ? '' : 's'}
              </p>
            </div>

            <div className="space-y-2">
              {distribution.map(({ star, count }) => {
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-10 text-sm font-medium">
                      {star}
                      <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    </div>
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground">Total Ratings</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{reviewsCount}</div>
              <div className="text-xs text-muted-foreground">Written Reviews</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-lift col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">
                {total ? Math.round((distribution[0].count / total) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">5-Star Deliveries</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Recent Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ratings.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No ratings yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete deliveries to start collecting customer ratings.
              </p>
            </div>
          )}

          {ratings.map((r) => {
            const initials = (r.customer_name || 'C')
              .split(' ')
              .map((s) => s[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <div
                key={r.id}
                className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm">{r.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.order_number ? `Order #${r.order_number} · ` : ''}
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <Stars value={Number(r.rider_rating || 0)} />
                    </div>
                    {r.review_text && r.review_text.trim() ? (
                      <p className="text-sm mt-2 text-foreground/90 leading-relaxed">
                        "{r.review_text}"
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground mt-2">
                        No written review
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
