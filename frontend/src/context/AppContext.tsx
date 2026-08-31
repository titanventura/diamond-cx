import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { UserProfile, Order } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const DEMO_USERS: Record<string, UserProfile> = {
  "user-demo-01": {
    id: "user-demo-01",
    name: "Aswath S",
    email: "aswath@diamondcx.com",
    initials: "AS",
  },
  "user-demo-02": {
    id: "user-demo-02",
    name: "Sarah Connor",
    email: "sarah@diamondcx.com",
    initials: "SC",
  },
  "user-demo-03": {
    id: "user-demo-03",
    name: "Bruce Wayne",
    email: "bruce@diamondcx.com",
    initials: "BW",
  },
};

interface AppContextType {
  currentUser: UserProfile;
  switchUser: (userId: string) => void;
  activeView: "store" | "orders" | "concierge";
  setActiveView: (view: "store" | "orders" | "concierge") => void;
  orders: Order[];
  isLoadingOrders: boolean;
  fetchOrders: () => Promise<void>;
  activeOrderContext: Order | null;
  setActiveOrderContext: (order: Order | null) => void;
  launchConciergeForOrder: (order: Order) => void;
  
  // Modals
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  isTicketOpen: boolean;
  setIsTicketOpen: (open: boolean) => void;
  selectedOrderForTicket: Order | null;
  openTicketModal: (order: Order) => void;

  // Settings & Theme
  theme: "dark" | "light";
  toggleTheme: () => void;
  voice: string;
  setVoice: (voice: string) => void;
  modality: string;
  setModality: (modality: string) => void;

  // Global Session ID
  sessionId: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem("diamond_cx_user");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return DEMO_USERS["user-demo-01"];
  });

  const [activeView, setActiveView] = useState<"store" | "orders" | "concierge">("store");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [activeOrderContext, setActiveOrderContext] = useState<Order | null>(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [selectedOrderForTicket, setSelectedOrderForTicket] = useState<Order | null>(null);

  const [voice, setVoice] = useState("Puck");
  const [modality, setModality] = useState("AUDIO");
  const [sessionId] = useState(() => "session-" + Math.random().toString(36).substring(2, 9));

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const savedTheme = localStorage.getItem("diamond_cx_theme");
      if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    } catch (_) {}
    return "dark"; // Default to premium dark theme
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("diamond_cx_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const switchUser = (userId: string) => {
    if (DEMO_USERS[userId]) {
      const user = DEMO_USERS[userId];
      setCurrentUser(user);
      localStorage.setItem("diamond_cx_user", JSON.stringify(user));
      toast.success(`Switched account to ${user.name}`);
    }
  };

  const fetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const data = await api.listOrders(currentUser.id);
      setOrders(data || []);
    } catch (err: any) {
      console.warn("Could not fetch orders:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openTicketModal = (order: Order) => {
    setSelectedOrderForTicket(order);
    setIsTicketOpen(true);
  };

  const launchConciergeForOrder = (order: Order) => {
    setActiveOrderContext(order);
    setActiveView("concierge");
    toast.info(`Active context set to Order #${order.order_id}`, {
      description: `Gemini Live and Dynamic Redressal Agent pre-loaded with ${order.product_name} (${order.serial_number}).`,
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        switchUser,
        activeView,
        setActiveView,
        orders,
        isLoadingOrders,
        fetchOrders,
        activeOrderContext,
        setActiveOrderContext,
        launchConciergeForOrder,
        isCheckoutOpen,
        setIsCheckoutOpen,
        isTicketOpen,
        setIsTicketOpen,
        selectedOrderForTicket,
        openTicketModal,
        theme,
        toggleTheme,
        voice,
        setVoice,
        modality,
        setModality,
        sessionId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
