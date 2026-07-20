import { lazy, Suspense } from "react";
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

import { SwipeHintOverlay } from "@/components/SwipeHintOverlay";
import LocationGate from "@/components/LocationGate";
import MobileLiveUpdate from "@/components/MobileLiveUpdate";
import SplashOverlay from "@/components/SplashOverlay";

patchSonnerForBrowserNotifications();

// Pages — keep light landing pages eager, lazy-load the rest
import { Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

import { RoleGuard } from "@/components/RoleGuard";
import RoleLanding from "@/components/RoleLanding";
import IdleTimeoutManager from "@/components/security/IdleTimeoutManager";

const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Legal = () => import("./pages/Legal");
const PrivacyPolicy = lazy(() => Legal().then(m => ({ default: m.PrivacyPolicy })));
const TermsAndConditions = lazy(() => Legal().then(m => ({ default: m.TermsAndConditions })));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Admin (lazy)
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRestaurants = lazy(() => import("./pages/admin/AdminRestaurants"));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminRiders = lazy(() => import("./pages/admin/AdminRiders"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminAppReleases = lazy(() => import("./pages/admin/AdminAppReleases"));
const AdminBackup = lazy(() => import("./pages/admin/AdminBackup"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));

// Rider (lazy)
const RiderLayout = lazy(() => import("./pages/rider/RiderLayout"));
const RiderDashboard = lazy(() => import("./pages/rider/RiderDashboard"));
const RiderOrders = lazy(() => import("./pages/rider/RiderOrders"));
const RiderEarnings = lazy(() => import("./pages/rider/RiderEarnings"));
const RiderRatings = lazy(() => import("./pages/rider/RiderRatings"));
const RiderSettings = lazy(() => import("./pages/rider/RiderSettings"));
const RiderSupport = lazy(() => import("./pages/rider/RiderSupport"));

// Restaurant (lazy)
const RestaurantLayout = lazy(() => import("./pages/restaurant/RestaurantLayout"));
const RestaurantDashboard = lazy(() => import("./pages/restaurant/RestaurantDashboard"));
const RestaurantOrders = lazy(() => import("./pages/restaurant/RestaurantOrders"));
const RestaurantMenuPage = lazy(() => import("./pages/restaurant/RestaurantMenu"));
const RestaurantProfile = lazy(() => import("./pages/restaurant/RestaurantProfile"));
const RestaurantWallet = lazy(() => import("./pages/restaurant/RestaurantWallet"));
const RestaurantSupport = lazy(() => import("./pages/restaurant/RestaurantSupport"));

// Customer (lazy — keep browsing snappy but split heavy pages)
const Dashboard = lazy(() => import("./pages/customer/Dashboard"));
const Restaurants = lazy(() => import("./pages/customer/Restaurants"));
const RestaurantMenu = lazy(() => import("./pages/customer/RestaurantMenu"));
const Cart = lazy(() => import("./pages/customer/Cart"));
const Checkout = lazy(() => import("./pages/customer/Checkout"));
const OrderTracking = lazy(() => import("./pages/customer/OrderTracking"));
const MyOrders = lazy(() => import("./pages/customer/MyOrders"));
const UserProfile = lazy(() => import("./pages/customer/UserProfile"));
const PaymentCallback = lazy(() => import("./pages/customer/PaymentCallback"));
const CustomerSupport = lazy(() => import("./pages/customer/Support"));

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});



const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <SplashOverlay />
          <MobileLiveUpdate />
          <SwipeHintOverlay />
          <IdleTimeoutManager />
          <Toaster />

          <Sonner />
          <BrowserRouter>
            <NotificationsListener />
            <ScrollReveal />
            <LocationGate>
            <PageTransition>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<RoleLanding />} />
              <Route path="/home" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/download" element={<DownloadApp />} />


              
              {/* Customer Routes — public browsing stays open; account routes gated by RoleGuard */}
              <Route path="/dashboard" element={<RoleGuard allow="customer"><Dashboard /></RoleGuard>} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/restaurant/:id" element={<RestaurantMenu />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<RoleGuard allow="customer"><Checkout /></RoleGuard>} />
              <Route path="/order/:id" element={<RoleGuard allow={["customer","admin","rider"]}><OrderTracking /></RoleGuard>} />
              <Route path="/orders" element={<RoleGuard allow="customer"><MyOrders /></RoleGuard>} />
              <Route path="/profile" element={<RoleGuard allow={["customer","admin","rider","restaurant"]}><UserProfile /></RoleGuard>} />
              <Route path="/settings/security" element={<RoleGuard allow={["customer","admin","rider","restaurant"]}><SecuritySettings /></RoleGuard>} />
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
                <Route path="app-releases" element={<AdminAppReleases />} />
                <Route path="backup" element={<AdminBackup />} />
                <Route path="audit-log" element={<AdminAuditLog />} />
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
            </Suspense>
            </PageTransition>
            </LocationGate>
            
            
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
