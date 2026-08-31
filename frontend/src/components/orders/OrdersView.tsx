import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  RotateCw,
  Search,
  Headphones,
  LifeBuoy,
  ShieldCheck,
  CreditCard,
  Hash,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const OrdersView: React.FC = () => {
  const { orders, isLoadingOrders, fetchOrders, launchConciergeForOrder, openTicketModal, setActiveView } =
    useApp();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    return (
      order.order_id.toLowerCase().includes(q) ||
      order.product_name.toLowerCase().includes(q) ||
      order.serial_number.toLowerCase().includes(q) ||
      (order.refund_status && order.refund_status.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-8 pb-20 md:pb-8 animate-in fade-in-50 duration-300">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Order History &amp; Warranties
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your hardware purchases, warranty coverages, and trigger live AI diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search serial or order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8 text-xs bg-card/60"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={isLoadingOrders}
            className="h-8.5 gap-1.5 px-3 text-xs shrink-0"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoadingOrders ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Orders Grid */}
      {isLoadingOrders && orders.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 rounded-xl border border-border/60 bg-muted/20 animate-pulse p-4"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-8 sm:p-12 text-center bg-card/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No orders found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchQuery
              ? `No purchases matched "${searchQuery}". Try a different serial or order ID.`
              : "You haven't placed any orders with this demo account yet."}
          </p>
          <Button
            size="sm"
            onClick={() => setActiveView("store")}
            className="mt-4 gap-2 text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Browse Storefront</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredOrders.map((order) => {
            const isRefunded = Boolean(order.refund_status);

            return (
              <Card
                key={order.order_id}
                className="flex flex-col justify-between border-border/80 bg-card hover:border-border transition-all shadow-xs hover:shadow-md"
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                        <Hash className="h-3 w-3 text-cyan-400" />
                        <span>{order.order_id}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Ordered on {order.order_date}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isRefunded ? (
                        <Badge variant="refund" className="text-[10px] px-2 py-0.5">
                          {order.refund_status}
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] px-2 py-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          {order.status || "Delivered"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  {/* Product Snippet */}
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <img
                      src={
                        order.image_url ||
                        "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34.jpeg"
                      }
                      alt="Desk Thumbnail"
                      className="h-12 w-12 rounded object-cover border border-border/60 shrink-0 bg-background"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-foreground truncate">
                        {order.product_name}
                      </h4>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        SN: {order.serial_number}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/40 p-2 border border-border/40">
                      <span className="text-[10px] text-muted-foreground block">Amount Paid</span>
                      <span className="font-mono font-semibold text-foreground">
                        {typeof order.price === "number"
                          ? `$${order.price.toFixed(2)} USD`
                          : String(order.price).includes("$")
                          ? order.price
                          : `$${order.price} USD`}
                      </span>
                    </div>

                    <div className="rounded-md bg-muted/40 p-2 border border-border/40">
                      <span className="text-[10px] text-muted-foreground block">Warranty</span>
                      <span className="text-emerald-500 font-medium text-[11px] truncate block">
                        {order.warranty_status || "Active (2 Yrs)"}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between px-1">
                    <span>Payment Ref:</span>
                    <span className="truncate max-w-[130px]">{order.payment_id}</span>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-1 flex gap-2 border-t border-border/40 mt-1">
                  <Button
                    size="sm"
                    onClick={() => launchConciergeForOrder(order)}
                    className="flex-1 gap-1.5 text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
                  >
                    <Headphones className="h-3.5 w-3.5" />
                    <span>Live Concierge</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTicketModal(order)}
                    className="gap-1.5 text-xs border-border/80 hover:bg-muted"
                  >
                    <LifeBuoy className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Raise Ticket</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
