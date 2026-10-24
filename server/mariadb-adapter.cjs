/**
 * XAMPP/MariaDB persistence adapter for the existing synchronous NudgeWise store.
 * The MariaDB runtime snapshot is the app's source of truth. The existing 29 tables
 * are transactional relational projections for visibility and further development.
 * Only this application should mutate the projection tables in this demo phase.
 */
const { createHash } = require('node:crypto');
const {hasCurrentFinalReceipt,settlementBlockers}=require('../.server-build/lib/settlement.js');
const { DEMO_BUSINESS_ID } = require('../.server-build/lib/store.js');

const PROJECTED = [
  'businesses', 'users', 'customers', 'purchase_orders', 'purchase_order_items',
  'order_requirements', 'quotations', 'quotation_items', 'invoices', 'invoice_items',
  'deliveries', 'delivery_items', 'payments', 'payment_claims', 'receipts',
  'order_stages', 'payment_promises', 'dispute_cases', 'credits', 'payment_blockers',
  'follow_up_actions', 'email_messages', 'customer_responses', 'documents',
  'document_extractions', 'activity_events', 'notifications', 'ai_conversations',
  'background_jobs',
];
const APP_KEY = 'nudgewise-demo-v1.1';
const dt = value => value && /^\d{4}-\d\d-\d\d/.test(String(value))
  ? String(value).slice(0,19).replace('T',' ') : null;
