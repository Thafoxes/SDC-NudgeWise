/**
 * Drafts a short, polite message asking the buyer for what a blocker needs.
 * Display-only: it never sends anything. The seller copies it or opens it in WhatsApp and sends it themselves.
 * Facts come from recorded data; nothing is invented, and there are no threats, penalties or new deadlines.
 */
export type RequestKind = 'quantity_mismatch' | 'missing_po' | 'payment_claim' | 'issue' | 'quotation' | 'share_quotation' | 'share_order';
export type RequestLang = 'en' | 'ms' | 'zh';

export interface RequestFacts {
  kind: RequestKind;
  buyerName: string;
  orderRef: string;
  sellerName: string;
  itemName?: string;
  ordered?: number;
  accepted?: number;
  invoiceNumber?: string;
  quotationRef?: string;
  amount?: string;
  paymentTerms?: string;
  validUntil?: string;
  documentStatus?: string;
}

export const REQUEST_TITLES: Record<RequestKind, string> = {
  share_quotation: 'Share quotation for review',
  share_order: 'Share order / PO summary for review',
  quantity_mismatch: 'Confirm the accepted quantity',
  missing_po: "Ask for the buyer's PO",
  payment_claim: 'Ask for the payment reference',
  issue: 'Ask for details of the issue',
  quotation: 'Follow up on the quotation',
};

