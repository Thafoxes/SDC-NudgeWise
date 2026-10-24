export type InvoiceStatus = 'paid' | 'pending' | 'overdue';
export type Role = 'seller' | 'staff' | 'customer';
export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'edited' | 'sent' | 'cancelled';
export type SendState = 'not_sent' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type ReviewStatus = 'pending' | 'reviewed' | 'resolved';
export type VerificationStatus = 'recorded' | 'pending_verification' | 'flagged';

export interface Business {
  id: string;
  name: string;
  display_name: string | null;
  address?: string;
  phone?: string;
  email?: string;
  salesperson_name?: string;
  settings_initialized?: boolean;
  payment_terms?: string;
  quotation_validity_days?: number;
  currency: string;
  timezone: string;
}

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: Role;
  avatar_color: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  telegram_chat_id: string | null;
  email: string | null;
  /** Language for reminders: 'en' | 'ms' | 'zh'. Missing means English. */
  preferred_language?: 'en' | 'ms' | 'zh' | null;
  address?: string | null;
}

export interface FinalReceipt {
  number:string; issued_at:string; issued_by:string; verification_note:string; financial_key:string;
  invoice_amount:number; total_debits:number; total_credits:number; total_paid:number;
  payments:Pick<Payment,'id'|'amount'|'payment_date'|'method'|'reference'|'evidence_id'>[];
}
export interface Invoice {
  currency?: string;
  id: string;
  business_id: string;
  customer_id: string;
  invoice_number: string;
  purchase_order_id?: string;
  quotation_id?: string;
  prepared_by?: string;
  final_receipt?: FinalReceipt;
  invoice_amount: number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  labels: string[];
  dispute_active: boolean;
  /** Retain the new-order settlement rule after the dispute is resolved. */
  settlement_required?: boolean;
  verification_hold: boolean;
  promise_to_pay_date: string | null;
  promise_confirmed: boolean;
  promise_amount?: number | null;
  promise_baseline_paid?: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  evidence_id?: string;
  business_id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  reference: string | null;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface OrderBlocker {
  invoice_id: string;
  invoice_number: string;
  balance: number;
  reason: string;
}

export interface PurchaseOrder {
  id: string;
  business_id: string;
  customer_id: string;
  reference: string;
  details?: PurchaseOrderDetails;
  status: 'draft' | 'approved';
  created_at: string;
  source_mode?: 'manual' | 'chat_screenshot' | 'uploaded_po' | 'quick_sale';
  completed_at?: string;
  completed_by?: string;
  completion_key?: string;
  approved_at?: string;
  approved_by?: string;
  override?: { reason: string; actor: string; approved_at: string; blockers: OrderBlocker[];
    total_mismatch?: { calculated: number | null; printed: number } };
}

export interface PurchaseOrderItem {
  name: string;
  code: string;
  quantity: number | null;
  unit_price: number | null;
  discount: number | null;
}

export interface PurchaseOrderDetails {
  order_date: string;
  delivery_date: string;
  currency: string;
  buyer_name: string;
  buyer_address: string;
  buyer_phone: string;
  buyer_email: string;
  supplier_name: string;
  supplier_address: string;
  supplier_phone: string;
  supplier_email: string;
  delivery_address: string;
  delivery_phone: string;
  attention: string;
  payment_terms: string;
  requested_by: string;
  document_approved_by: string;
  department: string;
  document_status: string;
  notes: string;
  items: PurchaseOrderItem[];
  document_total: number | null;
  evidence_id?: string;
}

export interface Credit {
  id: string;
  invoice_id: string;
  business_id: string;
  amount: number;
  reason: string | null;
  created_at: string;
}

export interface FollowUpAction {
  id: string;
  business_id: string;
  invoice_id: string;
  customer_id: string;
  checkpoint: number;
  reason: string;
  message: string;
  message_version: number;
  approval_state: ApprovalState;
  approved_by: string | null;
  approved_at: string | null;
  approved_message_hash: string | null;
  send_state: SendState;
  sent_at: string | null;
  delivery_status: string | null;
  recipient: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerResponse {
  id: string;
  business_id: string;
  invoice_id: string | null;
  customer_id: string | null;
  follow_up_action_id: string | null;
  message: string;
  ai_category: string | null;
  ai_confidence: number | null;
  ai_extracted_date: string | null;
  ai_suggested_action: string | null;
  review_status: ReviewStatus;
  created_at: string;
  source_update_id?: number;
  source_chat_id?: string;
  source_message_id?: number;
  sent_at?: string;
  ai_state?: 'processing' | 'complete' | 'failed';
  ai_flags?: string[];
  ai_date_phrase?: string | null;
  ai_date_note?: string;
  ai_promised_amount?: number | null;
  ai_payment_method?: string | null;
  promise_review?: 'pending' | 'confirmed' | 'declined';
  promise_reviewed_date?: string | null;
  promise_reviewed_amount?: number | null;
}

export interface ActivityEvent {
  id: string;
  business_id: string;
  invoice_id: string | null;
  event_type: string;
  actor: string | null;
  actor_role: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: string;
  business_id: string;
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface AiConversation {
  sources?: {id:string;title:string;url:string}[];
  id: string;
  business_id: string;
  user_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface DemoState {
  business_id: string;
  simulated_date: string;
  last_check_at: string | null;
}

// Composite view model for invoice with customer + computed balance
export interface InvoiceWithCustomer extends Invoice {
  customer?: Customer;
  outstanding_balance: number;
  total_paid: number;
  total_credits: number;
  total_debits?: number;
  days_overdue: number;
  is_partially_paid: boolean;
}

export interface FollowUpWithInvoice extends FollowUpAction {
  invoice?: InvoiceWithCustomer;
  customer?: Customer;
}

export interface CustomerResponseWithInvoice extends CustomerResponse {
  invoice?: InvoiceWithCustomer;
  customer?: Customer;
}
