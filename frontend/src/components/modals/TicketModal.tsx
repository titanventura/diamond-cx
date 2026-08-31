import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const TicketModal: React.FC = () => {
  const { isTicketOpen, setIsTicketOpen, selectedOrderForTicket, currentUser } = useApp();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForTicket) return;

    setIsSubmitting(true);
    try {
      const payload = {
        order_id: selectedOrderForTicket.order_id,
        user_id: currentUser.id,
        subject: subject.trim(),
        description: description.trim(),
        priority: "high",
      };

      const ticket = await api.createSupportTicket(selectedOrderForTicket.order_id, payload);
      toast.success("Support Ticket Created!", {
        description: `Ticket ID #${ticket.ticket_id}. Our technical hardware team has been notified.`,
      });
      setIsTicketOpen(false);
      setSubject("");
      setDescription("");
    } catch (err: any) {
      toast.error("Ticket Error", {
        description: err.message || "Failed to create support ticket.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Raise Support Ticket</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Linked to Order #{selectedOrderForTicket?.order_id || ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {selectedOrderForTicket && (
          <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex items-center justify-between text-xs">
            <div className="truncate mr-2">
              <span className="font-semibold text-foreground block truncate">
                {selectedOrderForTicket.product_name}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Serial: {selectedOrderForTicket.serial_number}
              </span>
            </div>
            <Badge variant="success" className="text-[10px] shrink-0">
              {selectedOrderForTicket.warranty_status || "Active Warranty"}
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Issue Subject</label>
            <Input
              required
              placeholder="e.g. Dual motor jammed or rST calibration error"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Symptom Description</label>
            <Textarea
              required
              rows={4}
              placeholder="Describe the hardware symptom, display code, or physical fault in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Tickets are routed with high priority to certified field engineers.</span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTicketOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Submitting Ticket..." : "Submit Ticket"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
