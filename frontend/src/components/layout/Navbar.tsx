import React from "react";
import { useApp, DEMO_USERS } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingBag,
  Package,
  Headphones,
  Moon,
  Sun,
  ChevronDown,
  Sparkles,
  Radio,
  User,
} from "lucide-react";

interface NavbarProps {
  isConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ isConnected = false }) => {
  const {
    currentUser,
    switchUser,
    activeView,
    setActiveView,
    orders,
    theme,
    toggleTheme,
    voice,
    setVoice,
    modality,
    setModality,
  } = useApp();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-6">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-4 sm:gap-8">
          <div
            onClick={() => setActiveView("store")}
            className="flex cursor-pointer items-center gap-2 font-bold tracking-wider text-sm sm:text-base text-foreground transition-opacity hover:opacity-80"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 text-slate-950 font-black shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              DIAMOND CX
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant={activeView === "store" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("store")}
              className="gap-2 text-xs font-medium"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Storefront</span>
            </Button>

            <Button
              variant={activeView === "orders" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("orders")}
              className="gap-2 text-xs font-medium relative"
            >
              <Package className="h-3.5 w-3.5" />
              <span>Orders</span>
              {orders.length > 0 && (
                <Badge
                  variant="default"
                  className="h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground font-mono"
                >
                  {orders.length}
                </Badge>
              )}
            </Button>

            <Button
              variant={activeView === "concierge" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("concierge")}
              className="gap-2 text-xs font-medium relative"
            >
              <Headphones className="h-3.5 w-3.5 text-cyan-400" />
              <span>Live Concierge</span>
              {isConnected && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              )}
            </Button>
          </nav>
        </div>

        {/* Right Section: Controls, User, Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Audio / Modality Settings (visible when in concierge or desktop) */}
          {activeView === "concierge" && (
            <div className="hidden lg:flex items-center gap-2 mr-1">
              <div className="w-24">
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger className="h-7 text-[11px] bg-muted/50">
                    <SelectValue placeholder="Voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Puck">Puck (Live)</SelectItem>
                    <SelectItem value="Aoede">Aoede</SelectItem>
                    <SelectItem value="Charon">Charon</SelectItem>
                    <SelectItem value="Kore">Kore</SelectItem>
                    <SelectItem value="Fenrir">Fenrir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-28">
                <Select value={modality} onValueChange={setModality}>
                  <SelectTrigger className="h-7 text-[11px] bg-muted/50">
                    <SelectValue placeholder="Modality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUDIO">Voice + Audio</SelectItem>
                    <SelectItem value="TEXT">Text Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Connection Status Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
              isConnected
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 live-glow-cyan"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            }`}
          >
            <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse text-cyan-400" : ""}`} />
            <span>{isConnected ? "Live Connected" : "Standby"}</span>
          </div>

          {/* User Account Switcher Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-2 sm:px-3 text-xs border-border/80 hover:bg-muted/60"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold">
                  {currentUser.initials}
                </div>
                <span className="hidden sm:inline font-medium max-w-[90px] truncate">
                  {currentUser.name}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Switch Demo Profile
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.values(DEMO_USERS).map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => switchUser(user.id)}
                  className={`flex items-center gap-2.5 py-2 cursor-pointer ${
                    currentUser.id === user.id ? "bg-accent font-medium text-foreground" : ""
                  }`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-mono font-semibold">
                    {user.initials}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs">{user.name}</span>
                    <span className="text-[10px] text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
};
