import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  CheckCircle2,
  Lock,
  Headphones,
  Package,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    currentUser,
    fetchOrders,
    setActiveView,
    launchConciergeForOrder,
  } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  // Form Fields
  const [customerName, setCustomerName] = useState(currentUser.name);
  const [customerEmail, setCustomerEmail] = useState(currentUser.email);
  const [shippingAddress, setShippingAddress] = useState(
    "42 Innovation Way, Silicon Valley, CA 94025"
  );

  // Sync user profile if currentUser changes
  React.useEffect(() => {
    setCustomerName(currentUser.name);
    setCustomerEmail(currentUser.email);
  }, [currentUser]);

  const handleClose = () => {
    setIsCheckoutOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setConfirmedOrder(null);
    }, 300);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        product_id: "PROD-DESK-JHT8",
        quantity: 1,
        customer_name: customerName.trim() || currentUser.name,
        customer_email: customerEmail.trim() || currentUser.email,
        user_id: currentUser.id,
        shipping_address: shippingAddress.trim(),
        payment_method: "Credit Card (Test Sandbox)",
        test_card_number: "•••• 4242",
      };

      const result = await api.checkout(payload);
      setConfirmedOrder(result);
      toast.success("Order Placed Successfully!", {
        description: `Order #${result.order_id} confirmed and registered in Firestore.`,
      });
      fetchOrders();
    } catch (err: any) {
      toast.error("Payment Failed", {
        description: err.message || "Could not complete test checkout.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchSupport = () => {
    if (confirmedOrder) {
      const orderObj = {
        order_id: confirmedOrder.order_id,
        user_id: currentUser.id,
        customer_name: customerName,
        customer_email: customerEmail,
        product_id: confirmedOrder.product_id,
        product_name: confirmedOrder.product_name,
        serial_number: confirmedOrder.serial_number,
        price: "$499.00",
        amount_paid: confirmedOrder.amount_paid,
        currency: confirmedOrder.currency || "USD",
        status: "Delivered",
        order_date: confirmedOrder.order_date || "2026-08-31",
        warranty_status: confirmedOrder.warranty_status || "Active (2 Yrs)",
        payment_id: confirmedOrder.payment_id,
        payment_method: "Credit Card",
        payment_status: "captured",
        shipping_address: shippingAddress,
      };
      handleClose();
      launchConciergeForOrder(orderObj);
    } else {
      handleClose();
      setActiveView("concierge");
    }
  };

  return (
    <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Step 1: Payment & Address Form */}
        {!confirmedOrder ? (
          <div className="flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-cyan-400" />
                    <span>Instant Checkout</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Test sandbox payment gateway with simulated credit card authorization.
                  </DialogDescription>
                </div>
                <Badge variant="cyan" className="text-[10px]">
                  Sandbox Mode
                </Badge>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border/60">
              {/* Order Summary Column */}
              <div className="md:col-span-5 p-5 sm:p-6 bg-muted/20 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Item Summary
                  </span>

                  <div className="flex items-center gap-3">
                    <img
                      src="/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34.jpeg"
                      alt="Product"
                      className="h-12 w-12 rounded object-cover border border-border/80 bg-background"
                    />
                    <div>
                      <h4 className="text-xs font-semibold leading-tight">
                        JIN OFFICE Sit-Stand Desk
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-mono">Model JHT8-ED3</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 text-xs divide-y divide-border/40">
                    <div className="flex justify-between text-muted-foreground pt-1.5">
                      <span>Subtotal</span>
                      <span className="font-mono text-foreground font-medium">$499.00</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground pt-1.5">
                      <span>Shipping</span>
                      <span className="font-mono text-emerald-500 font-medium">$0.00 (Free)</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground pt-1.5">
                      <span>2-Yr Warranty</span>
                      <span className="text-cyan-400 font-medium">Included</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-foreground pt-2">
                      <span>Total Due</span>
                      <span className="font-mono text-cyan-400">$499.00 USD</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Zero risk sandbox. No real monetary charge will occur.</span>
                </div>
              </div>

              {/* Form Side */}
              <form onSubmit={handleSubmitPayment} className="md:col-span-7 p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Customer Full Name</label>
                  <Input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Email Receipt</label>
                  <Input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-8.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Delivery Address</label>
                  <Input
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="h-8.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Card Information</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> 256-Bit Encrypted
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="•••• •••• •••• 4242"
                      className="h-8.5 text-xs font-mono bg-muted/40 flex-2"
                    />
                    <Input
                      readOnly
                      value="12/28"
                      className="h-8.5 text-xs font-mono bg-muted/40 w-16 text-center"
                    />
                    <Input
                      readOnly
                      value="123"
                      className="h-8.5 text-xs font-mono bg-muted/40 w-14 text-center"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold h-10 mt-2 text-xs sm:text-sm"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    {isSubmitting ? "Authorizing Payment..." : "Authorize & Pay $499.00"}
                  </span>
                </Button>
              </form>
            </div>
          </div>
        ) : (
          /* Step 2: Order Confirmed Screen */
          <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <Badge variant="success" className="text-xs px-2.5 py-0.5">
                Payment Authorized &bull; Order Confirmed
              </Badge>
              <h2 className="text-xl font-bold text-foreground mt-2">Thank You for Your Order!</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Your purchase has been securely saved in Firestore and assigned a unique serial
                number for instant AI concierge support.
              </p>
            </div>

            {/* Receipt Summary Table */}
            <div className="w-full rounded-xl border border-border bg-muted/20 p-4 text-xs divide-y divide-border/60 text-left">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono font-bold text-foreground">
                  #{confirmedOrder.order_id}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Serial Number</span>
                <span className="font-mono font-semibold text-cyan-400">
                  {confirmedOrder.serial_number}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-mono font-semibold text-foreground">
                  ${confirmedOrder.amount_paid?.toFixed(2) || "499.00"} USD
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Payment Reference</span>
                <span className="font-mono text-muted-foreground text-[11px]">
                  {confirmedOrder.payment_id}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Hardware Warranty</span>
                <span className="text-emerald-500 font-medium">Active (2 Years)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
              <Button
                size="lg"
                onClick={handleLaunchSupport}
                className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs sm:text-sm h-10"
              >
                <Headphones className="h-4 w-4" />
                <span>Launch Live AI Concierge</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  handleClose();
                  setActiveView("orders");
                }}
                className="gap-2 text-xs sm:text-sm h-10"
              >
                <Package className="h-4 w-4" />
                <span>View in Orders</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
