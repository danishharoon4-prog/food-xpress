import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { NotificationsListener } from "@/components/NotificationsListener";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { patchSonnerForBrowserNotifications } from "@/lib/browserNotify";
import { PageTransition } from "@/components/PageTransition";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SplashOverlay } from "@/components/SplashOverlay";

patchSonnerForBrowserNotifications();

// Pages
import { Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { RoleGuard } from "@/components/RoleGuard";
import RoleLanding from "@/components/RoleLanding";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRestaurants from "./pages/admin/AdminRestaurants";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminRiders from "./pages/admin/AdminRiders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSupport from "./pages/admin/AdminSupport";


// Rider
import RiderLayout from "./pages/rider/RiderLayout";
import RiderDashboard from "./pages/rider/RiderDashboard";
import RiderOrders from "./pages/rider/RiderOrders";
import RiderEarnings from "./pages/rider/RiderEarnings";
import RiderRatings from "./pages/rider/RiderRatings";
import RiderSettings from "./pages/rider/RiderSettings";

// Restaurant
import RestaurantLayout from "./pages/restaurant/RestaurantLayout";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import RestaurantOrders from "./pages/restaurant/RestaurantOrders";
import RestaurantMenuPage from "./pages/restaurant/RestaurantMenu";
import RestaurantProfile from "./pages/restaurant/RestaurantProfile";
import RestaurantWallet from "./pages/restaurant/RestaurantWallet";

// Customer
import Dashboard from "./pages/customer/Dashboard";
import Restaurants from "./pages/customer/Restaurants";
import RestaurantMenu from "./pages/customer/RestaurantMenu";
import Cart from "./pages/customer/Cart";
import Checkout from "./pages/customer/Checkout";
import OrderTracking from "./pages/customer/OrderTracking";
import MyOrders from "./pages/customer/MyOrders";
import UserProfile from "./pages/customer/UserProfile";
import PaymentCallback from "./pages/customer/PaymentCallback";
import CustomerSupport from "./pages/customer/Support";
import RiderSupport from "./pages/rider/RiderSupport";
import RestaurantSupport from "./pages/restaurant/RestaurantSupport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <SplashOverlay />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <NotificationsListener />
            <ScrollReveal />
            <PageTransition>
            <Routes>
              <Route path="/" element={<RoleLanding />} />
              <Route path="/home" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Customer Routes — public browsing stays open; account routes gated by RoleGuard */}
              <Route path="/dashboard" element={<RoleGuard allow="customer"><Dashboard /></RoleGuard>} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/restaurant/:id" element={<RestaurantMenu />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<RoleGuard allow="customer"><Checkout /></RoleGuard>} />
              <Route path="/order/:id" element={<RoleGuard allow={["customer","admin","rider"]}><OrderTracking /></RoleGuard>} />
              <Route path="/orders" element={<RoleGuard allow="customer"><MyOrders /></RoleGuard>} />
              <Route path="/profile" element={<RoleGuard allow={["customer","admin","rider","restaurant"]}><UserProfile /></RoleGuard>} />
              <Route path="/payment/callback" element={<RoleGuard allow="customer"><PaymentCallback /></RoleGuard>} />
              <Route path="/support" element={<CustomerSupport />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="restaurants" element={<AdminRestaurants />} />
                <Route path="menu" element={<AdminMenu />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="riders" element={<AdminRiders />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Rider Routes */}
              <Route path="/rider" element={<RiderLayout />}>
                <Route index element={<RiderDashboard />} />
                <Route path="orders" element={<RiderOrders />} />
                <Route path="earnings" element={<RiderEarnings />} />
                <Route path="ratings" element={<RiderRatings />} />
                <Route path="support" element={<RiderSupport />} />
                <Route path="settings" element={<RiderSettings />} />
              </Route>

              {/* Restaurant Routes */}
              <Route path="/restaurant" element={<RestaurantLayout />}>
                <Route index element={<RestaurantDashboard />} />
                <Route path="orders" element={<RestaurantOrders />} />
                <Route path="menu" element={<RestaurantMenuPage />} />
                <Route path="wallet" element={<RestaurantWallet />} />
                <Route path="profile" element={<RestaurantProfile />} />
                <Route path="support" element={<RestaurantSupport />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            </PageTransition>
            
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
