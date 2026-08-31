import React from "react";
import { useApp } from "@/context/AppContext";
import { ShoppingBag, Package, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MobileNavProps {
  isConnected?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isConnected = false }) => {
  const { activeView, setActiveView, orders } = useApp();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-lg px-4 py-1.5 pb-safe">
      <div className="flex items-center justify-around">
        {/* Storefront Tab */}
        <button
          onClick={() => setActiveView("store")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
            activeView === "store"
              ? "text-cyan-400 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Store</span>
        </button>

        {/* Orders Tab */}
        <button
          onClick={() => setActiveView("orders")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-[11px] font-medium relative transition-colors ${
            activeView === "orders"
              ? "text-cyan-400 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="relative">
            <Package className="h-4 w-4" />
            {orders.length > 0 && (
              <span className="absolute -top-1.5 -right-3 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 px-1">
                {orders.length}
              </span>
            )}
          </div>
          <span>Orders</span>
        </button>

        {/* Live Concierge Tab */}
        <button
          onClick={() => setActiveView("concierge")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-[11px] font-medium relative transition-colors ${
            activeView === "concierge"
              ? "text-cyan-400 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="relative">
            <Headphones className="h-4 w-4" />
            {isConnected && (
              <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <span>Concierge</span>
        </button>
      </div>
    </div>
  );
};
