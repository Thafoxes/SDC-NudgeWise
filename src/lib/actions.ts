/** Local demo mutations for NudgeWise v1.1. No network delivery or trusted auth. */
import type { FollowUpAction, Invoice } from '@/types';
import {
  getStore, computeStatus, addPayment, addActivity, addNotificationRecord,
  updateInvoice, updateFollowUp, addCustomerResponse, DEMO_BUSINESS_ID,
  updateCustomerResponse, update, computeInvoiceWithCustomer, DEMO_BUSINESS_NAME, debitTotal,
} from './store';
import { isLang, customerLang, LANGS } from './reminderTemplates';
import { validDate, resolvePromiseDate, responseFlags, type ReplyAnalysis } from './replyAnalysis';
import { promiseOutstanding, replyNeedsReview } from './attention';
import { classifyCustomerResponse } from './aiService';
import { approvalFingerprint, determineCheckpoint, generateReminderMessage } from './reminderEngine';
import { subtractMoney, sumMoney, toCents } from './format';

type ActionResult = { success: boolean; error?: string };

function invoiceForBusiness(invoiceId: string, businessId: string): Invoice | undefined {
  return getStore().invoices.find(i => i.id === invoiceId && i.business_id === businessId);
}
function sellerInBusiness(name: string, businessId: string): boolean {
  return getStore().users.some(u => u.name === name && u.business_id === businessId && u.role === 'seller');
}
function actorForBusiness(name: string, role: string, businessId: string): boolean {
  return getStore().users.some(u => u.name === name && u.role === role && u.business_id === businessId);
}
function actionForBusiness(id: string, businessId: string): FollowUpAction | undefined {
  return getStore().followUpActions.find(f => f.id === id && f.business_id === businessId);
}
function balanceForInvoice(invoice: Invoice) {
  const data = getStore();
  const payments = data.payments.filter(p => p.business_id === invoice.business_id && p.invoice_id === invoice.id && p.verification_status === 'recorded');
  const credits = data.credits.filter(c => c.business_id === invoice.business_id && c.invoice_id === invoice.id);
  return subtractMoney(subtractMoney(sumMoney([invoice.invoice_amount, debitTotal(data, invoice)]), sumMoney(payments.map(p => p.amount))), sumMoney(credits.map(c => c.amount)));
}
function cancelAction(fu: FollowUpAction, reason: string): void {
  updateFollowUp(fu.id, {
    send_state: 'cancelled', approval_state: 'cancelled', approved_by: null,
    approved_at: null, approved_message_hash: null, delivery_status: reason,
  });
  addActivity(fu.business_id, fu.invoice_id, 'reminder_cancelled', 'system', 'system',
    `${fu.id} cancelled: ${reason}`);
}
function invalidateOpenActions(invoiceId: string, businessId: string, reason: string): void {
  const actions = getStore().followUpActions.filter(f => f.invoice_id === invoiceId && f.business_id === businessId
    && f.send_state === 'not_sent' && ['pending','approved'].includes(f.approval_state));
  for (const action of actions) cancelAction(action, reason);
}
function checkEligibility(fu: FollowUpAction, inv: Invoice, now: string): string | null {
  if (balanceForInvoice(inv) <= 0) return 'Invoice fully paid';
  if (inv.dispute_active) return 'Active dispute';
  if (inv.verification_hold) return 'Payment claim awaiting verification';
  if (replyNeedsReview(getStore(), inv.id, inv.business_id)) return 'Customer reply awaiting review';
  if (inv.promise_confirmed && inv.promise_to_pay_date && inv.promise_to_pay_date >= now) return 'Active payment promise';
  const cp = determineCheckpoint({ ...inv, status: computeStatus(inv, getStore(), now) }, now);
  if (!cp || !cp.shouldPrepare || cp.checkpoint !== fu.checkpoint) return 'Reminder checkpoint is no longer eligible';
  if (!fu.message.trim()) return 'Reminder has no message';
  const customer = getStore().customers.find(c => c.id === inv.customer_id && c.business_id === inv.business_id);
  if (!customer || !fu.recipient || fu.recipient !== customer.phone) return 'Recipient changed or missing';
  if (getStore().followUpActions.some(other => other.id !== fu.id && other.business_id === fu.business_id && other.invoice_id === fu.invoice_id && other.checkpoint === fu.checkpoint && other.send_state === 'sent')) return 'Checkpoint already sent';
  return null;
}

