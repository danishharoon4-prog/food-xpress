import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, Bike, Shield, ArrowRight, MapPin, Clock, Star, ShoppingCart } from 'lucide-react';
import CustomerHeader from '@/components/CustomerHeader';

export default function Index() {
  const { user, role } = useAuth();

  // Redirect based on role
  if (user && role === 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome, Admin!</h1>
          <Link to="/admin">
            <Button className="gradient-primary">Go to Admin Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (user && role === 'rider') {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome, Rider!</h1>
          <Link to="/rider">
            <Button className="gradient-primary">Go to Rider Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />

      {/* Hero Section */}
      <section className="py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/20" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Delicious Food,
              <span className="text-primary"> Delivered Fast</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Order from your favorite local restaurants and get it delivered to your doorstep in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/restaurants">
                <Button size="lg" className="gradient-primary w-full sm:w-auto">
                  <UtensilsCrossed className="mr-2 h-5 w-5" />
                  Browse Restaurants
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              {!user && (
                <Link to="/auth?role=rider">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <Bike className="mr-2 h-5 w-5" />
                    Become a Rider
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-secondary/30">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-3 p-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Live Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Track your order in real-time on Google Maps
              </p>
            </div>
            <div className="text-center space-y-3 p-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Clock className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Fast Delivery</h3>
              <p className="text-muted-foreground text-sm">
                Get your food delivered in 30 minutes or less
              </p>
            </div>
            <div className="text-center space-y-3 p-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Star className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Top Rated</h3>
              <p className="text-muted-foreground text-sm">
                Only the best restaurants with verified reviews
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA for roles */}
      {!user && (
        <section className="py-16">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-accent border border-primary/20">
                <Bike className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Earn as a Rider</h3>
                <p className="text-muted-foreground mb-4">
                  Flexible hours, great earnings. PKR 150-400 per delivery.
                </p>
                <Link to="/auth?role=rider">
                  <Button variant="outline">Join as Rider</Button>
                </Link>
              </div>
              <div className="p-8 rounded-2xl bg-gradient-to-br from-secondary to-muted border">
                <Shield className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Partner with Us</h3>
                <p className="text-muted-foreground mb-4">
                  Grow your restaurant business with our platform.
                </p>
                <Link to="/auth?role=admin">
                  <Button variant="outline">Admin Login</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 FoodExpress. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
