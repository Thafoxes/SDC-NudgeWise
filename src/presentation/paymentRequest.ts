import type {RequestLang} from './blockerRequest';
export function paymentEmailLink(email:string,subject:string,message:string):string|null {
 const address=email.trim();
 if(/[\r\n]/.test(email)||/[\r\n]/.test(subject))return null;
 if(!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(address))return null;
 return `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
export function demoPaymentLink(base:string,reference:string,amount:number,currency:string):string {
 const url=new URL(base);url.hash='';url.search='';
 const params=new URLSearchParams({reference,amount:amount.toFixed(2),currency});
 url.hash=`/demo-payment?${params}`;return url.toString();
}
export function paymentRequestSubject(reference:string,lang:RequestLang='en'):string {
 return `${lang==='ms'?'Permintaan bayaran':lang==='zh'?'付款提醒':'Payment request'} - ${reference}`;
}
export function draftPaymentRequest(buyer:string,seller:string,reference:string,amount:number,currency:string,dueDate:string,link:string,lang:RequestLang='en'):string {
 if(lang==='ms')return `Salam ${buyer},\n\nSila semak invois ${reference}.\nBaki belum dibayar: ${currency} ${amount.toFixed(2)}\nTarikh akhir bayaran: ${dueDate}\n\nPautan bayaran demo (untuk demonstrasi sahaja; tiada bayaran sebenar diproses):\n${link}\n\nJika anda sudah membayar, sila kongsikan rujukan bayaran untuk pengesahan kami. Jangan buat bayaran dua kali.\n\nTerima kasih,\n${seller}`;
 if(lang==='zh')return `您好，${buyer}：\n\n请查阅发票 ${reference}。\n未付余额：${currency} ${amount.toFixed(2)}\n付款到期日：${dueDate}\n\n演示付款链接（仅供演示，不会处理真实付款）：\n${link}\n\n如果您已付款，请提供付款参考编号，以便我们核实。请勿重复付款。\n\n谢谢！\n${seller}`;
 return `Hello ${buyer},\n\nPlease review invoice ${reference}.\nOutstanding balance: ${currency} ${amount.toFixed(2)}\nDue date: ${dueDate}\n\nDemo payment link (demonstration only; no real payment is processed):\n${link}\n\nIf you have already paid, please share the payment reference so we can verify it. Please do not make a duplicate payment.\n\nThank you,\n${seller}`;
}
