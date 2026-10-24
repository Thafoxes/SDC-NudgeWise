const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/presentation/paymentRequest.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const output={exports:{}};new Function('require','module','exports',code)(require,output,output.exports);
const {paymentEmailLink,demoPaymentLink,draftPaymentRequest}=output.exports;
test('email draft addresses the buyer and encodes subject/body without additional recipients',()=>{
 const link=paymentEmailLink('buyer@example.test','Invoice & request','Balance SGD 760.00\nDemo link: https://example.test/#/demo-payment?amount=760&currency=SGD');
 assert.ok(link.startsWith('mailto:buyer%40example.test?'));const params=new URLSearchParams(link.split('?')[1]);assert.equal(params.get('subject'),'Invoice & request');assert.match(params.get('body'),/SGD 760.00/);assert.equal(params.has('bcc'),false);
});
test('invalid recipient and header injection do not create an email link',()=>{
 for(const address of ['','invalid','one@example.test,two@example.test','buyer@example.test?bcc=other@example.test','buyer@example.test\r\nBcc: other@example.test'])assert.equal(paymentEmailLink(address,'Invoice','Body'),null);
 assert.equal(paymentEmailLink('buyer@example.test','Invoice\r\nBcc: other@example.test','Body'),null);
});
test('demo payment link preserves deployment path and safely encodes current currency and reference',()=>{
 const link=demoPaymentLink('https://demo.example.test/app/?old=1#/orders/123/view','INV & SGD',560,'SGD');const url=new URL(link);assert.equal(url.pathname,'/app/');assert.equal(url.search,'');const params=new URLSearchParams(url.hash.split('?')[1]);assert.equal(params.get('reference'),'INV & SGD');assert.equal(params.get('amount'),'560.00');assert.equal(params.get('currency'),'SGD');assert.ok(url.hash.startsWith('#/demo-payment?'));
});
test('payment request uses the actual balance and labels the demo link without claiming payment',()=>{
 const text=draftPaymentRequest('Buyer','Seller','INV-1',560,'SGD','2026-10-31','https://demo.example.test/#/demo-payment');
 for(const value of ['Hello Buyer','SGD 560.00','2026-10-31','no real payment is processed','do not make a duplicate payment','Seller'])assert.ok(text.includes(value),value);assert.ok(!text.includes('MYR'));
});

test('all three languages retain invoice facts, demo warning and Unicode email content',()=>{
 const labels={en:'no real payment is processed',ms:'tiada bayaran sebenar diproses',zh:'不会处理真实付款'};
 for(const lang of ['en','ms','zh']){
  const body=draftPaymentRequest('Buyer','Seller','INV-3',560,'SGD','2026-10-31','https://demo.example.test/payment',lang);
  for(const value of ['INV-3','SGD 560.00','2026-10-31','https://demo.example.test/payment',labels[lang]])assert.ok(body.includes(value),lang+': '+value);
  const subject=output.exports.paymentRequestSubject('INV-3',lang);const params=new URLSearchParams(paymentEmailLink('buyer@example.test',subject,body).split('?')[1]);assert.equal(params.get('subject'),subject);assert.equal(params.get('body'),body);
 }
 assert.match(output.exports.paymentRequestSubject('INV-3','ms'),/Permintaan bayaran/);assert.match(output.exports.paymentRequestSubject('INV-3','zh'),/付款提醒/);
});
