import { useLocation } from "react-router-dom";
import { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