export function recordPayment(
  invoiceId: string, amount: number, paymentDate: string, method: string,
  reference: string, actorName: string, businessId: string = DEMO_BUSINESS_ID, evidenceId?:string,
): ActionResult & { newStatus?: string } {
  const inv = invoiceForBusiness(invoiceId, businessId);
  if (!inv) return { success: false, error: 'Invoice not found for this business' };
  if (!sellerInBusiness(actorName, businessId)) return { success: false, error: 'Seller authorization required' };
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(toCents(amount)) || Math.abs(toCents(amount) / 100 - amount) > 0.0000001)
    return { success: false, error: 'Enter a positive MYR amount with at most two decimal places' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(Date.parse(paymentDate)))
    return { success: false, error: 'Invalid payment date' };
  if (paymentDate > getStore().demoState.simulated_date) return { success: false, error: 'Cannot record future payment in the demo' };
  if (toCents(amount) > toCents(balanceForInvoice(inv)))
    return { success: false, error: 'Payment exceeds outstanding balance; review instead of posting an excess payment' };

  if(evidenceId&&!getStore().orderEvidence.some(e=>e.id===evidenceId&&e.business_id===businessId&&e.purchase_order_id===inv.purchase_order_id&&e.kind==='payment_proof'))
    return {success:false,error:'Payment proof must be attached to this invoice’s order in this workspace'};
  addPayment(invoiceId, amount, paymentDate, method, reference, 'recorded',evidenceId);
  addActivity(businessId, invoiceId, 'payment_recorded', actorName, 'seller',
    `Seller-recorded payment of RM${amount.toFixed(2)} recorded for ${inv.invoice_number}`);
  // Any changed invoice ledger invalidates drafts and previous approvals; new checkpoint
  // cannot silently regenerate a cancelled action, seller must explicitly revisit it.
  invalidateOpenActions(invoiceId, businessId, 'Invoice ledger changed after reminder was drafted');
  const updated = getStore();
  const newStatus = computeStatus(inv, updated, updated.demoState.simulated_date);
  if (newStatus === 'paid') {
    updateInvoice(invoiceId, { status: 'paid', verification_hold: false, promise_confirmed: false, promise_to_pay_date: null, promise_amount: null });
    addActivity(businessId, invoiceId, 'settlement_recorded', actorName, 'seller',
      `${inv.invoice_number} fully settled; future reminders stopped`);
  }
  else if (inv.promise_confirmed && !promiseOutstanding(inv, updated, updated.demoState.simulated_date))
    updateInvoice(invoiceId, { promise_confirmed: false, promise_to_pay_date: null, promise_amount: null });
  return { success: true, newStatus };
}

export function resolveVerificationHold(invoiceId: string, verified: boolean, actorName: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (!invoiceForBusiness(invoiceId, businessId)) return { success: false, error: 'Invoice not found for this business' };
  if (!sellerInBusiness(actorName, businessId)) return { success: false, error: 'Seller authorization required' };
  updateInvoice(invoiceId, { verification_hold: false });
  addActivity(businessId, invoiceId, 'verification_resolved', actorName, 'seller',
    `Payment claim reviewed (${verified ? 'seller reports verified' : 'unverified'}); payment balance changes only through recorded payments`);
  return { success: true };
}
export function resolveDispute(invoiceId: string, actorName: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (!invoiceForBusiness(invoiceId, businessId)) return { success: false, error: 'Invoice not found for this business' };
  if (!sellerInBusiness(actorName, businessId)) return { success: false, error: 'Seller authorization required' };
  updateInvoice(invoiceId, { dispute_active: false });
  addActivity(businessId, invoiceId, 'dispute_resolved', actorName, 'seller', 'Invoice dispute resolved');
  return { success: true };
}
export function confirmPromise(invoiceId: string, promiseDate: string, confirmed: boolean, actorName: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (!invoiceForBusiness(invoiceId, businessId)) return { success: false, error: 'Invoice not found for this business' };
  if (!sellerInBusiness(actorName, businessId)) return { success: false, error: 'Seller authorization required' };
  if (confirmed && !validDate(promiseDate)) return { success: false, error: 'Invalid promise date' };
  updateInvoice(invoiceId, { promise_to_pay_date: confirmed ? promiseDate : null, promise_confirmed: confirmed, promise_amount: null });
  if (confirmed && promiseDate >= getStore().demoState.simulated_date) invalidateOpenActions(invoiceId, businessId, 'Confirmed promise-to-pay supersedes reminder');
  addActivity(businessId, invoiceId, 'promise_updated', actorName, 'seller',
    `Promise ${confirmed ? `confirmed for ${promiseDate}` : 'declined'}; no payment terms changed automatically`);
  return { success: true };
}

