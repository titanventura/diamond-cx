import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ShieldCheck,
  Truck,
  Sparkles,
  CheckCircle2,
  Headphones,
  CreditCard,
  Layers,
  Zap,
  RotateCcw,
} from "lucide-react";

const DESK_IMAGES = [
  "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34.jpeg",
  "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34 (1).jpeg",
  "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34 (2).jpeg",
  "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.35.jpeg",
  "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.35 (1).jpeg",
];

export const StoreView: React.FC<{ onAskConcierge: (prompt: string) => void }> = ({
  onAskConcierge,
}) => {
  const { setIsCheckoutOpen } = useApp();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleAskAboutDesk = () => {
    onAskConcierge(
      "Tell me about the JIN OFFICE Electric Sit-Stand Desk, its dual motor specs, and how the anti-collision system works."
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-8 pb-20 md:pb-8 animate-in fade-in-50 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* Left Column: Interactive Product Gallery */}
        <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4">
          <div className="relative aspect-[4/3] sm:aspect-[16/11] w-full overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm flex items-center justify-center">
            <img
              src={DESK_IMAGES[activeImageIndex]}
              alt="JIN OFFICE Sit-Stand Desk"
              className="h-full w-full object-contain p-2 sm:p-4 transition-all duration-300 hover:scale-105"
            />
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="cyan" className="text-[11px] shadow-sm">
                Dual-Motor Precision
              </Badge>
              <Badge variant="outline" className="text-[11px] bg-background/80 backdrop-blur-md">
                Model JHT8-ED3
              </Badge>
            </div>
          </div>

          {/* Thumbnail Carousel */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1.5 scrollbar-none">
            {DESK_IMAGES.map((imgSrc, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`relative h-14 w-14 sm:h-18 sm:w-18 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  activeImageIndex === idx
                    ? "border-cyan-400 ring-2 ring-cyan-500/20 scale-95"
                    : "border-border/70 opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={imgSrc}
                  alt={`Desk angle ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-2">
            <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-card p-3 shadow-xs">
              <Zap className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold">Dual Motors</h4>
                <p className="text-[11px] text-muted-foreground">&lt;45dB Whisper-Quiet</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-card p-3 shadow-xs">
              <Layers className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold">120 kg Load</h4>
                <p className="text-[11px] text-muted-foreground">3-Stage Steel Columns</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-card p-3 shadow-xs col-span-2 sm:col-span-1">
              <RotateCcw className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold">rST Diagnostics</h4>
                <p className="text-[11px] text-muted-foreground">Auto Gyro Reset</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Product Info & Purchase Actions */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-medium text-cyan-500">
                PROD-DESK-JHT8
              </span>
              <span className="text-xs text-muted-foreground">&bull;</span>
              <span className="text-xs text-muted-foreground">Ergonomic Furniture</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              JIN OFFICE Electric Sit-Stand Desk
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Engineered for executive ergonomics, featuring a dual-motor synchronized lifting
              system, digital LED memory touchpad, and multi-axis anti-collision safety sensors.
            </p>
          </div>

          {/* Pricing Row */}
          <div className="flex items-baseline justify-between border-y border-border/70 py-3.5">
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                $499.00
              </span>
              <span className="ml-1.5 text-xs text-muted-foreground">USD</span>
            </div>

            <div className="flex flex-col items-end text-right">
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                <Truck className="h-3.5 w-3.5" /> Free Express Shipping
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> 2-Year Hardware Warranty
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2.5">
            <Button
              size="lg"
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold shadow-md hover:shadow-cyan-500/20 transition-all text-sm sm:text-base h-11"
            >
              <CreditCard className="h-4 w-4" />
              <span>Purchase Product &bull; $499.00</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleAskAboutDesk}
              className="w-full gap-2 border-cyan-500/40 text-foreground hover:bg-cyan-500/10 hover:border-cyan-400 h-11 text-xs sm:text-sm"
            >
              <Headphones className="h-4 w-4 text-cyan-400" />
              <span>Inquire with Live Concierge</span>
            </Button>
          </div>

          {/* Technical Specifications Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Technical Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs divide-y divide-border/60">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Lifting System</span>
                <span className="font-medium text-foreground text-right">
                  Dual electric synchronized motors
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Height Range</span>
                <span className="font-medium text-foreground text-right">
                  60 cm &ndash; 125 cm (23.6" &ndash; 49.2")
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Speed &amp; Capacity</span>
                <span className="font-medium text-foreground text-right">
                  25 mm/s &bull; 120 kg (265 lbs) max
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Touch Controller</span>
                <span className="font-medium text-foreground text-right">
                  7-button LED (3 presets, reminder timer)
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Collision Gyro</span>
                <span className="font-medium text-foreground text-right">
                  Sensitivity S-1 to S-5
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Diagnostics</span>
                <span className="font-medium text-foreground text-right">
                  rST reset, E01 thermal rest recovery
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
