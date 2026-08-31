export interface UserProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export interface Product {
  id: string;
  name: string;
  tagline?: string;
  category: string;
  price: number;
  currency: string;
  rating?: number;
  review_count?: number;
  in_stock: boolean;
  warranty_years: number;
  description: string;
  features: string[];
  specs: Record<string, string>;
  images: string[];
}

export interface Order {
  order_id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  product_id: string;
  product_name: string;
  serial_number: string;
  price: string | number;
  amount_paid?: number;
  currency: string;
  status: string;
  order_date: string;
  delivery_date?: string;
  warranty_status: string;
  payment_id: string;
  payment_method: string;
  payment_status: string;
  shipping_address: string;
  refund_status?: string | null;
  refund_id?: string | null;
  refund_amount?: string | null;
  refund_date?: string | null;
  refund_reason?: string | null;
  image_url?: string;
  created_at?: string;
}

export interface CheckoutPayload {
  product_id: string;
  quantity: number;
  customer_name: string;
  customer_email: string;
  user_id: string;
  shipping_address: string;
  payment_method: string;
  test_card_number?: string;
}

export interface SupportTicketPayload {
  order_id: string;
  user_id: string;
  subject: string;
  description: string;
  priority?: string;
}

export interface MessageBubble {
  id: string;
  role: "user" | "agent" | "system";
  senderName: string;
  text: string;
  timestamp: string;
  isError?: boolean;
}

export interface ToolCallItem {
  id: string;
  name: string;
  args: Record<string, any>;
  timestamp: string;
}

export interface ToolResponseItem {
  id: string;
  name: string;
  response: any;
  timestamp: string;
}
