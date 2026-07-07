import { useEffect, useState } from "react";
import { LifeBuoy, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportChatPanel } from "@/components/SupportChatPanel";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type IssueType = "order" | "payment" | "wallet" | "rider" | "restaurant" | "other";

interface Props {
  defaultIssueType?: IssueType;
}

/**
 * Responsive support surface:
 * - Desktop (lg+): fixed right-side collapsible panel
 * - Tablet / mobile (<lg): inline card inside the profile page
 */
export function ProfileSupportSection({ defaultIssueType = "order" }: Props) {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);

  // Restore last state
  useEffect(() => {
    const s = localStorage.getItem("support_side_open");
    if (s === "1") setOpen(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("support_side_open", open ? "1" : "0");
  }, [open]);

  if (!user || role === "admin") return null;

  return (
    <>
      {/* ============ MOBILE / TABLET: inline card ============ */}
      <div className="lg:hidden">
        <SupportChatPanel defaultIssueType={defaultIssueType} />
      </div>

      {/* ============ DESKTOP: fixed side panel ============ */}
      <div className="hidden lg:block">
        {/* Collapsed tab handle */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open support side panel"
            className={cn(
              "fixed right-0 top-1/2 -translate-y-1/2 z-40",
              "gradient-primary text-primary-foreground",
              "pl-2 pr-3 py-4 rounded-l-2xl shadow-xl",
              "flex flex-col items-center gap-2 hover:pr-4 transition-all",
            )}
          >
            <LifeBuoy className="w-5 h-5" />
            <span
              className="text-[11px] font-semibold tracking-wider"
              style={{ writingMode: "vertical-rl" }}
            >
              SUPPORT
            </span>
          </button>
        )}

        {/* Expanded side panel */}
        <div
          className={cn(
            "fixed right-0 top-16 bottom-4 z-40 w-[400px] xl:w-[440px]",
            "transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full pointer-events-none",
          )}
        >
          <div className="relative h-full mr-4 flex flex-col">
            <Button
              onClick={() => setOpen(false)}
              size="icon"
              variant="secondary"
              aria-label="Close support side panel"
              className="absolute -left-3 top-4 z-10 h-8 w-8 rounded-full shadow-md"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="flex-1 overflow-hidden rounded-2xl shadow-2xl border bg-card">
              <SupportChatPanel defaultIssueType={defaultIssueType} />
            </div>
          </div>
        </div>

        {/* Optional backdrop clicker (no dimming, just closes on outside click) */}
        {open && (
          <div
            className="fixed inset-0 z-30 hidden xl:block"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}
      </div>
    </>
  );
}
