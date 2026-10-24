import {getStore,update,computeInvoiceWithCustomer,DEMO_BUSINESS_ID,DEMO_SELLER_ID} from './store';
import {validDate} from './replyAnalysis';
import {getOrderEligibility} from './customerOrders';
export interface KnowledgePolicy {
 id:string;business_id:string;title:string;version:string;effective_date:string;active:boolean;text:string;
 reviewed_by:string;reviewed_at:string;evidence_id?:string;
}
export function requireDemoSeller(actor:string,role:string,businessId:string){
 if(role!=='seller'||!getStore().users.some(u=>u.id===DEMO_SELLER_ID&&u.name===actor&&u.role===role&&u.business_id===businessId))throw Error('Seller authorization required');
}
export function saveKnowledgePolicy(input:Partial<KnowledgePolicy>&{reviewed?:boolean},actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 requireDemoSeller(actor,role,businessId);
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid policy');
 for(const [field,max] of [['title',160],['version',40],['text',40000]] as const)
  if(typeof input[field]!=='string'||!input[field]!.trim()||input[field]!.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input[field]!))throw Error(`Check policy ${field}`);
 if(!validDate(input.effective_date||'')||typeof input.active!=='boolean'||input.reviewed!==true)throw Error('Review the policy text, version and effective date before saving');
 const policies=getStore().knowledgePolicies||[];
 const old=input.id?policies.find(p=>p.id===input.id&&p.business_id===businessId):undefined;
 if(input.id&&!old)throw Error('Policy not found in this workspace');
 if(!old&&policies.filter(p=>p.business_id===businessId).length>=100)throw Error('Policy limit reached');
 if(input.evidence_id!==undefined&&(typeof input.evidence_id!=='string'||!/^[a-f0-9-]{36}$/.test(input.evidence_id)))throw Error('Invalid original document');
 const id=old?.id||crypto.randomUUID();
 update(d=>{
  d.knowledgePolicies??=[];
  if(input.active)for(const p of d.knowledgePolicies)if(p.business_id===businessId&&p.title.toLowerCase()===input.title!.trim().toLowerCase())p.active=false;
  const policy:KnowledgePolicy={id,business_id:businessId,title:input.title!.trim(),version:input.version!.trim(),text:input.text!.trim(),
   effective_date:input.effective_date!,active:input.active!,reviewed_by:actor,reviewed_at:new Date().toISOString(),...(input.evidence_id?{evidence_id:input.evidence_id}:{})};
  const index=d.knowledgePolicies.findIndex(p=>p.id===id);if(index<0)d.knowledgePolicies.push(policy);else d.knowledgePolicies[index]=policy;
 });return {success:true,id};
}
export interface RagSource {id:string;title:string;text:string;url:string}
const words=(s:string)=>[...new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>w.length>2))];
function chunks(text:string){
 const result:string[]=[];for(let start=0;start<text.length;start+=1000)result.push(text.slice(start,start+1200));return result;
}
export function retrieveAssistantContext(question:string,guide:string,businessId=DEMO_BUSINESS_ID,invoiceId=''){
 if(typeof question!=='string'||!question.trim()||question.length>4000)throw Error('Enter a question up to 4,000 characters');
 const d=getStore(),today=d.demoState.simulated_date;
 const tokens=words(question);const score=(text:string)=>words(text).reduce((n,w)=>n+(tokens.includes(w)?1:0),0);
 const invoices=d.invoices.filter(i=>i.business_id===businessId).map(i=>computeInvoiceWithCustomer(i,d,today));
 if(invoiceId&&!invoices.some(i=>i.id===invoiceId))throw Error('Invoice not found in this workspace');
 const attention=invoices.filter(i=>(i.outstanding_balance>0&&(i.days_overdue>0||i.settlement_required||(i.promise_confirmed&&!!i.promise_to_pay_date&&i.promise_to_pay_date<today)))||i.dispute_active||i.verification_hold).map(i=>({
  id:i.id,reference:i.invoice_number,customer:i.customer?.name,balance:i.outstanding_balance,days_overdue:i.days_overdue,
  dispute:i.dispute_active,verification_hold:i.verification_hold,settlement_required:!!i.settlement_required,
  missed_promise:!!i.promise_confirmed&&!!i.promise_to_pay_date&&i.promise_to_pay_date<today&&i.outstanding_balance>0,
  order_blockers:getOrderEligibility(i.customer_id,businessId).blockers.filter(b=>b.invoice_id===i.id),
 }));
 const selected=invoices.map(i=>({i,rank:(i.id===invoiceId?10000:0)+score(`${i.invoice_number} ${i.customer?.name}`)+(i.dispute_active?5:0)+(i.verification_hold?4:0)+Math.min(i.days_overdue,100)/100}))
  .sort((a,b)=>b.rank-a.rank).slice(0,20).map(({i})=>i);
 const sources:RagSource[]=selected.map(i=>({id:`invoice:${i.id}`,title:i.invoice_number,url:`#/invoices?invoice=${encodeURIComponent(i.id)}`,
  text:JSON.stringify({reference:i.invoice_number,customer:i.customer?.name,balance:i.outstanding_balance,amount:i.invoice_amount,due_date:i.due_date,
   dispute:i.dispute_active,verification_hold:i.verification_hold,payments:d.payments.filter(p=>p.invoice_id===i.id&&p.business_id===businessId),
   terms:d.purchaseOrders.find(p=>p.id===i.purchase_order_id&&p.business_id===businessId)?.details?.payment_terms})}));
 const orderSources=d.purchaseOrders.filter(p=>p.business_id===businessId).map(p=>({p,rank:score(`${p.reference} ${p.details?.buyer_name||''} ${p.status}`)+(selected.some(i=>i.purchase_order_id===p.id)?10:0)+(/pending|quotation|\bpo\b|order/i.test(question)&&p.status==='draft'?20:0)}))
  .sort((a,b)=>b.rank-a.rank).slice(0,10).map(({p})=>({id:`order:${p.id}`,title:p.reference,url:`#/orders/${encodeURIComponent(p.id)}/view`,
   text:JSON.stringify({reference:p.reference,status:p.status,source_mode:p.source_mode,terms:p.details?.payment_terms,items:p.details?.items,
    quotation:d.quotations.filter(q=>q.business_id===businessId&&q.purchase_order_id===p.id).map(q=>({reference:q.reference,status:q.status,terms:q.payment_terms})),
    blockers:getOrderEligibility(p.customer_id,businessId).blockers})}));
 const passages:RagSource[]=[];
 for(const policy of (d.knowledgePolicies||[]).filter(p=>p.business_id===businessId&&p.active&&p.effective_date<=today))
  chunks(policy.text).forEach((text,n)=>passages.push({id:`policy:${policy.id}:${n+1}`,title:`${policy.title} v${policy.version} (effective ${policy.effective_date}), section ${n+1}`,text,url:`#/ai-assistant?policy=${encodeURIComponent(policy.id)}`}));
 for(const section of guide.split(/(?=^## )/m))chunks(section).forEach((text,n)=>passages.push({id:`guide:${passages.length}:${n}`,title:`Workflow manual: ${section.split('\n')[0].replace(/^#+\s*/,'')}`,text,url:'#/ai-assistant?guide=1'}));
 const matches=passages.map(p=>({p,rank:score(p.title+' '+p.text)+(p.id.startsWith('policy:')&&/polic|terms|condition/i.test(question)?3:0)})).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank).slice(0,6).map(x=>x.p);
 return {as_of:today,business:d.businesses.find(b=>b.id===businessId)?.name,invoice_count:invoices.length,
  attention:attention.sort((a,b)=>Number(b.dispute)-Number(a.dispute)||b.days_overdue-a.days_overdue).slice(0,40),
  attention_count:attention.length,scope_note:'Invoice detail limited to 20 and order detail to 10 and attention list to 40; do not claim these are exhaustive when counts exceed limits.',
  order_policy:'Ordinary overdue invoices do not block orders. Active disputes and unresolved dispute-settlement obligations do.',
  sources:[...sources,...orderSources,...matches]};
}
