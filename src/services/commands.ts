import * as scenarios from '@/lib/demoScenarios';
import * as knowledge from '@/lib/knowledge';
import { ref } from 'vue';
import * as actions from '@/lib/actions';
import * as store from '@/lib/store';
import * as customerOrders from '@/lib/customerOrders';
import * as workflow from '@/lib/orderWorkflow';
import * as quickSale from '@/lib/quickSale';
import * as settlement from '@/lib/settlement';
import * as businessSettings from '@/lib/businessSettings';
import type { PurchaseOrderDetails } from '@/types';
import { runInvoiceCheck as localCheck } from '@/lib/reminderEngine';
import { askAiAssistant as localAssistant } from '@/lib/aiService';
import { refreshStore } from '@/composables/useDemoStore';

export const backendEnabled = import.meta.env.VITE_BACKEND_ENABLED === 'true';
export const connectionError = ref('');
function checkAccess(response: Response) {
  if (response.status === 401) {
    window.dispatchEvent(new Event('nudgewise:access-required'));
    throw new Error('Demo access required. Enter the passcode again.');
  }
}
export const integration = ref({ model: 'llama3.2:3b', aiMode: 'auto', receivingAccountName: '' });
let requestRevision = 0;

export async function refreshServer() {
  if (!backendEnabled) return;
  const revision = ++requestRevision;
  try {
    const response = await fetch('/api/state');
    checkAccess(response);
    if (!response.ok) throw new Error('Local API unavailable. Start npm run server.');
    const body = await response.json();
    if (revision !== requestRevision) return;
    store.replaceSnapshot(body.data); integration.value = body.integration; connectionError.value = ''; refreshStore();
  } catch (error) { connectionError.value = error instanceof Error ? error.message : 'Local API connection failed'; throw error; }
}

function command<F extends (...args: any[]) => any>(name: string, local: F) {
  return async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    if (!backendEnabled) return local(...args);
    ++requestRevision;
    try {
      const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nudgewise-Local': '1' }, body: JSON.stringify({ name, args }) });
      checkAccess(response);
      const body = await response.json();
      if (!response.ok) {
        console.error(`Command ${name} failed (HTTP ${response.status}):`, body.error || 'Operation failed');
        throw new Error(body.error || 'Operation failed');
      }
      ++requestRevision;
      store.replaceSnapshot(body.data); connectionError.value = ''; refreshStore();
      return body.result;
    } catch (error) { connectionError.value = error instanceof Error ? error.message : 'Local API connection failed'; throw error; }
  };
}

