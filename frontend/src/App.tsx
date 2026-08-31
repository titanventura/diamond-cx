import React, { useState } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { StoreView } from "@/components/store/StoreView";
import { OrdersView } from "@/components/orders/OrdersView";
import { ConciergeView } from "@/components/concierge/ConciergeView";
import { CheckoutModal } from "@/components/modals/CheckoutModal";
import { TicketModal } from "@/components/modals/TicketModal";
import { Toaster } from "@/components/ui/sonner";

const MainContent: React.FC = () => {
  const { activeView, setActiveView } = useApp();
  const [conciergeInitialPrompt, setConciergeInitialPrompt] = useState<string | null>(null);

  const handleAskConciergeFromStore = (prompt: string) => {
    setConciergeInitialPrompt(prompt);
    setActiveView("concierge");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main Views */}
      <main className="flex-1 w-full">
        {activeView === "store" && (
          <StoreView onAskConcierge={handleAskConciergeFromStore} />
        )}
        {activeView === "orders" && <OrdersView />}
        {activeView === "concierge" && (
          <ConciergeView
            initialPrompt={conciergeInitialPrompt}
            onClearInitialPrompt={() => setConciergeInitialPrompt(null)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav />

      {/* Modals & Toasts */}
      <CheckoutModal />
      <TicketModal />
      <Toaster position="bottom-right" richColors />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
