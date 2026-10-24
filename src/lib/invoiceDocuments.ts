import type { StoreData } from './store';
import { computeInvoiceWithCustomer,invoiceCurrency } from './store';
import { documentContactSections } from './documentPdf';
import type { DocumentSection } from './documentPdf';
export function invoiceDocument(data:StoreData,invoiceId:string,kind:'invoice'|'final_receipt'){
 const inv=data.invoices.find(i=>i.id===invoiceId);if(!inv)throw Error('Invoice not found');
 const business=data.businesses.find(b=>b.id===inv.business_id),customer=data.customers.find(c=>c.id===inv.customer_id&&c.business_id===inv.business_id);
 const order=data.purchaseOrders.find(o=>o.id===inv.purchase_order_id&&o.business_id===inv.business_id);
 const quote=data.quotations.find(q=>q.id===inv.quotation_id&&q.business_id===inv.business_id);
 const currency=invoiceCurrency(inv,data);const money=(n:number)=>`${currency} ${n.toFixed(2)}`;
 const receipt=kind==='final_receipt'?inv.final_receipt:undefined;
 if(kind==='final_receipt'&&!receipt)throw Error('Issue the final receipt after confirming settlement first');
 const totals=receipt||computeInvoiceWithCustomer(inv,data,data.demoState.simulated_date);
 const current=computeInvoiceWithCustomer(inv,data,data.demoState.simulated_date);
 const title=receipt?(receipt.total_paid>0?'FINAL PAYMENT RECEIPT':'FINAL SETTLEMENT STATEMENT'):'INVOICE TRACKING COPY';
 const reference=receipt?.number||inv.invoice_number;
 const sections:DocumentSection[]=[{heading:'Document information',lines:[`Reference: ${reference}`,`Invoice: ${inv.invoice_number}`,
  `Order: ${order?.reference||'-'}`,`Issue date: ${receipt?.issued_at.slice(0,10)||inv.issue_date}`,`Due date: ${inv.due_date}`,
  `Prepared / issued by: ${receipt?.issued_by||inv.prepared_by||'-'}`]},...documentContactSections(business,customer,order?.details)];
 if(!receipt){
  const items=quote?.items||order?.details?.items||[{name:inv.invoice_number,code:'',quantity:1,unit_price:inv.invoice_amount,discount:0}];
  sections.push({heading:`Items (${currency})`,lines:[],items});
 }
 sections.push({heading:receipt?'Final settlement reconciliation':'Invoice balance',lines:[`Original invoice: ${money(inv.invoice_amount)}`,
  `Agreed extra charges (debit notes): ${money(totals.total_debits||0)}`,`Credit adjustments (not cash received): ${money(totals.total_credits)}`,
  `Payments received: ${money(totals.total_paid)}`,`Outstanding: ${money(receipt?0:computeInvoiceWithCustomer(inv,data,data.demoState.simulated_date).outstanding_balance)}`]});
 if(receipt){
  sections.push({heading:'Recorded payments',lines:receipt.payments.length?receipt.payments.map(p=>`${p.payment_date} | ${p.method} | ${money(p.amount)} | Reference: ${p.reference||'-'}`):['No cash payment received; settled by credit adjustments.']});
  sections.push({heading:'Seller confirmation',lines:[`Confirmed by: ${receipt.issued_by}`,`Confirmed at: ${receipt.issued_at}`,`Verification source: ${receipt.verification_note}`]});
 }else sections.push({heading:'Terms',lines:[`Payment terms: ${quote?.payment_terms||order?.details?.payment_terms||'-'}`,`Delivery terms: ${quote?.delivery_terms||'-'}`]});
 if(current.outstanding_balance<=0){
  const paidByFunds=current.total_paid>=inv.invoice_amount+(current.total_debits||0);
  sections.push({heading:'Settlement status',lines:[paidByFunds?'FULLY PAID - This invoice has been fully paid.':'FULLY SETTLED - No outstanding balance; settlement includes credit adjustments.',...(inv.dispute_active?['An active dispute remains for seller review.']:[])]});
 }
 sections.push({heading:'Digital copy',lines:['This is a computer-generated digital copy.','No signature is required.']});
 return {filename:`${kind}-${reference}.pdf`,title,sections};
}