export function draftBlockerRequest(f: RequestFacts, lang: RequestLang): string {
  if(f.kind==='share_quotation'||f.kind==='share_order'){
    const quote=f.kind==='share_quotation',reference=quote?(f.quotationRef||f.orderRef):f.orderRef;
    const amount=f.amount||(lang==='ms'?'Untuk disahkan':lang==='zh'?'待确认':'To be confirmed');
    const terms=f.paymentTerms||(lang==='ms'?'Untuk disahkan':lang==='zh'?'待确认':'To be confirmed');
    const expiry=f.validUntil||(lang==='ms'?'Untuk disahkan':lang==='zh'?'待确认':'To be confirmed');
    if(lang==='ms')return `Salam ${f.buyerName},\n\nSila semak ${quote?'sebut harga':'ringkasan pesanan / PO'} ${reference}.\nJumlah: ${amount}\nStatus rekod: ${f.documentStatus||'-'}\nSyarat bayaran: ${terms}${quote?'\nHarga sah sehingga: '+expiry:''}\n\nSila sahkan butiran atau maklumkan perubahan yang diperlukan. Mesej ini tidak merekodkan persetujuan atau bayaran secara automatik.\n\nTerima kasih,\n${f.sellerName}`;
    if(lang==='zh')return `您好，${f.buyerName}：\n\n请查阅${quote?'报价单':'订单 / PO 摘要'} ${reference}。\n总额：${amount}\n记录状态：${f.documentStatus||'-'}\n付款条款：${terms}${quote?'\n价格有效期至：'+expiry:''}\n\n请确认详情，或告知需要修改的内容。此消息不会自动记录同意或付款。\n\n谢谢！\n${f.sellerName}`;
    return `Hello ${f.buyerName},\n\nPlease review ${quote?'quotation':'order / PO summary'} ${reference}.\nTotal: ${amount}\nRecorded status: ${f.documentStatus||'-'}\nPayment terms: ${terms}${quote?'\nPrices valid until: '+expiry:''}\n\nPlease confirm the details or let us know any changes needed. This message does not automatically record agreement or payment.\n\nThank you,\n${f.sellerName}`;
  }
  const short = f.ordered !== undefined && f.accepted !== undefined ? f.ordered - f.accepted : undefined;
  const item = f.itemName ?? '';
  const inv = f.invoiceNumber ? f.invoiceNumber : f.orderRef;
  const qt = f.quotationRef ?? f.orderRef;
  if (lang === 'ms') {
    const hi = `Salam ${f.buyerName},`;
    const bye = `Terima kasih.\n${f.sellerName}`;
    const body: Record<Exclude<RequestKind,'share_quotation'|'share_order'>, string> = {
      quantity_mismatch: `Rekod kami menunjukkan ${f.accepted} daripada ${f.ordered} ${item} diterima untuk pesanan ${f.orderRef}. Boleh sahkan jumlah ini? Beritahu kami sama ada anda mahu baki ${short} dihantar, atau nota kredit untuknya.`,
      missing_po: `Boleh kongsikan nombor pesanan belian (PO) untuk pesanan ${f.orderRef}? Kami perlukannya untuk mengeluarkan invois dengan betul.`,
      payment_claim: `Terima kasih kerana memaklumkan bayaran untuk ${inv}. Boleh kongsikan rujukan bayaran atau slip pemindahan supaya kami dapat memadankannya?`,
      issue: `Kami sedang menyemak isu yang dibangkitkan untuk pesanan ${f.orderRef}. Boleh kongsikan butiran atau gambar yang boleh membantu kami menyelesaikannya?`,
      quotation: `Susulan sebut harga ${qt}. Boleh sahkan sama ada ia diterima, atau beritahu kami jika ada perubahan?`,
    };
    return `${hi}\n\n${body[f.kind]}\n\n${bye}`;
  }
  if (lang === 'zh') {
    const hi = `${f.buyerName} 您好，`;
    const bye = `谢谢。\n${f.sellerName}`;
    const body: Record<Exclude<RequestKind,'share_quotation'|'share_order'>, string> = {
      quantity_mismatch: `我们的记录显示，订单 ${f.orderRef} 的 ${item} 共 ${f.ordered} 件，已验收 ${f.accepted} 件。请确认这个数量，并告诉我们剩余的 ${short} 件是需要补送，还是开具信用票据（credit note）。`,
      missing_po: `请提供订单 ${f.orderRef} 的采购单（PO）号码，以便我们正确开具发票。`,
      payment_claim: `感谢您告知 ${inv} 已付款。请提供付款参考号或转账凭证，以便我们核对。`,
      issue: `我们正在处理订单 ${f.orderRef} 的问题。请提供相关细节或照片，帮助我们尽快解决。`,
      quotation: `跟进报价单 ${qt}：请确认是否接受，或告诉我们需要修改的地方。`,
    };
    return `${hi}\n\n${body[f.kind]}\n\n${bye}`;
  }
  const hi = `Hi ${f.buyerName},`;
  const bye = `Thank you.\n${f.sellerName}`;
  const body: Record<Exclude<RequestKind,'share_quotation'|'share_order'>, string> = {
    quantity_mismatch: `Our records show ${f.accepted} of ${f.ordered} ${item} were accepted for order ${f.orderRef}. Could you confirm this count, and let us know whether you would like the remaining ${short} delivered or a credit note for them?`,
    missing_po: `Could you share the purchase order (PO) number for order ${f.orderRef}? We need it to issue the invoice correctly.`,
    payment_claim: `Thank you for letting us know about the payment for ${inv}. Could you share the payment reference or transfer slip so we can match it?`,
    issue: `We are looking into the issue raised on order ${f.orderRef}. Could you share any details or photos that would help us resolve it?`,
    quotation: `Following up on quotation ${qt}. Could you confirm whether it is accepted, or let us know of any changes?`,
  };
  return `${hi}\n\n${body[f.kind]}\n\n${bye}`;
}

/** WhatsApp click-to-chat link; the seller still presses send in WhatsApp. Returns null without a usable number. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function documentRequestSubject(f:RequestFacts,lang:RequestLang):string {
 const quote=f.kind==='share_quotation';const label=lang==='ms'?(quote?'Semakan sebut harga':'Semakan pesanan / PO'):lang==='zh'?(quote?'报价单审核':'订单 / PO 审核'):(quote?'Quotation for review':'Order / PO summary for review');
 return `${label} - ${quote?(f.quotationRef||f.orderRef):f.orderRef}`;
}
