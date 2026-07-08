import SupportChat from "@/components/SupportChat";

export default function RiderSupport() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">
          Ask about your account, earnings, deliveries, or documents.
        </p>
      </div>
      <SupportChat role="rider" title="Rider Support" />
    </div>
  );
}
