const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/presentation/blockerRequest.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const mod = import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const facts = { kind: 'quantity_mismatch', buyerName: 'Cafe Bunga', orderRef: 'ORD-1002', sellerName: 'Kak Siti Kuih', itemName: 'Kuih lapis box', ordered: 100, accepted: 80 };

test('mismatch request states the recorded counts and offers both outcomes in each language', async () => {
  const { draftBlockerRequest } = await mod;
  const en = draftBlockerRequest(facts, 'en');
  assert.match(en, /80 of 100 Kuih lapis box/); assert.match(en, /remaining 20/); assert.match(en, /credit note/);
  assert.match(en, /Kak Siti Kuih$/);
  assert.match(draftBlockerRequest(facts, 'ms'), /80 daripada 100/);
  assert.match(draftBlockerRequest(facts, 'zh'), /已验收 80 件/);
});

test('every request kind drafts in every language without threats or new deadlines', async () => {
  const { draftBlockerRequest } = await mod;
  for (const kind of ['quantity_mismatch', 'missing_po', 'payment_claim', 'issue', 'quotation'])
    for (const lang of ['en', 'ms', 'zh']) {
      const text = draftBlockerRequest({ ...facts, kind, invoiceNumber: 'INV-9', quotationRef: 'QT-9' }, lang);
      assert.ok(text.length > 40 && text.length < 600, `${kind}/${lang}`);
      assert.doesNotMatch(text, /legal|penalt|interest|within \d+ days|undefined/i, `${kind}/${lang}`);
    }
});

test('WhatsApp link needs a real number and encodes the message', async () => {
  const { whatsappLink } = await mod;
  assert.equal(whatsappLink('+60 12-345 6789', 'Hi & thanks'), 'https://wa.me/60123456789?text=Hi%20%26%20thanks');
  assert.equal(whatsappLink('', 'x'), null);
  assert.equal(whatsappLink('12', 'x'), null);
});
test('quotation and PO drafts preserve saved currency, terms and references in all languages',async()=>{
 const {draftBlockerRequest,documentRequestSubject}=await mod;
 for(const lang of ['en','ms','zh'])for(const kind of ['share_quotation','share_order']){
  const f={...facts,kind,quotationRef:'SGD-Q-1',amount:'SGD 760.00',paymentTerms:'50% deposit',validUntil:'2026-11-01',documentStatus:'draft'};
  const text=draftBlockerRequest(f,lang);const reference=kind==='share_quotation'?'SGD-Q-1':'ORD-1002';
  for(const value of [reference,'SGD 760.00','50% deposit','draft',facts.buyerName,facts.sellerName])assert.ok(text.includes(value),kind+'/'+lang+': '+value);
  assert.ok(!text.includes('MYR'));assert.ok(documentRequestSubject(f,lang).includes(reference));
  assert.equal(text.includes('2026-11-01'),kind==='share_quotation');
 }
});