export function applyCustomerReply(responseId: string, analysis: ReplyAnalysis, businessId: string = DEMO_BUSINESS_ID): void {
  const response = getStore().customerResponses.find(r => r.id === responseId && r.business_id === businessId);
  if (!response) throw new Error('Customer response not found');
  const data = getStore();
  const timezone = data.businesses.find(b => b.id === businessId)?.timezone || 'Asia/Kuala_Lumpur';
  const deadline = resolvePromiseDate(analysis.date_phrase, response.sent_at || response.created_at, timezone);
  updateCustomerResponse(responseId, {
    ai_state: 'complete', ai_flags: analysis.flags, ai_category: analysis.flags.join(', '), ai_date_phrase: analysis.date_phrase,
    ai_extracted_date: deadline.date, ai_date_note: deadline.note, ai_promised_amount: analysis.promised_amount,
    ai_payment_method: analysis.payment_method, promise_review: 'pending', ai_confidence: null,
    ai_suggested_action: response.invoice_id ? 'Review the customer message. Confirm payment dates and arrangements explicitly; payment claims require bank verification.' : 'No matching invoice. Review the original message before taking action.',
  });
  const invoice = invoiceForBusiness(response.invoice_id || '', businessId);
  if (!invoice || balanceForInvoice(invoice) <= 0) return;
  if (analysis.flags.includes('payment_claim')) {
    updateInvoice(invoice.id, { verification_hold: true });
    invalidateOpenActions(invoice.id, businessId, 'Customer payment claim requires verification');
  }
  if (analysis.flags.includes('dispute')) {
    updateInvoice(invoice.id, { dispute_active: true });
    invalidateOpenActions(invoice.id, businessId, 'Customer disputes invoice');
  }
  addActivity(businessId, invoice.id, 'customer_reply_classified', 'Gemma reply classifier', 'system', `Customer reply classified: ${analysis.flags.join(', ')}`);
}

export function reviewCustomerPromise(responseId: string, date: string, confirmed: boolean, actorName: string, amount: number | null = null, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (!sellerInBusiness(actorName, businessId)) return { success: false, error: 'Seller authorization required' };
  const data = getStore();
  const response = data.customerResponses.find(r => r.id === responseId && r.business_id === businessId);
  const invoice = invoiceForBusiness(response?.invoice_id || '', businessId);
  if (!response || !invoice) return { success: false, error: 'Link to a valid invoice before confirming a promise' };
  const flags = responseFlags(response);
  if (!flags.some(f => ['payment_promise', 'extension_request', 'installment_request'].includes(f))) return { success: false, error: 'Response does not contain a payment-date proposal' };
  if (response.promise_review && response.promise_review !== 'pending') return { success: false, error: 'This proposal was already decided' };
  if (confirmed && flags.includes('payment_claim') && invoice.verification_hold) return { success: false, error: 'Review the claimed payment and release its verification hold before confirming the remaining-payment promise' };
  if (confirmed && (balanceForInvoice(invoice) <= 0 || !validDate(date))) return { success: false, error: 'Choose a valid date for an unpaid invoice' };
  if (confirmed && amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount > balanceForInvoice(invoice) || Math.abs(toCents(amount) / 100 - amount) > 1e-7)) return { success: false, error: 'Promised amount must be positive and no more than the outstanding balance' };
  if (confirmed) {
    const result = confirmPromise(invoice.id, date, true, actorName, businessId);
    if (!result.success) return result;
    const paid = sumMoney(data.payments.filter(p => p.invoice_id === invoice.id && p.business_id === businessId && p.verification_status === 'recorded').map(p => p.amount));
    updateInvoice(invoice.id, { promise_amount: amount, promise_baseline_paid: paid });
  }
  const otherWork = flags.some(f => ['payment_claim', 'dispute', 'payment_method_request', 'unclear'].includes(f));
  updateCustomerResponse(response.id, { promise_review: confirmed ? 'confirmed' : 'declined', promise_reviewed_date: confirmed ? date : null, promise_reviewed_amount: confirmed ? amount : null, review_status: otherWork ? 'pending' : 'reviewed' });
  addActivity(businessId, invoice.id, 'customer_promise_reviewed', actorName, 'seller', `Customer proposal ${confirmed ? `accepted for ${date}${amount === null ? '' : `, RM${amount.toFixed(2)}`}` : 'declined'}; original invoice due date unchanged`);
  return { success: true };
}