export const approveFollowUp = command('approveFollowUp', actions.approveFollowUp);
export const rejectFollowUp = command('rejectFollowUp', actions.rejectFollowUp);
export const editFollowUpMessage = command('editFollowUpMessage', actions.editFollowUpMessage);
export const sendApprovedFollowUp = command('sendApprovedFollowUp', actions.sendApprovedFollowUp);
export const resolveVerificationHold = command('resolveVerificationHold', actions.resolveVerificationHold);
export const resolveDispute = command('resolveDispute', actions.resolveDispute);
export const confirmPromise = command('confirmPromise', actions.confirmPromise);
export const reviewCustomerPromise = command('reviewCustomerPromise', actions.reviewCustomerPromise);
export const simulateCustomerResponse = command('simulateCustomerResponse', actions.simulateCustomerResponse);
export const recordPayment = command('recordPayment', actions.recordPayment);
export const setCustomerLanguage = command('setCustomerLanguage', actions.setCustomerLanguage);
export const createQuickSale = command('createQuickSale', quickSale.createQuickSale);
export const issueFinalReceipt = command('issueFinalReceipt', settlement.issueFinalReceipt);
export const completeOrder = command('completeOrder', settlement.completeOrder);
export const saveBusinessSettings = command('saveBusinessSettings', businessSettings.saveBusinessSettings);
export const createCustomer = command('createCustomer', customerOrders.createCustomer);
export const updateCustomer = command('updateCustomer', customerOrders.updateCustomer);
export const deleteCustomer = command('deleteCustomer', customerOrders.deleteCustomer);
export const deletePurchaseOrder = command('deletePurchaseOrder', customerOrders.deletePurchaseOrder);
export const createPurchaseOrder = command('createPurchaseOrder', customerOrders.createPurchaseOrder);
export const updatePurchaseOrder = command('updatePurchaseOrder', customerOrders.updatePurchaseOrder);
export const approvePurchaseOrder = command('approvePurchaseOrder', customerOrders.approvePurchaseOrder);
async function uploadDocument(file: File, actorRole: string, endpoint: string) {
  if (!backendEnabled) throw new Error('Enable backend mode to read documents, or enter the customer manually.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a non-empty PDF, JPG or PNG up to 10 MB.');
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read this file. Try again or enter details manually.'));
    reader.onabort = () => reject(new Error('File reading was cancelled.'));
    reader.readAsDataURL(file);
  });
  const response = await fetch(endpoint, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nudgewise-Local': '1' },
    body: JSON.stringify({ name: file.name, content, actorRole }) });
  checkAccess(response);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Document extraction failed. Enter details manually or try another file.');
  return body.result;
}
export function extractCustomerDocument(file: File, actorRole = 'seller'): Promise<customerOrders.CustomerExtraction> {
  return uploadDocument(file, actorRole, '/api/customer-document');
}
export interface PurchaseOrderExtraction {
  reference: string;
  details: PurchaseOrderDetails;
  evidence: { id: string; filename: string; content_type: string; size: number; sha256: string };
  extraction_error?: string;
}
export function extractPurchaseOrderDocument(file: File, actorRole = 'seller'): Promise<PurchaseOrderExtraction> {
  return uploadDocument(file, actorRole, '/api/purchase-order-document');
}
export const attachOrderEvidence = command('attachOrderEvidence', workflow.attachOrderEvidence);
export const saveQuotation = command('saveQuotation', workflow.saveQuotation);
export const copyQuotationToOrder = command('copyQuotationToOrder', workflow.copyQuotationToOrder);
export const setQuotationDecision = command('setQuotationDecision', workflow.setQuotationDecision);
export const confirmDelivery = command('confirmDelivery', workflow.confirmDelivery);
export const issueOrderInvoice = command('issueOrderInvoice', workflow.issueOrderInvoice);
export const issueCreditNote = command('issueCreditNote', workflow.issueCreditNote);
export const acceptDeliveryShortfall = command('acceptDeliveryShortfall', workflow.acceptDeliveryShortfall);
export const issueDebitNote = command('issueDebitNote', workflow.issueDebitNote);
export const createPaymentClaim = command('createPaymentClaim', workflow.createPaymentClaim);
export const reviewPaymentClaim = command('reviewPaymentClaim', workflow.reviewPaymentClaim);
export const setOrderCase = command('setOrderCase', workflow.setOrderCase);
export const resolveOrderCase = command('resolveOrderCase', workflow.resolveOrderCase);
export interface EvidenceUpload { evidence:{id:string;filename:string;content_type:string;size:number;sha256:string}; extracted_text?:string }
export interface ChatOrderUpload extends EvidenceUpload {items: import('@/types').PurchaseOrderItem[]; buyer_name:string; warnings:string[]; extracted_text:string; extraction_error?:string}
export const uploadOrderEvidence = (file:File, role='seller') => uploadDocument(file,role,'/api/order-evidence') as Promise<EvidenceUpload>;
export const extractQuickSaleDocument = (file:File,role='seller') => uploadDocument(file,role,'/api/quick-sale-document') as Promise<ChatOrderUpload>;
export const uploadPaymentEvidence = (file:File,role='seller') => uploadDocument(file,role,'/api/payment-evidence') as Promise<EvidenceUpload>;
export const extractChatOrder = (file:File, role='seller') => uploadDocument(file,role,'/api/order-chat') as Promise<ChatOrderUpload>;
export const runInvoiceCheck = command('runInvoiceCheck', localCheck);
export const setDemoDate = command('setDemoDate', store.setDemoDate);
export const resetStore = command('resetStore', store.resetStore);
export const markNotificationReadById = command('markNotificationReadById', store.markNotificationReadById);
export const updateCustomerResponse = command('updateCustomerResponse', store.updateCustomerResponse);
export const addActivity = command('addActivity', store.addActivity);
export const addAiMessage = command('addAiMessage', store.addAiMessage);
export const clearAiConversation = command('clearAiConversation', store.clearAiConversation);
export const askAiAssistant = command('askAiAssistant', localAssistant);

export const manageDemoScenarios = command('manageDemoScenarios', scenarios.manageDemoScenarios);
export const saveKnowledgePolicy = command('saveKnowledgePolicy', knowledge.saveKnowledgePolicy);
export function extractPolicyDocument(file:File,role='seller'):Promise<EvidenceUpload>{return uploadDocument(file,role,'/api/policy-document');}
