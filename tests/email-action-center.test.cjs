'use strict';
// Source wiring checks for migration of Gmail records into Action Center.
// End-to-end browser/mailbox behaviour still requires local UAT.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=(name)=>fs.readFileSync(path.join(root,name),'utf8');

test('Action Center loads the Phase 8 Gmail sidecar overview (not only legacy customerResponses)',()=>{
 const code=get('src/views/ActionCenterView.vue');
 assert.match(code, /\/api\/email\/overview/);
 assert.match(code, /gmailReplies/);
 assert.match(code, /Received Gmail Replies/);
 assert.match(code, /No buyer replies in this view/);
});
test('Action Center supports Gmail thread sync, buyer evidence and linked-order review',()=>{
 const code=get('src/views/ActionCenterView.vue');
 assert.match(code, /\/api\/email\/sync/);
 assert.match(code, /View original email evidence/);
 assert.match(code, /Review related order/);
 assert.match(code, /document_kind==='test'/);
 assert.match(code, /review_state==='pending'/);
});
test('Email history and email tasks live in Action Center rather than Settings',()=>{
 const action=get('src/views/ActionCenterView.vue');
 const settings=get('src/components/EmailPhase8.vue');
 assert.match(action, /Email History/);
 assert.match(action, /Email Follow-up Tasks/);
 assert.match(action, /\/api\/email\/resolve-task/);
 for(const heading of ['Received Buyer Replies · Seller Review','Email History (Gmail acceptance','Per-Invoice Reminder Controls','Manual Follow-up Tasks']){
  assert.doesNotMatch(settings, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 }
});
test('No email send, approval, or database schema operation is introduced by the UI move',()=>{
 const code=get('src/views/ActionCenterView.vue');
 assert.doesNotMatch(code, /\/api\/email\/send\b/);
 assert.doesNotMatch(code, /\/api\/email\/preference\b/);
 assert.doesNotMatch(code, /\/api\/email\/approve-quotation\b/);
});