export function simulateCustomerResponse(invoiceId: string, customerId: string, message: string, businessId: string = DEMO_BUSINESS_ID): ActionResult & { classification?: ReturnType<typeof classifyCustomerResponse> } {
  const inv = invoiceForBusiness(invoiceId, businessId);
  const customer = getStore().customers.find(c => c.id === customerId && c.business_id === businessId);
  if (!inv || !customer || inv.customer_id !== customer.id) return { success: false, error: 'Customer and invoice do not match this business' };
  if (!message.trim()) return { success: false, error: 'Response cannot be empty' };
  const classification = classifyCustomerResponse(message, getStore().demoState.simulated_date + 'T00:00:00Z', getStore().businesses.find(b => b.id === businessId)?.timezone || 'Asia/Kuala_Lumpur');
  addCustomerResponse({
    business_id: businessId, invoice_id: invoiceId, customer_id: customerId,
    follow_up_action_id: null, message,
    ai_category: classification.category, ai_confidence: classification.confidence,
    ai_extracted_date: classification.extracted_date, ai_suggested_action: classification.suggested_action,
    review_status: 'pending',
    sent_at: getStore().demoState.simulated_date + 'T00:00:00Z',
  });
  if (classification.category === 'payment_already_made_claim') {
    updateInvoice(invoiceId, { verification_hold: true });
    invalidateOpenActions(invoiceId, businessId, 'Customer payment claim requires verification');
    addNotificationRecord(businessId, 'Customer payment claim', `${inv.invoice_number}: verification required`, 'response', 'action-center');
  }
  if (classification.category === 'invoice_dispute') {
    updateInvoice(invoiceId, { dispute_active: true });
    invalidateOpenActions(invoiceId, businessId, 'Customer disputes invoice');
    addNotificationRecord(businessId, 'Invoice dispute', `${inv.invoice_number}: seller investigation required`, 'exception', 'action-center');
  }
  addActivity(businessId, invoiceId, 'customer_replied', 'Customer (simulation)', 'customer',
    `Simulated reply: "${message.substring(0, 80)}" classified as ${classification.category}`);
  return { success: true, classification };
}

export function approveFollowUp(followUpId: string, approverId: string, approverName: string, approverRole: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  const data = getStore();
  const user = data.users.find(u => u.id === approverId && u.business_id === businessId && u.role === 'seller' && u.name === approverName);
  if (!user || approverRole !== 'seller') return { success: false, error: 'Only the seller in this business can approve reminders' };
  const fu = actionForBusiness(followUpId, businessId);
  if (!fu) return { success: false, error: 'Follow-up not found for this business' };
  if (fu.approval_state !== 'pending' || fu.send_state !== 'not_sent') return { success: false, error: 'This draft is not awaiting approval' };
  const inv = invoiceForBusiness(fu.invoice_id, businessId);
  if (!inv) return { success: false, error: 'Invoice not found for this business' };
  const issue = checkEligibility(fu, inv, data.demoState.simulated_date);
  if (issue) return { success: false, error: issue };
  updateFollowUp(followUpId, {
    approval_state: 'approved', approved_by: user.id, approved_at: new Date().toISOString(),
    approved_message_hash: approvalFingerprint(fu, inv, data),
  });
  addActivity(businessId, inv.id, 'reminder_approved', approverName, 'seller',
    `Checkpoint ${fu.checkpoint} approved for ${inv.invoice_number} (simulation)`);
  return { success: true };
}
export function editFollowUpMessage(followUpId: string, newMessage: string, editorName: string, editorRole: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (!actorForBusiness(editorName, editorRole, businessId) || !['seller','staff'].includes(editorRole)) return { success: false, error: 'Not authorized to edit this business draft' };
  const fu = actionForBusiness(followUpId, businessId);
  if (!fu) return { success: false, error: 'Follow-up not found for this business' };
  if (!['pending','approved'].includes(fu.approval_state) || fu.send_state !== 'not_sent') return { success: false, error: 'This action cannot be edited' };
  if (!newMessage.trim()) return { success: false, error: 'Message cannot be empty' };
  updateFollowUp(followUpId, {
    message: newMessage.trim(), message_version: fu.message_version + 1,
    approval_state: 'pending', approved_by: null, approved_at: null, approved_message_hash: null,
  });
  addActivity(businessId, fu.invoice_id, 'reminder_edited', editorName, editorRole, 'Reminder revised; previous approval invalidated');
  return { success: true };
}
export function rejectFollowUp(followUpId: string, rejectorName: string, rejectorRole: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (rejectorRole !== 'seller' || !sellerInBusiness(rejectorName, businessId)) return { success: false, error: 'Seller authorization required' };
  const fu = actionForBusiness(followUpId, businessId);
  if (!fu) return { success: false, error: 'Follow-up not found for this business' };
  if (!['pending','approved'].includes(fu.approval_state) || fu.send_state !== 'not_sent') return { success: false, error: 'This reminder cannot be rejected again' };
  updateFollowUp(followUpId, { approval_state: 'rejected', send_state: 'cancelled', approved_by: null, approved_message_hash: null });
  addActivity(businessId, fu.invoice_id, 'reminder_rejected', rejectorName, 'seller', `Reminder ${fu.id} rejected; checkpoint stays recorded`);
  return { success: true };
}
export function prepareFollowUpDelivery(followUpId: string, senderName: string, businessId: string = DEMO_BUSINESS_ID): ActionResult {
  if (!sellerInBusiness(senderName, businessId)) return { success: false, error: 'Seller authorization required' };
  const fu = actionForBusiness(followUpId, businessId);
  if (!fu) return { success: false, error: 'Follow-up not found for this business' };
  if (fu.approval_state !== 'approved' || fu.send_state !== 'not_sent') return { success: false, error: 'Reminder not in approved/unsent state' };
  const inv = invoiceForBusiness(fu.invoice_id, businessId);
  if (!inv) return { success: false, error: 'Invoice not found for this business' };
  const data = getStore();
  const issue = checkEligibility(fu, inv, data.demoState.simulated_date);
  if (issue) { cancelAction(fu, issue); return { success: false, error: `Stale approved reminder cancelled: ${issue}` }; }
  if (!fu.approved_message_hash || fu.approved_message_hash !== approvalFingerprint(fu, inv, data)) {
    cancelAction(fu, 'Message, recipient or invoice records changed after approval');
    return { success: false, error: 'Approved snapshot changed; reminder cancelled. New seller approval required.' };
  }
  return { success: true };
}

