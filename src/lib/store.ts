import { DEMO_COMPANY_PROFILE } from './companyProfile';
import type { WorkflowData } from './orderWorkflow';
// Demo store: browser localStorage or an injected server persistence adapter.
import {
  Business, User, Customer, Invoice, Payment, Credit, FollowUpAction,
  CustomerResponse, ActivityEvent, Notification, AiConversation, DemoState,
  InvoiceWithCustomer, PurchaseOrder,
} from '@/types';
import { subtractMoney, sumMoney, daysOverdue, daysBetween } from './format';
import type { Receipt } from './receipts';

const STORAGE_KEY = 'nudgewise-demo-v1.1';
let storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;

export function configureStorage(adapter: Pick<Storage, 'getItem' | 'setItem'>): void {
  storage = adapter;
  cache = null;
}

// Server snapshots replace the browser cache; they are never written back as mutations.
export function replaceSnapshot(data: StoreData): void { cache = migrate(data); }

export interface StoreData extends WorkflowData {
  knowledgePolicies?: import('./knowledge').KnowledgePolicy[];
  demoScenarios?: { business_id:string; reference_date:string; ids:string[] };
  sample_data_removed?: boolean;
  purchaseOrders: PurchaseOrder[];
  receipts?: Receipt[];
  businesses: Business[];
  users: User[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  credits: Credit[];
  followUpActions: FollowUpAction[];
  customerResponses: CustomerResponse[];
  activityEvents: ActivityEvent[];
  notifications: Notification[];
  aiConversations: AiConversation[];
  demoState: DemoState;
}

function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Fresh workspaces contain configuration only; sample transactions live in test fixtures.
function getSeedData(): StoreData {
  return {
    sample_data_removed: true,
    businesses: [{ id: 'biz-001', ...DEMO_COMPANY_PROFILE, settings_initialized:true, currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' }],
    users: [{ id: 'user-seller', business_id: 'biz-001', name: 'Seller', email: '', role: 'seller', avatar_color: '#1D72E0' }],
    customers: [], invoices: [], payments: [], credits: [], purchaseOrders: [],
    quotations: [], orderEvidence: [], deliveryConfirmations: [], paymentClaims: [], settlementReceipts: [], orderCases: [], creditNotes: [], debitNotes: [],
    followUpActions: [], customerResponses: [], activityEvents: [], notifications: [], aiConversations: [],
    demoState: { business_id: 'biz-001', simulated_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), last_check_at: null },
  };
}

// ---- Storage operations ----
let cache: StoreData | null = null;

function migrate(data: StoreData): StoreData {
  const company=data.businesses.find(b=>b.id==='biz-001');
  if(company && !company.settings_initialized){
    // Upgrade only the untouched placeholder; preserve existing custom company settings.
    if(company.name==='My business' && (!company.display_name||company.display_name==='My business')
      && !company.address && !company.phone && !company.email && !company.salesperson_name)
      Object.assign(company,DEMO_COMPANY_PROFILE);
    company.settings_initialized=true;
  }
  data.purchaseOrders ??= [];
  data.quotations ??= []; data.orderEvidence ??= []; data.deliveryConfirmations ??= [];
  data.paymentClaims ??= []; data.settlementReceipts ??= []; data.orderCases ??= []; data.creditNotes ??= []; data.debitNotes ??= [];
  if (!data.sample_data_removed) {
    const customers = new Set(data.customers.filter(c => /^cust-(?:\d{2}|green|yellow|grey|delta)$/.test(c.id)).map(c => c.id));
    const invoices = new Set(data.invoices.filter(i => customers.has(i.customer_id) || /^(?:inv-10\d{2}|inv-delta-001|hist-(?:green|yellow)-\d+)$/.test(i.id)).map(i => i.id));
    data.customers = data.customers.filter(c => !customers.has(c.id));
    data.invoices = data.invoices.filter(i => !invoices.has(i.id));
    data.payments = data.payments.filter(p => !invoices.has(p.invoice_id));
    data.credits = data.credits.filter(c => !invoices.has(c.invoice_id));
    data.purchaseOrders = data.purchaseOrders.filter(o => !customers.has(o.customer_id));
    data.followUpActions = data.followUpActions.filter(f => !invoices.has(f.invoice_id));
    data.customerResponses = data.customerResponses.filter(r => !customers.has(r.customer_id || '') && !invoices.has(r.invoice_id || ''));
    data.activityEvents = data.activityEvents.filter(e => !invoices.has(e.invoice_id || '') && !customers.has(String(e.metadata?.customer_id || '')));
    data.notifications = [];
    data.aiConversations = [];
    data.businesses = data.businesses.filter(b => b.id !== 'biz-002' || data.customers.some(c => c.business_id === b.id));
    data.users = data.users.filter(u => !['user-staff', 'user-seller2'].includes(u.id));
    const business = data.businesses.find(b => b.id === 'biz-001');
    if (business?.name === 'Kedai Maju Jaya') Object.assign(business, { name: 'My business', display_name: null });
    const seller = data.users.find(u => u.id === 'user-seller');
    if (seller?.name === 'Siti Aishah') Object.assign(seller, { name: 'Seller', email: '' });
    data.sample_data_removed = true;
  }
  for (const invoice of data.invoices) {
    const disputedBefore = data.activityEvents.some(e => e.business_id === invoice.business_id && e.invoice_id === invoice.id
      && ['dispute_raised', 'dispute_resolved'].includes(e.event_type));
    const disputedReply = data.customerResponses.some(r => r.business_id === invoice.business_id && r.invoice_id === invoice.id
      && (r.ai_flags?.includes('dispute') || r.ai_category === 'invoice_dispute'));
    if (invoice.dispute_active || disputedBefore || disputedReply) invoice.settlement_required = true;
  }
  return data;
}

function readStored(raw: string): StoreData {
  const data = JSON.parse(raw) as StoreData;
  if (!data.sample_data_removed) {
    const target = storage || localStorage;
    const backupKey = STORAGE_KEY + '-before-sample-cleanup';
    if (!target.getItem(backupKey)) target.setItem(backupKey, raw);
  }
  return migrate(data);
}

function load(): StoreData {
  if (cache) return cache;
  if (storage) {
    const raw = storage.getItem(STORAGE_KEY);
    cache = raw ? readStored(raw) : getSeedData();
    if (!raw || JSON.stringify(cache) !== raw) save(cache!);
    return cache!;
  }
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* Browser storage may be unavailable. */ }
  if (raw) {
    cache = readStored(raw);
    if (JSON.stringify(cache) !== raw) save(cache);
    return cache;
  }
  cache = migrate(getSeedData());
  save(cache);
  return cache;
}

function save(data: StoreData): void {
  if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(data));
  cache = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

export function update(mutator: (data: StoreData) => void): StoreData {
  const data = load();
  // Deep clone to trigger Vue store revisions on refresh
  const cloned: StoreData = JSON.parse(JSON.stringify(data));
  migrate(cloned);
  mutator(cloned);
  migrate(cloned);
  save(cloned);
  return cloned;
}

export function resetStore(): StoreData {
  const fresh = migrate(getSeedData());
  save(fresh);
  return fresh;
}

export function getStore(): StoreData {
  return load();
}

export function getDemoState(): DemoState {
  return load().demoState;
}

export function setDemoDate(date: string): void {
  update((d) => { d.demoState.simulated_date = date; });
}

// ---- Constants ----
export const DEMO_BUSINESS_ID = 'biz-001';
export const DEMO_SELLER_ID = 'user-seller';
export const DEMO_BUSINESS_NAME = 'My business';

// ---- Computed invoice helpers ----
/** Agreed extra charges added to an invoice by debit notes. */
export function debitTotal(data: { debitNotes?: { invoice_id: string; business_id: string; amount: number }[] }, inv: Pick<Invoice, 'id' | 'business_id'>): number {
  return sumMoney((data.debitNotes ?? []).filter(n => n.invoice_id === inv.id && n.business_id === inv.business_id).map(n => n.amount));
}
export function invoiceCurrency(inv:Invoice,data:StoreData):string {
 return inv.currency||data.quotations.find(q=>q.id===inv.quotation_id&&q.business_id===inv.business_id)?.currency
  ||data.purchaseOrders.find(o=>o.id===inv.purchase_order_id&&o.business_id===inv.business_id)?.details?.currency
  ||data.businesses.find(b=>b.id===inv.business_id)?.currency||'MYR';
}
export function computeInvoiceWithCustomer(inv: Invoice, data: StoreData, todayStr: string): InvoiceWithCustomer {
  const payments = data.payments.filter((p) => p.business_id === inv.business_id && p.invoice_id === inv.id && p.verification_status === 'recorded');
  const credits = data.credits.filter((c) => c.business_id === inv.business_id && c.invoice_id === inv.id);
  const totalPaid = sumMoney(payments.map((p) => p.amount));
  const totalCredits = sumMoney(credits.map((c) => c.amount));
  const totalDebits = debitTotal(data, inv);
  const outstanding = Math.max(0, subtractMoney(subtractMoney(sumMoney([inv.invoice_amount, totalDebits]), totalPaid), totalCredits));
  const dOverdue = outstanding > 0 ? daysOverdue(inv.due_date, todayStr) : 0;
  return {
    ...inv,
    currency:invoiceCurrency(inv,data),
    status: outstanding <= 0 ? 'paid' : dOverdue > 0 ? 'overdue' : 'pending',
    customer: data.customers.find((c) => c.id === inv.customer_id && c.business_id === inv.business_id),
    outstanding_balance: outstanding,
    total_paid: totalPaid,
    total_credits: totalCredits,
    total_debits: totalDebits,
    days_overdue: dOverdue,
    is_partially_paid: totalPaid > 0 && outstanding > 0,
  };
}

export function computeStatus(inv: Invoice, data: StoreData, todayStr: string): 'paid' | 'pending' | 'overdue' {
  const payments = data.payments.filter((p) => p.business_id === inv.business_id && p.invoice_id === inv.id && p.verification_status === 'recorded');
  const credits = data.credits.filter((c) => c.business_id === inv.business_id && c.invoice_id === inv.id);
  const totalPaid = sumMoney(payments.map((p) => p.amount));
  const totalCredits = sumMoney(credits.map((c) => c.amount));
  const outstanding = Math.max(0, subtractMoney(subtractMoney(sumMoney([inv.invoice_amount, debitTotal(data, inv)]), totalPaid), totalCredits));
  if (outstanding <= 0) return 'paid';
  return daysOverdue(inv.due_date, todayStr) > 0 ? 'overdue' : 'pending';
}

// ---- Mutation helpers ----
export function addPayment(invoiceId: string, amount: number, date: string, method: string, reference: string, verificationStatus: Payment['verification_status'] = 'recorded', evidenceId?:string): void {
  update((d) => {
    const inv = d.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    d.payments.push({
      id: uid('pay'), invoice_id: invoiceId, business_id: inv.business_id,
      amount, payment_date: date, method, reference: reference || null,...(evidenceId?{evidence_id:evidenceId}:{}),
      verification_status: verificationStatus, created_at: new Date().toISOString(),
    });
    // Update status
    const today = d.demoState.simulated_date;
    inv.status = computeStatus(inv, d, today);
  });
}

export function addActivity(businessId: string, invoiceId: string | null, eventType: string, actor: string, actorRole: string, description: string): void {
  update((d) => {
    d.activityEvents.unshift({
      id: uid('ae'), business_id: businessId, invoice_id: invoiceId,
      event_type: eventType, actor, actor_role: actorRole, description,
      metadata: null, created_at: new Date().toISOString(),
    });
  });
}

export function addNotificationRecord(businessId: string, title: string, body: string, kind: string, link?: string): void {
  update((d) => {
    d.notifications.unshift({
      id: uid('nt'), business_id: businessId, title, body, kind,
      link: link ?? null, read: false, created_at: new Date().toISOString(),
    });
  });
}

export function markNotificationReadById(id: string): void {
  update((d) => {
    const n = d.notifications.find((n) => n.id === id);
    if (n) n.read = true;
  });
}

export function updateInvoice(invoiceId: string, patch: Partial<Invoice>): void {
  update((d) => {
    const inv = d.invoices.find((i) => i.id === invoiceId);
    if (inv) Object.assign(inv, patch);
  });
}

export function addFollowUpAction(action: Omit<FollowUpAction, 'id' | 'created_at' | 'updated_at'>): void {
  update((d) => {
    const now = new Date().toISOString();
    d.followUpActions.unshift({
      ...action, id: uid('fu'), created_at: now, updated_at: now,
    });
  });
}

export function updateFollowUp(id: string, patch: Partial<FollowUpAction>): void {
  update((d) => {
    const fu = d.followUpActions.find((f) => f.id === id);
    if (fu) { Object.assign(fu, patch); fu.updated_at = new Date().toISOString(); }
  });
}

export function addCustomerResponse(resp: Omit<CustomerResponse, 'id' | 'created_at'>): void {
  update((d) => {
    d.customerResponses.unshift({
      ...resp, id: uid('cr'), created_at: new Date().toISOString(),
    });
  });
}

export function updateCustomerResponse(id: string, patch: Partial<CustomerResponse>): void {
  update((d) => {
    const cr = d.customerResponses.find((c) => c.id === id);
    if (cr) Object.assign(cr, patch);
  });
}

export function addAiMessage(businessId: string, userId: string | null, role: 'user' | 'assistant', content: string, sources: {id:string;title:string;url:string}[] = []): void {
  update((d) => {
    d.aiConversations.push({
      id: uid('ai'), business_id: businessId, user_id: userId, role, content,
      sources:sources.slice(0,40).filter(s=>typeof s.url==='string'&&/^#\/(invoices\?invoice=|orders\/[a-f0-9-]+\/view$|ai-assistant\?(policy=|guide=))/.test(s.url)).map(s=>({id:s.id,title:s.title,url:s.url})),
      created_at: new Date().toISOString(),
    });
  });
}

export function clearAiConversation(businessId: string): void {
  update((d) => {
    d.aiConversations = d.aiConversations.filter((c) => c.business_id !== businessId);
  });
}
