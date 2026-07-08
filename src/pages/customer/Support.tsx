import CustomerHeader from "@/components/CustomerHeader";
import SupportChat from "@/components/SupportChat";
import { RoleGuard } from "@/components/RoleGuard";

export default function CustomerSupport() {
  return (
    <RoleGuard allow={["customer", "admin", "rider", "restaurant"]}>
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <main className="container py-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Help & Support</h1>
            <p className="text-sm text-muted-foreground">
              Chat with our assistant. Escalate to a human anytime.
            </p>
          </div>
          <SupportChat role="customer" title="FoodXpress Support" />
        </main>
      </div>
    </RoleGuard>
  );
}