export function sendApprovedFollowUp(followUpId: string, senderName: string, businessId: string = DEMO_BUSINESS_ID): ActionResult & { simulated?: boolean } {
  const result = prepareFollowUpDelivery(followUpId, senderName, businessId);
  if (!result.success) return result;
  const fu = actionForBusiness(followUpId, businessId)!;
  const inv = invoiceForBusiness(fu.invoice_id, businessId)!;
  // Browser-only mode records simulation; the local server uses prepareFollowUpDelivery.
  updateFollowUp(followUpId, {
    send_state: 'sent', approval_state: 'sent', sent_at: new Date().toISOString(),
    delivery_status: 'simulated_not_delivered',
  });
  addActivity(businessId, inv.id, 'reminder_simulated', senderName, 'seller',
    `SIMULATION ONLY: ${fu.id} approved message to ${fu.recipient}; no actual delivery`);
  return { success: true, simulated: true };
}

/**
 * Saves the language a customer's reminders are written in. Drafts that are still
 * awaiting approval and were never edited by hand are rewritten in the new language;
 * approved, sent or hand-edited reminders are left unchanged.
 */
export function setCustomerLanguage(customerId: string, lang: string, actorName: string, actorRole: string, businessId: string = DEMO_BUSINESS_ID): ActionResult & { redrafted?: number } {
  if (!isLang(lang)) return { success: false, error: 'Unsupported language' };
  if (!['seller', 'staff'].includes(actorRole) || !actorForBusiness(actorName, actorRole, businessId)) return { success: false, error: 'Not authorized for this business' };
  const customer = getStore().customers.find(c => c.id === customerId && c.business_id === businessId);
  if (!customer) return { success: false, error: 'Customer not found for this business' };
  if (customerLang(customer) === lang) return { success: true, redrafted: 0 };
  update(d => { const c = d.customers.find(x => x.id === customerId && x.business_id === businessId); if (c) c.preferred_language = lang; });
  const data = getStore();
  const businessName = data.businesses.find(b => b.id === businessId)?.name ?? DEMO_BUSINESS_NAME;
  let redrafted = 0;
  for (const fu of data.followUpActions.filter(f => f.business_id === businessId && f.customer_id === customerId
    && f.approval_state === 'pending' && f.send_state === 'not_sent' && f.checkpoint < 5 && f.message_version === 1)) {
    const inv = data.invoices.find(i => i.id === fu.invoice_id && i.business_id === businessId);
    if (!inv) continue;
    const message = generateReminderMessage(computeInvoiceWithCustomer(inv, getStore(), data.demoState.simulated_date), fu.checkpoint, businessName);
    updateFollowUp(fu.id, { message });
    redrafted++;
  }
  const label = LANGS.find(l => l.id === lang)?.label ?? lang;
  addActivity(businessId, null, 'customer_language_set', actorName, actorRole,
    `${customer.name}: reminders will be written in ${label}${redrafted ? `; ${redrafted} unapproved draft${redrafted === 1 ? '' : 's'} rewritten` : ''}`);
  return { success: true, redrafted };
}