const day = value => value && /^\d{4}-\d\d-\d\d/.test(String(value)) ? String(value).slice(0,10) : null;
const num = v => v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const txt = v => v == null ? null : String(v);
const json = v => v == null ? null : JSON.stringify(v);
const bool = v => v ? 1 : 0;
const fixedId = str => { const hex = createHash('sha256').update(str).digest('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`; };

function projectState(state, evidenceRows = []) {
  const rows = Object.fromEntries(PROJECTED.map(table => [table, []]));
  const add = (table, obj) => rows[table].push(obj);
  const sellerId = state.users.find(u => u.business_id === DEMO_BUSINESS_ID && u.role === 'seller')?.id || 'user-seller';
  const customers = new Map(state.customers.map(c => [c.id, c]));
  const orders = new Map(state.purchaseOrders.map(p => [p.id, p]));
  const quotations = new Map(state.quotations.map(q => [q.id, q]));
  const invoices = new Map(state.invoices.map(i => [i.id, i]));
  const payments = new Map(state.payments.map(p => [p.id, p]));
  const firstQuotation = id => state.quotations.find(q => q.purchase_order_id === id);
  const poItems = new Map();
  const validUser = id => state.users.some(u => u.id === id);

  for (const b of state.businesses) add('businesses', {id:b.id,name:b.name,display_name:b.display_name,address:b.address||null,phone:b.phone||null,email:b.email||null,currency:b.currency||'MYR',timezone:b.timezone||'Asia/Kuala_Lumpur'});
  for (const u of state.users) add('users', {id:u.id,business_id:u.business_id,name:u.name,email:u.email||`${u.id}@nudgewise.invalid`,role:u.role});
  for (const c of state.customers) add('customers', {id:c.id,business_id:c.business_id,name:c.name,phone:c.phone||null,email:c.email||null,billing_email:c.email||null,address:c.address||null,preferred_language:c.preferred_language||'en'});

  for (const po of state.purchaseOrders) {
    const details = po.details || {};
    const q = firstQuotation(po.id);
    const issuedInvoice = state.invoices.find(i => i.purchase_order_id === po.id);
    const associatedPayments = state.payments.filter(p => p.invoice_id === issuedInvoice?.id && p.verification_status === 'recorded');
    const receipt = issuedInvoice?.final_receipt;
    const settled=!!issuedInvoice && settlementBlockers(issuedInvoice,state).length===0;
    const deliveryComplete=!!po.details?.items.length && po.details.items.every(item=>{
      const delivery=state.deliveryConfirmations.find(d=>d.purchase_order_id===po.id&&d.item_name===item.name);
      const credited=state.creditNotes.filter(n=>n.purchase_order_id===po.id&&n.item_name===item.name).reduce((sum,n)=>sum+n.quantity,0);
      return !!delivery && (delivery.accepted_quantity+credited>=item.quantity||!!delivery.shortfall_accepted_at);
    });
    const completed=!!po.completed_at && settled && deliveryComplete && (po.source_mode==='quick_sale'||q?.status==='accepted') && po.status==='approved' && hasCurrentFinalReceipt(issuedInvoice,state) && po.completion_key===receipt?.financial_key;
    const cases = state.orderCases.filter(c => c.purchase_order_id === po.id && c.status === 'open');
    const buyerDecision = q?.status === 'accepted' ? 'accepted' : q?.status === 'rejected' ? 'rejected' : q?.status === 'revision_requested' ? 'revision_requested' : 'not_requested';
    const lines = details.items || [];
    const total = lines.every(l => num(l.quantity) != null && num(l.unit_price) != null)
      ? lines.reduce((sum,l)=>sum+(num(l.quantity)||0)*(num(l.unit_price)||0)-(num(l.discount)||0),0) : null;
    add('purchase_orders', {
      id:po.id,business_id:po.business_id,customer_id:po.customer_id,
      order_reference:po.reference,po_number:po.source_mode === 'uploaded_po' ? po.reference : null,
      source_mode:po.source_mode||'manual', document_kind:po.source_mode==='uploaded_po'?'buyer_issued_po':po.source_mode==='quick_sale'?'direct_sale':'draft_po',
      status:po.status,buyer_approval_status:buyerDecision, order_date:day(details.order_date),
      requested_delivery_date:day(details.delivery_date),currency:details.currency||'MYR',document_total:total,
      buyer_details_snapshot:json({name:details.buyer_name,address:details.buyer_address,phone:details.buyer_phone,email:details.buyer_email}),
      supplier_details_snapshot:json({name:details.supplier_name,address:details.supplier_address}),
      delivery_address:details.delivery_address||null,payment_terms_text:details.payment_terms||null,
      delivery_terms_text:details.delivery_terms||null, requested_by:details.requested_by||null,
      document_approved_by_text:details.document_approved_by||null,department:details.department||null,
      notes:details.notes||null,seller_approved_by:po.status==='approved'?sellerId:null,
      seller_approved_at:dt(po.approved_at),override_reason:po.override?.reason||null,
      created_at:dt(po.created_at),
    });
    lines.forEach((line,i)=>{
      const lineId = fixedId(`poitem:${po.id}:${i}`);
      poItems.set(`${po.id}:${i}`,lineId);
      const quantity = num(line.quantity)||0; const price=num(line.unit_price);
      add('purchase_order_items',{id:lineId,business_id:po.business_id,purchase_order_id:po.id,line_no:i+1,
        item_name:line.name||'Unnamed item',item_code:line.code||null,quantity,unit:line.unit||null,
        unit_price:price,discount_amount:num(line.discount),line_total:price==null?null:quantity*price-(num(line.discount)||0),
        review_status: 'confirmed',created_at:dt(po.created_at)});
    });
    const milestones = [
      ['po', true], ['quotation', !!q], ['buyer_approval', q?.status==='accepted'],
      ['fulfilment', deliveryComplete],
      ['invoice',!!issuedInvoice], ['payment',settled], ['receipt',completed],
    ];
    for (const [stage, complete] of milestones) add('order_stages', {
      id:fixedId(`stage:${po.id}:${stage}`), business_id:po.business_id,purchase_order_id:po.id,
      stage_code:stage,stage_status:po.source_mode==='quick_sale'&&['quotation','buyer_approval'].includes(stage)?'skipped':cases.length && ['invoice','payment'].includes(stage)?'blocked':complete?'completed':'not_started',
      completed_at:complete?dt((stage==='po'?po.created_at:stage==='quotation'?q?.updated_at:stage==='buyer_approval'?q?.updated_at:stage==='payment'?associatedPayments.at(-1)?.created_at:stage==='receipt'?po.completed_at:issuedInvoice?.created_at)):null,
      summary: cases.length ? 'Open seller review case' : null,
    });
  }

  for (const q of state.quotations) {
    const po=orders.get(q.purchase_order_id); if(!po) continue;
    add('quotations',{id:q.id,business_id:q.business_id,purchase_order_id:q.purchase_order_id,customer_id:po.customer_id,
      quotation_number:q.reference,valid_until:day(q.valid_until),currency:q.currency,total_amount:q.amount,
      subtotal:q.amount,payment_terms:q.payment_terms,delivery_terms:q.delivery_terms,status:q.status,
      buyer_response_at: ['accepted','revision_requested','rejected'].includes(q.status)?dt(q.updated_at):null,
      buyer_response_source:q.buyer_decision_evidence_id?'evidence':'seller_recorded',
      buyer_response_confirmed_by:['accepted','revision_requested','rejected'].includes(q.status)?sellerId:null,
      created_at:dt(q.created_at),updated_at:dt(q.updated_at)});
    q.items.forEach((line,i)=>add('quotation_items',{id:fixedId(`qitem:${q.id}:${i}`),business_id:q.business_id,quotation_id:q.id,
      line_no:i+1,item_name:line.name,item_code:line.code||null,quantity:num(line.quantity)||0,
      unit_price:num(line.unit_price)||0,discount_amount:num(line.discount)||0,
      line_total:(num(line.quantity)||0)*(num(line.unit_price)||0)-(num(line.discount)||0)}));
  }
  for (const inv of state.invoices) {
    add('invoices',{id:inv.id,business_id:inv.business_id,purchase_order_id:orders.has(inv.purchase_order_id)?inv.purchase_order_id:null,
      quotation_id:quotations.has(inv.quotation_id)?inv.quotation_id:null,
      customer_id:inv.customer_id,invoice_number:inv.invoice_number,issue_date:day(inv.issue_date),due_date:day(inv.due_date),
      currency:require('../.server-build/lib/store.js').invoiceCurrency(inv,state),subtotal:inv.invoice_amount,
      invoice_amount:inv.invoice_amount,document_status:inv.status,dispute_active:bool(inv.dispute_active),
      settlement_required:bool(inv.settlement_required),verification_hold:bool(inv.verification_hold),created_at:dt(inv.created_at)});
    const q=quotations.get(inv.quotation_id);
    const invoiceLines=q?.items||orders.get(inv.purchase_order_id)?.details?.items||[];
    invoiceLines.forEach((line,i)=>add('invoice_items',{id:fixedId(`invitem:${inv.id}:${i}`),business_id:inv.business_id,invoice_id:inv.id,
      line_no:i+1,item_name:line.name,item_code:line.code||null,quantity:num(line.quantity)||0,unit_price:num(line.unit_price)||0,
      discount_amount:num(line.discount)||0,line_total:(num(line.quantity)||0)*(num(line.unit_price)||0)-(num(line.discount)||0)}));
    if (inv.promise_to_pay_date) add('payment_promises',{id:fixedId(`promise:${inv.id}`),business_id:inv.business_id,
      purchase_order_id:orders.has(inv.purchase_order_id)?inv.purchase_order_id:null,invoice_id:inv.id,customer_id:inv.customer_id,
      promised_amount:num(inv.promise_amount),promised_date:day(inv.promise_to_pay_date),status:inv.promise_confirmed?'confirmed':'proposed',
      confirmed_by:inv.promise_confirmed?sellerId:null,confirmed_at:inv.promise_confirmed?dt(inv.created_at):null});
  }
  for(const p of state.payments) {
    if(!invoices.has(p.invoice_id) || p.verification_status!=='recorded') continue;
    add('payments',{id:p.id,business_id:p.business_id,invoice_id:p.invoice_id,amount:p.amount,payment_date:day(p.payment_date),
      method:p.method,reference:p.reference,verification_status:'recorded',verified_by:sellerId,verified_at:dt(p.created_at),created_at:dt(p.created_at)});
  }
  for(const credit of state.credits) {
    if (!invoices.has(credit.invoice_id)) continue;
    add('credits',{id:credit.id,business_id:credit.business_id,invoice_id:credit.invoice_id,amount:credit.amount,
      reason:credit.reason||null,status:'issued',created_at:dt(credit.created_at)});
  }
  for(const claim of state.paymentClaims) {
    const inv = invoices.get(claim.invoice_id);
    if(!inv) continue;
    add('payment_claims',{id:claim.id,business_id:claim.business_id,invoice_id:claim.invoice_id,
      customer_id:inv.customer_id,claimed_amount:claim.amount,reference:claim.reference,status:claim.status==='verified'?'verified':claim.status==='rejected'?'rejected':'pending_verification',
      reviewed_by:claim.reviewed_at?sellerId:null,reviewed_at:dt(claim.reviewed_at),created_at:dt(claim.created_at)});
  }
  for(const receipt of state.settlementReceipts) {
    if (!payments.has(receipt.payment_id)) continue;
    add('receipts',{id:receipt.id,business_id:receipt.business_id,payment_id:receipt.payment_id,
      receipt_number:receipt.receipt_number,issued_at:dt(receipt.issued_at),status:'issued',issued_by:sellerId});
  }
  for(const d of state.deliveryConfirmations) {
    const po=orders.get(d.purchase_order_id);if(!po)continue;
    const deliveryId=fixedId(`delivery:${po.id}`);
    if (!rows.deliveries.some(row=>row.id===deliveryId)) add('deliveries',{id:deliveryId,business_id:po.business_id,
      purchase_order_id:po.id,customer_id:po.customer_id,delivery_date:day(d.confirmed_at),status:'confirmed',
      acceptance_status:'seller_recorded',confirmed_by:sellerId,notes:'Seller-recorded quantities, not independent buyer acceptance.'});
    const ix=po.details?.items.findIndex(x=>x.name===d.item_name);
    add('delivery_items',{id:d.id,business_id:d.business_id,delivery_id:deliveryId,
      purchase_order_item_id:ix>=0?poItems.get(`${po.id}:${ix}`):null,line_no:Math.max(1,ix+1),item_name:d.item_name,
      quantity_delivered:d.accepted_quantity,quantity_accepted:d.accepted_quantity});
  }
  for(const oc of state.orderCases) {
    const po=orders.get(oc.purchase_order_id);if(!po)continue;
    add('payment_blockers',{id:oc.id,business_id:oc.business_id,purchase_order_id:oc.purchase_order_id,
      blocker_code:oc.kind,description:oc.reason,next_action:'Seller review required',status:oc.status,
      resolved_by:oc.resolved_at?sellerId:null,resolved_at:dt(oc.resolved_at),created_at:dt(oc.opened_at)});
    if(oc.kind==='dispute') add('dispute_cases',{id:oc.id,business_id:oc.business_id,purchase_order_id:oc.purchase_order_id,
      customer_id:po.customer_id,reason_code:'commercial_dispute',description:oc.reason,status:oc.status,
      resolution:oc.resolution_note,resolved_by:oc.resolved_at?sellerId:null,resolved_at:dt(oc.resolved_at),created_at:dt(oc.opened_at)});
  }
  for (const f of state.followUpActions) {
    if(!customers.has(f.customer_id)) continue;
    add('follow_up_actions',{id:f.id,business_id:f.business_id,invoice_id:invoices.has(f.invoice_id)?f.invoice_id:null,
      customer_id:f.customer_id,kind:'invoice_follow_up',checkpoint:num(f.checkpoint),reason:f.reason,message:f.message||'',
      message_version:num(f.message_version)||1,approval_state:f.approval_state,approved_by:validUser(f.approved_by)?f.approved_by:null,
      approved_at:dt(f.approved_at),approved_message_hash:f.approved_message_hash||null,send_state:f.send_state,
      recipient_email:customers.get(f.customer_id)?.email||null,sent_at:dt(f.sent_at),delivery_status:f.delivery_status||null,
      created_at:dt(f.created_at),updated_at:dt(f.updated_at)});
  }
  for(const r of state.customerResponses) add('customer_responses',{id:r.id,business_id:r.business_id,
    invoice_id:invoices.has(r.invoice_id)?r.invoice_id:null,customer_id:customers.has(r.customer_id)?r.customer_id:null,
    follow_up_action_id:state.followUpActions.some(f=>f.id===r.follow_up_action_id)?r.follow_up_action_id:null,
    message:r.message||'',ai_category:r.ai_category||null,ai_confidence:num(r.ai_confidence),
    ai_suggested_action:r.ai_suggested_action||null,ai_proposed_date:day(r.ai_extracted_date),review_status:r.review_status,created_at:dt(r.created_at)});
  const blobs=new Map(evidenceRows.map(b=>[b.id,b]));
  for(const e of state.orderEvidence) {
    const b=blobs.get(e.id); if(!b)continue;
    add('documents',{id:e.id,business_id:e.business_id,purchase_order_id:orders.has(e.purchase_order_id)?e.purchase_order_id:null,
      customer_id:orders.get(e.purchase_order_id)?.customer_id||null,document_type:e.kind,source:'upload',
      original_filename:e.filename,mime_type:e.mime_type,file_size_bytes:b.bytes.length,sha256:b.sha256,
      storage_key:`mariadb:nw_evidence_blobs:${e.id}`,uploaded_by:sellerId,uploaded_at:dt(e.saved_at)});
  }
  for(const a of state.activityEvents) add('activity_events',{id:a.id,business_id:a.business_id,
    purchase_order_id:orders.has(a.metadata?.order_id)?a.metadata.order_id:null,invoice_id:invoices.has(a.invoice_id)?a.invoice_id:null,
    event_type:a.event_type,actor_label:a.actor,actor_role:a.actor_role,description:a.description,metadata_json:json(a.metadata),created_at:dt(a.created_at)});
  for(const n of state.notifications) add('notifications',{id:n.id,business_id:n.business_id,title:n.title,body:n.body,kind:n.kind||'info',
    link:n.link||null,is_read:bool(n.read),created_at:dt(n.created_at)});
  for(const a of state.aiConversations) add('ai_conversations',{id:a.id,business_id:a.business_id,
    user_id:validUser(a.user_id)?a.user_id:null,role:a.role,content:a.content,created_at:dt(a.created_at)});
  return rows;
}

class MemoryDb {
  constructor(records = {}) {
    this.tables = Object.fromEntries(['state','receipts','sent','po_evidence'].map(table=>[table,new Map(records[table]||[])]));
    this.transactionBackup = null;
  }
  close() {}
  exec(sql) {
    const cmd=sql.trim().toUpperCase();
    if(cmd.startsWith('BEGIN')) {this.transactionBackup=structuredClone(this.tables);return;}
    if(cmd.startsWith('COMMIT')) {this.transactionBackup=null;return;}
    if(cmd.startsWith('ROLLBACK')) {if(this.transactionBackup)this.tables=this.transactionBackup;this.transactionBackup=null;return;}
    if(cmd.startsWith('DELETE FROM RECEIPTS')) {this.tables.receipts.clear();this.tables.sent.clear();
      for(const key of this.tables.state.keys()) if(key.startsWith('telegram-link:'))this.tables.state.delete(key);return;}
    if(cmd.startsWith('PRAGMA'))return; // sqlite schema declaration is not needed in memory
    throw Error(`Unsupported in-memory statement: ${cmd.slice(0,70)}`);
  }
  prepare(statement) {
    const sql=statement.replace(/\s+/g,' ').replace(/\s*=\s*/g,' = ').trim();
    const select=/^SELECT (.+?) FROM (state|sent|receipts|po_evidence)(?: WHERE (.+))?$/i.exec(sql);
    const del=/^DELETE FROM (state|sent|receipts) WHERE id = \?$/i.exec(sql);
    const ins=/^INSERT INTO (state|sent|receipts|po_evidence) /i.exec(sql);
    const all=(...args)=>{
      if(!select) throw Error(`Unsupported SELECT: ${sql}`);
      let data=[...this.tables[select[2]].values()];
      if(select[3]) {
        if(/id = \? AND business_id = \?/i.test(select[3]))data=data.filter(r=>r.id===args[0]&&r.business_id===args[1]);
        else if(/business_id = \? AND sha256 = \?/i.test(select[3]))data=data.filter(r=>r.business_id===args[0]&&r.sha256===args[1]);
        else if(/id = \?/i.test(select[3]))data=data.filter(r=>r.id===args[0]);
        else throw Error(`Unsupported WHERE: ${select[3]}`);
      }
      if(select[1]!=='*') {
        const fields=select[1].split(',').map(x=>x.trim());
        data=data.map(row=>Object.fromEntries(fields.map(x=>[x,row[x]])));
      }
      return data;
    };
    const run=(...args)=>{
      if(del) {this.tables[del[1]].delete(args[0]);return {changes:1};}
      if(ins) {
        const name=ins[1];
        const row=name==='po_evidence' ? {id:args[0],business_id:args[1],filename:args[2],content_type:args[3],bytes:args[4],sha256:args[5],created_at:args[6]}
          : name==='state'?{id:args[0],value:args[1]}:{id:args[0],payload:args[1]};
        this.tables[name].set(row.id,row);
        return {changes:1};
      }
      throw Error(`Unsupported memory query: ${sql}`);
    };
    return {get:(...args)=>all(...args)[0],all,run};
  }
}

function tableOrder(dependencies) {
  const indegree=new Map(PROJECTED.map(n=>[n,0]));
  const outgoing=new Map(PROJECTED.map(n=>[n,new Set()]));
  for(const [child,parent] of dependencies) {
    if(child===parent || !indegree.has(child) || !indegree.has(parent) || outgoing.get(parent).has(child))continue;
    outgoing.get(parent).add(child);indegree.set(child,indegree.get(child)+1);
  }
  const todo=[...indegree].filter(([,d])=>!d).map(([t])=>t);const result=[];
  while(todo.length) {const n=todo.shift();result.push(n);
    for(const c of outgoing.get(n)) {indegree.set(c,indegree.get(c)-1);if(!indegree.get(c))todo.push(c);}
  }
  if(result.length!==PROJECTED.length)throw Error('Unexpected cyclic foreign key dependencies in the NudgeWise schema');
  return result;
}

async function writeProjection(connection, order, projected) {
  // Rebuild only the dedicated demo schema projection, in the SAME transaction
  // as the authoritative snapshot. Do not manually edit these tables in phpMyAdmin.
  for(const t of [...order].reverse()) await connection.query(`DELETE FROM \`${t}\``);
  for(const t of order) for(const record of projected[t]) {
    const columns=Object.keys(record);
    await connection.execute(`INSERT INTO \`${t}\` (${columns.map(k=>`\`${k}\``).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,
      columns.map(k=>record[k]===undefined?null:record[k]));
  }
}

async function connectMariaDb() {
  const mysql=require('mysql2/promise');
  const name=process.env.DB_NAME||'nudgewise_db';
  if(!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name))throw Error('Invalid DB_NAME');
  if(!process.env.DB_USER) throw Error('DB_USER must be set in .env');
  const pool=mysql.createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:name,waitForConnections:true,
    connectionLimit:2,timezone:'Z',dateStrings:true,multipleStatements:false,enableKeepAlive:true});
  try {
    const [existing]=await pool.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [name]);
    const found=new Set(existing.map(r=>r.TABLE_NAME));const missing=PROJECTED.filter(t=>!found.has(t));
    if(missing.length)throw Error(`Import Phase 0 SQL into ${name} before starting: missing ${missing.join(', ')}`);
    const [fks]=await pool.query(`SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`, [name]);
    const order=tableOrder(fks.map(r=>[r.TABLE_NAME,r.REFERENCED_TABLE_NAME]));
    await pool.execute('CREATE TABLE IF NOT EXISTS nw_runtime_state (state_key VARCHAR(100) PRIMARY KEY, state_json LONGTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB');
    await pool.execute('CREATE TABLE IF NOT EXISTS nw_evidence_blobs (id CHAR(36) PRIMARY KEY, business_id VARCHAR(36) NOT NULL, filename VARCHAR(255) NOT NULL, content_type VARCHAR(100) NOT NULL, bytes LONGBLOB NOT NULL, sha256 CHAR(64) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_biz_hash (business_id, sha256)) ENGINE=InnoDB');
    const [saved]=await pool.execute('SELECT state_json FROM nw_runtime_state WHERE state_key=?',[APP_KEY]);
    if (!saved.length) {
      const [[{n}]] = await pool.query('SELECT (SELECT COUNT(*) FROM customers) + (SELECT COUNT(*) FROM purchase_orders) + (SELECT COUNT(*) FROM invoices) AS n');
      if (Number(n) > 0) throw Error('MariaDB contains records but has no NudgeWise runtime snapshot. Refusing to overwrite existing records. Use a fresh database.');
    }
    const [blobs]=await pool.query('SELECT * FROM nw_evidence_blobs');
    const records={state:saved.length?[[APP_KEY,{id:APP_KEY,value:saved[0].state_json}]]:[],po_evidence:blobs.map(r=>[r.id,r])};
    const database=new MemoryDb(records);
    let lastSignature='';
    let lastSavedState = saved.length ? saved[0].state_json : null;
    let lastSavedEvidence = structuredClone(database.tables.po_evidence);
    const persist=async()=>{
      const stateString=database.tables.state.get(APP_KEY)?.value;
      if(!stateString)throw Error('NudgeWise store is not initialized');
      const evidenceRows=[...database.tables.po_evidence.values()];
      const signature=createHash('sha256').update(stateString).update(evidenceRows.map(r=>r.sha256).sort().join('|')).digest('hex');
      if(signature===lastSignature)return;
      const projected=projectState(JSON.parse(stateString),evidenceRows);
      const conn=await pool.getConnection();
      try {
        await conn.beginTransaction();
        for(const e of evidenceRows) await conn.execute(`INSERT INTO nw_evidence_blobs
          (id,business_id,filename,content_type,bytes,sha256,created_at) VALUES (?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE filename=VALUES(filename)`,
          [e.id,e.business_id,e.filename,e.content_type,e.bytes,e.sha256,dt(e.created_at)]);
        await writeProjection(conn,order,projected);
        await conn.execute(`INSERT INTO nw_runtime_state (state_key,state_json) VALUES (?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)`,[APP_KEY,stateString]);
        await conn.commit();lastSignature=signature;lastSavedState=stateString;lastSavedEvidence=structuredClone(database.tables.po_evidence);
      }catch(error){
        await conn.rollback();
        // Do not display uncommitted changes after a failed MariaDB write.
        if(lastSavedState){
          database.tables.state.set(APP_KEY,{id:APP_KEY,value:lastSavedState});
          require('../.server-build/lib/store.js').replaceSnapshot(JSON.parse(lastSavedState));
        }
        database.tables.po_evidence=structuredClone(lastSavedEvidence);
        throw error;
      }finally{conn.release();}
    };
    return {database,persist,close:()=>pool.end(),projectState};
  }catch(error){await pool.end();throw error;}
}
module.exports={connectMariaDb,MemoryDb,projectState,tableOrder};
