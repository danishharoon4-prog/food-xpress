import SupportChat from "@/components/SupportChat";

export default function RestaurantSupport() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">
          Ask about your restaurant approval, menu, orders, or payouts.
        </p>
      </div>
      <SupportChat role="restaurant" title="Restaurant Support" />
    </div>
  );
}
