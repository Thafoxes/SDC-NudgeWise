# Sales, direct invoices and customer orders

Start in **Invoices → New quick sale / invoice** for a small B2B transaction with agreed items and prices. Use **Orders** for sales that need quotation negotiation, an uploaded buyer PO, or a longer delivery workflow. **Customers** lets you find or add the customer in either flow.

## Quick sale / direct invoice (POS or small B2B)

Use this when the customer has agreed the items and prices and you want an invoice immediately. A quotation or buyer-issued PO is not required. The system retains a direct-sale order record for delivery, later payments and adjustments; quotation and buyer-PO steps are explicitly **skipped**, not marked as accepted.

### Start the sale

1. Open **Invoices → New quick sale / invoice**.
2. Find and select an existing customer, or use **Add Customer** to create one. Anonymous/walk-in customer records are not created automatically.
3. Check the invoice reference and issue date. Supplier contacts, salesperson and currency come from Settings.
4. Enter item descriptions, quantities, unit prices and line discounts. A discount is an amount for the whole line, not a percentage. The displayed total is the amount invoiced. Combine repeated descriptions or use distinct descriptions so later delivery review can identify each line.
5. Choose **Paid immediately** or **Pay later / credit sale**.

### Optional order screenshot / PDF extraction

Use **Read order screenshot or PDF** on the quick-sale form. PNG, JPG and PDF are accepted (10 MB maximum; OCR reads up to five pages). Local Docling extracts text and the configured local/cloud model proposes requested item names, quantities and explicitly shown unit prices/line discounts. Missing prices stay blank. The buyer name is only a suggestion: select or add the correct customer yourself.

Uploading can replace the current item rows after confirmation. Check every proposal against **View original**, enter missing prices, and confirm the company currency. Percentage discounts, taxes and unsupported extra fees need manual review; they are not silently added. Tick the extracted-item review confirmation before issuing the invoice. Editing items resets the review and payment confirmations. Extraction failure keeps the original attachment and a manual-entry path; no sample items or invented successful result is substituted.

The original is linked to the sale only when you issue the invoice. Removing an attachment from the form does not erase an already uploaded original from evidence storage.

### Paid immediately

1. Confirm that all listed goods were handed over and accepted.
2. Select the payment method, optionally enter a transaction reference, and record the verification source, such as counted cash or a settled credit checked in bank records. Optionally upload a bank-transfer confirmation or card receipt under **Bank transfer / card receipt attachment**.
3. Tick the funds-received confirmation. A screenshot, pending transfer, unconfirmed card transaction or uncleared cheque is not verification.
4. Click **Issue invoice, receipt and complete sale**. The whole invoice amount is recorded once, the final receipt is issued, delivery acceptance is recorded and the sale is completed. No quotation is fabricated.
5. Invoice Details opens automatically. Use **View / print invoice PDF** or **View / print final receipt**. Use the PDF viewer’s print action to print the document.

If funds or goods are not confirmed, use Pay later instead and record the outstanding steps later. Do not select Paid immediately merely because the buyer showed a transfer screenshot.

### Pay later / credit sale

1. Enter the agreed due date (on or after the issue date).
2. Tick the handover checkbox only if the customer already received all goods; otherwise leave it unchecked.
3. Click **Issue invoice on agreed terms**. The invoice is issued with its balance outstanding. This creates no payment or receipt, even if payment fields were filled before switching modes.
4. Later, open the invoice and use **Record verified payment** after checking the funds received. Partial payments remain outstanding until fully settled. Alternatively, record a buyer payment claim and review it using the existing verification workflow.
5. Once settled, confirm settlement and issue the final receipt. If delivery was not recorded at the sale, open the linked order and record delivery acceptance or resolve its shortfall.
6. Click **Complete order** once the final receipt, delivery and any holds are resolved. No quotation is required for this direct-sale record.

### Payment receipt images and PDFs

Quick sale accepts optional PNG/JPG/PDF bank-transfer or card-receipt attachments (up to 10 MB). An image preview and **View full attachment** let you check the original. Payment proofs are retained as supporting evidence without running OCR or sending their contents to the cloud model. Adding or replacing one resets the funds-confirmation checkbox; it does not set the invoice to paid or change the amount.

When the sale is issued, the proof is linked to its order and, for Paid immediately, to the recorded payment. It remains accessible from Invoice Details under **Payment attachments** and **Payment History → View attached payment receipt**. Switching to Pay later retains the attachment as unverified supporting evidence and records no payment.

For a later payment, open **Invoice Details → Record verified payment**. Upload a receipt or select an existing payment-proof attachment, choose the payment method (including Card), enter the amount/date/reference, and explicitly confirm the funds check. The saved payment retains the attachment link. The order’s supporting-evidence uploader can also retain a payment proof independently of a payment.

Attachments must belong to the current business and sale. A receipt image or transfer screenshot is never independent proof of settled funds; pending, rejected or reversed transfers must not be recorded as received merely because a file exists.

### Holds, corrections and retries

- Only the seller can issue a quick-sale invoice. Customer dispute/settlement holds still require a specific seller exception reason for this sale; the exception does not clear old invoices or disputes.
- Saving validates the invoice reference, customer scope, dates, item amounts, and the funds/handover confirmations before adding records. A duplicate invoice reference is rejected to prevent repeated collections. If a request appears to fail, check the invoice list before creating a second sale under another reference.
- Issued direct-sale items are not editable through a quotation. Use the existing credit-note and debit-note workflows for agreed changes; delivery shortfall credits use the issued item prices. Refund handling is not implemented, so a credit cannot exceed the remaining outstanding balance.
- This is a seller-recorded demo, not an integrated payment terminal or statutory e-invoice service. The application does not independently confirm a bank transaction. [Seller settings](#seller-settings-and-document-preparer) control the document details.

## Empty workspace and recovery

The app starts without sample customers, invoices, payments, orders, messages or notifications. Resetting returns to an empty workspace. The minimum workspace/seller configuration remains so the app can operate. Synthetic regression records live only in `tests/fixtures/business-data.json` and are loaded explicitly by tests.

On the first upgrade, known sample IDs and their linked transactions are removed; manually created customers and orders are retained. A recovery copy of the prior state is stored under `nudgewise-demo-v1.1-before-sample-cleanup` in the browser or backend state table. The existing local database was also backed up under `.local-data/backups/` before cleanup. Do not commit backups or original business documents.

## Full PO entry and original evidence

Upload a PNG, JPG or PDF in **Purchase orders**, or enter the fields manually. OCR proposes the reference, dates, buyer/supplier contacts and addresses, delivery instructions, terms, requested-by/approved-by names, department, notes, line items and printed total when visible. Buyer and supplier are distinct: a supplier email is not a customer billing email.

The original file bytes are stored in SQLite's `po_evidence` BLOB table with a SHA-256 hash, filename, content type, business and upload time. Repeated uploads of identical bytes reuse the evidence record within that business. Saving the PO links its evidence ID; use **Open original PO evidence** after reopening the order. The original remains unchanged when reviewed fields are corrected. It is not included in browser state snapshots.

PO extraction enables Docling table recognition. Duplicate item rows are retained. Check each quantity, price and discount (an amount per line), and explicitly confirm the three-letter currency. A bare `$` does not establish USD. Calculated totals use rounded line values; a disagreement with the entered printed total requires correction or an explicit seller override before processing approval. A printed status such as “Closed Completed” or an approver's name is source text, not NudgeWise approval.

All fields remain editable on a draft; save changes before approval. Approved POs are read only. If AI extraction fails, the original is still retained and a manual-entry path is shown. The current worker is limited to five pages and 10 MiB. It may miss a footer total or other text, so missing fields must be confirmed manually.

The supplied `tests/fixtures/PO.png` was checked with real local OCR and the approved Ollama cloud model: reference PO00495, distinct buyer/supplier and seven item rows were extracted. Currency remained unknown and the footer total was not extracted. The line items calculate to 228.47.

## Find or add a customer

Enter a phone number. Malaysian national numbers and their international equivalents match the same customer; other countries require an explicit country code. One match loads the record. Shared-phone matches require selection; they are never merged. Lookup stays within the current business and does not authenticate a customer.

If no record matches, enter the company name, phone, billing email, and optional address. With the backend enabled, a PDF, JPG, or PNG can supply proposed details through OCR and AI. Review and correct every field, then confirm before saving. Saving repeats the phone check so an edited OCR result cannot create a duplicate.

Customer OCR accepts up to 10 MiB and uses the existing worker's five-page limit. The uploaded file is temporary and deleted after extraction, including failure; only confirmed contact fields are saved. It is not retained as transaction evidence. Missing/ambiguous data stays editable and never authorizes an order automatically.

## Order hold

The order gate is separate from customer priority colours. It blocks approval when any customer invoice has:

- An active dispute, even if its adjusted balance is zero.
- A previous dispute and a remaining balance requiring settlement.
- An outstanding verification hold on that disputed obligation.

Ordinary overdue invoices alone do not trigger this particular policy. Only recorded payments and existing approved credit records reduce the balance; pending/flagged payments do not. Resolving a dispute alone does not clear its settlement requirement. After the dispute is resolved and settlement is confirmed, the next approval check can allow the order.

Old snapshots gain an empty order collection without a reset. Active disputes and available historical dispute events/replies restore the durable settlement marker. A historical dispute with no surviving evidence cannot be reconstructed automatically.

## Seller override

Seller or staff can save a buyer PO reference as a draft while held. Only the demo seller can approve processing. If held, or if calculated line totals differ from the printed total, a non-empty reason is required for an override. The seller must confirm the exception in a confirmation dialog. Total exceptions retain the calculated and printed amounts in the order and activity history; they do not change either amount. The order and activity log retain the reason, seller, time, and blocking invoice/balance snapshot.

The exception applies to that order only. It never clears invoice disputes, changes balances, releases reminder holds, or approves another PO. The backend repeats the eligibility check during approval rather than trusting an earlier screen result.

## Try the demo

1. Open **Purchase orders** and upload a PO; review the original and proposed fields.
2. Choose **Use these buyer details to find or add customer**, confirm the phone country code, and find the customer.
3. Review or add the customer. Email is optional when it is absent from the document.
4. Correct the PO fields, line items, printed total and currency; confirm review and save the draft.
5. Review eligibility and approve processing. A hold requires settlement/resolution or a reasoned seller exception for that PO.
6. Reopen the saved order and open its original evidence. An exception does not release old invoice holds or future orders.

## Run and verify

- Browser-only mode: set `VITE_BACKEND_ENABLED=false`, then run `npm run dev`. Manual intake and order approval use the existing browser store; OCR is clearly disabled.
- Backend mode: set `VITE_BACKEND_ENABLED=true`. Run `npm run server` and `npm run dev`. Existing environment changes require restarting the relevant process.
- OCR additionally needs the existing `DOCLING_PYTHON`, `OLLAMA_API_KEY`, and `OLLAMA_MODEL` configuration. Incoming contact text is sent to the configured cloud model for extraction.
- `npm run test:logic`: existing invoice/language checks plus phone, duplicate, hold, migration, scope, and override tests.
- `npm run test:customers`: mocked customer OCR and backend approval tests, including bounded file validation and cleanup. No paid model calls.
- `npm run test:po`: empty-start/sample-cleanup checks, exact PNG evidence retention across restart, extraction failure, business isolation, numeric validation and draft/approval checks.
- `npm run build`: application typecheck and production build.

This remains a shared-access demo: role/name checks enforce the simulated business rules but do not authenticate a real seller. Do not use genuine business/customer records or treat an override as production authorization.

## Where to make changes

- `src/lib/customerOrders.ts`: phone matching, input validation, order eligibility, creation and approval.
- `src/lib/store.ts`: backward-compatible state migration and business-scoped balance calculations.
- `src/components/CustomerIntake.vue`: shared customer lookup and reviewed contact form.
- `src/views/OrdersView.vue`: order holds, draft references, approval and exception display.
- `src/components/PurchaseOrderForm.vue`: complete editable PO form, upload, evidence link and item table.
- `src/lib/purchaseOrder.ts`: PO field validation and line/total calculations.
- `src/services/commands.ts`: local/backend transport, independent backend setting, document upload helper.
- `server/app.cjs`: bounded document intake and business-scoped command routing.
- `server/integrations.cjs`: OCR + model customer extraction and output validation.
- `tests/customer-orders*.test.cjs`: domain and backend regression checks.

For the full project relationships, see [the navigation guide](project-map.md) and [Graphify report](../graphify-out/GRAPH_REPORT.md).

## Approve a reviewed order with an exception

1. Open the draft order in edit mode. Save any unsaved changes first.
2. Review the displayed customer hold and/or calculated-versus-printed totals.
3. Correct mistakes when possible. For a direct order with no buyer PO, leave the printed total blank rather than inventing a document total.
4. If the seller decides the order can proceed despite a hold or total difference, enter a specific reason under **Reason for allowing this order**.
5. Click **Approve this order with override**. Review the order reference, totals (when applicable), and reason in the confirmation dialog, then confirm or cancel.
6. The approved order shows the exception, seller, time and any total discrepancy. Approval makes the order read only. This does not settle invoices, clear disputes, or authorize future orders; delivery and invoicing retain their own checks.

Seller identity remains simulated in this demo. An override is a recorded processing exception, not evidence of buyer acceptance or bank settlement.

## Orders that use quotations and revisions

A buyer does not need to issue a PO. Choose **Create order**, select the customer, and enter the requested items (or review a chat screenshot). Prices may be blank initially. **Total printed on buyer’s document** is optional: leave it blank when there is no buyer PO. It is a monetary total from a real document, not an item count or quotation number. For example, items worth MYR 760 and a document total entered as MYR 1 differ by MYR 759; correct that field or clear it when there is no document total.

1. Save the order draft. The quotation starts with the order / PO items. **Copy items and terms from order / PO** reloads those values into the quotation editor; it does not save automatically.
2. Edit quotation items, quantities, unit prices, line discounts and terms. Sent, rejected and revision-requested quotations remain editable until accepted. Saving a revision resets it to draft and preserves the previous quotation in activity history.
3. Save all quotation edits before recording a buyer response. Record a request/revision note if needed. Uploading evidence is optional; an agreement screenshot or request can be uploaded directly beside the response form.
4. For **Accepted**, either enter how the buyer agreed or select attached evidence. Seller confirmation is still required; uploading a file alone does not approve anything.
5. Acceptance copies the quotation’s item rows, currency and payment terms into the order. Use **Copy agreed quotation to order** to apply an already-accepted quotation to an existing order before delivery or invoicing. The original uploaded PO and its printed total are retained as evidence. Accepted quotation items and terms are locked.
6. If copying changed an already-approved order, it returns to draft and needs seller processing approval again. Review totals and customer holds; correct the optional document total or record a reasoned exception where appropriate.
7. Continue with delivery and invoicing. The invoice uses the accepted quotation amount. Later delivery/invoice records cannot be rewritten through quotation edits.

## Downloading order, quotation and invoice PDFs

The document download buttons include supplier and buyer names, addresses, phone numbers and emails. Buyer contacts use the saved customer record, with order/PO fields as a fallback; supplier contacts use your own company Settings. Missing values print as `-`. Use **Settings** to save the seller name, address, phone and email.

Items print in a bordered table: item/code, quantity, unit price, line discount and line total. Unknown prices print as `-`; long tables repeat their headers on subsequent pages. Invoice items use the quotation when available. These demo PDFs use built-in ASCII fonts; multilingual documents require a Unicode-capable renderer.

## Seller settings and document preparer

Open **Settings** in the sidebar. Fill in the supplier/seller name, address, phone, optional email, and **Salesperson / prepared by**, then click **Save settings**. The seller name is required; other contact fields can be left blank. PDF supplier contacts use your saved company settings, with `-` for missing values. A different supplier printed on an uploaded PO never replaces your company profile.

The salesperson setting is a document name, not a login or permission change. Leaving it blank uses the seller account name. New quotations keep the name recorded when created, including subsequent revisions. New invoices record the name set when issued. Later settings changes do not replace those recorded preparers. Older documents with no recorded preparer print `-`.

Settings use the current workspace's persistence: browser localStorage in browser-only mode, or the backend database when enabled. Seller contacts project to the existing MariaDB business columns; salesperson and per-document preparer names are retained in the runtime snapshot without requiring new schema columns. Resetting the demo resets settings as well as transactions.

## Paid invoice, final receipt and order completion

Invoice Details now contains **View / print invoice PDF** and download buttons. PDF views open in a new tab; use the PDF viewer’s Print action. The same document controls are available under the order’s **Payment and receipt** section.

1. Record a payment only after checking actual bank/payment-provider records or receiving cash. Confirm this in the payment dialog. Existing manually recorded payments already reduce the invoice balance; do not record them again to obtain a receipt.
2. When the balance is zero, finish any outstanding payment-claim review, verification hold, dispute or open review case. Enter the verification source/settlement note, confirm the funds/credits check, and click **Confirm settlement and issue final receipt**.
3. **View / print final receipt** opens the final settlement document. It lists the original invoice amount, debit adjustments, credit adjustments, actual recorded payments, references and seller confirmation. Credits are not described as cash received; an entirely credited invoice produces a settlement statement.
4. Record delivery acceptance for every item, or explicitly resolve each shortfall using the delivery/credit-note workflow. A paid invoice is not proof that delivery happened.
5. Click **Complete order** and confirm. The server rechecks processing approval, quotation acceptance, delivery, payment review, the settled balance and the current final receipt. Remaining blockers are listed with a link to the order.

Issuing a receipt does not post a payment. Repeating issuance for the same settlement reuses the receipt. Extra charges or financial changes invalidate its use for current completion; earlier settlement information remains in the audit history. After the additional balance is settled, issue an updated final receipt and reconfirm completion. All of this remains seller-recorded: the app does not contact your bank or provide production authentication.

## Our company on new orders

The new-order form shows **Our company — supplier / seller** as read-only information from Settings, with an **Edit company settings** link. You no longer need to type the supplier on every order. Direct and chat orders record your company details when saved. Uploaded PO supplier text remains source evidence; the uploaded original is unchanged.

Fresh workspaces start with the editable demo profile **Kedai Maju Jaya Sdn Bhd**, fictional address **12 Jalan Demo, 50000 Kuala Lumpur, Malaysia**, placeholder phone **+60 3-0000 0000**, email **sales@kedaimaju.example**, and **Demo Salesperson**. Settings identifies these contacts as fictional. Existing custom settings are preserved. An untouched “My business” placeholder upgrades to this profile without adding sample customers, orders or payments.

## Extract requested items from chat screenshots or PDFs

Under **Create order → Order details**, use **Extract requested items from buyer chat screenshot or PDF**. PNG, JPG and PDF are accepted, up to 10 MB and five pages. You can upload a PDF export or a PDF containing chat screenshots. The same local Docling OCR and configured AI provider propose requested items and quantities; review them before saving. Original evidence is retained. Extraction does not confirm buyer agreement, prices or payment. For a formal buyer PO, use **Start from buyer’s PO** instead so its document fields can be extracted.


## Repeatable demo scenarios

Open **Demo Controls > Load demo scenarios** to add 8 fictional customers, 10 invoices, 14 orders and 2 quotations. Startup remains empty. Loading twice does not duplicate records. Company settings and existing manual records are preserved. Scenario dates are relative to the current business/demo date at load time; backend mode still uses the actual business date.

- **DEMO-INV-1/2:** normal credit and partial payment.
- **DEMO-INV-3:** 90 days overdue with a missed payment promise.
- **DEMO-INV-4** and **DEMO-INV-MULTI-1/2:** several unpaid invoices for one customer.
- **DEMO-INV-5/6:** active dispute and resolved dispute requiring settlement.
- **DEMO-INV-7:** payment claim awaiting verification.
- **DEMO-INV-8:** paid sale with accepted delivery and a final receipt.
- **DEMO-REVIEW-1/2:** draft and accepted quotations.
- **DEMO-REVIEW-3/4:** PO review and a deliberately mismatched printed total.
- **DEMO-REVIEW-5/6:** draft orders blocked by dispute/settlement obligations.

Use **Run Invoice Check** to populate reminder reviews under the existing rules. Ordinary overdue invoices require attention but do not automatically block new orders. Dispute and settlement rules still govern order approval.

**Reset demo scenarios** removes the previous scenarios and their linked payments, claims, follow-ups and activity, then creates the starting set again. **Remove demo scenarios** removes that set without recreating it. Both preserve manual records, company settings and seller-uploaded policies. If a new manual sales record depends on a demo customer/order, removal is refused rather than deleting that manual record. Resolve that link or keep the scenarios. Files already uploaded to evidence storage are not erased by scenario removal.

**Clear Entire Workspace** is the separate destructive reset: it removes all workspace records and restores the empty starting configuration. It is not the same as resetting only the demo scenarios.

## AI Assistant: policies, current records and workflow guidance

The backend assistant uses retrieval-augmented generation (RAG): lexical search retrieves relevant passages from reviewed company policies and this manual, while current invoice balances, payments and customer order blockers are read directly from the store. It then passes that evidence to the configured Ollama model. No vector database or embedding API is required.

1. Open **AI Assistant > Company policies and assistant sources > Add policy**.
2. Enter a title, version and effective date. Paste text, import a `.txt`/`.md` file (up to 40 KB), or upload a PDF using local Docling (10 MiB, up to five pages). Policy text is limited to 40,000 characters. Review for missing or truncated content.
3. Review the extracted text against **View original policy PDF**. If OCR fails, the original is retained and text can be entered manually. Plain-text imports retain the reviewed text, rather than a separate original file.
4. Confirm review and save. Only the seller can save policies. Saving an active version deactivates other versions with the same title. Inactive policies and policies effective after the business date are excluded from retrieval. Open a saved policy to edit or deactivate it; review must be confirmed again.
5. Optionally select an invoice and ask, for example: “Which invoices need attention and what policy applies?”, “Why is this customer's order blocked?”, or “How do I open a PO and issue an invoice?”
6. Expand **Retrieved sources** below a reply to open the invoice, order, policy text or workflow manual. Links identify the evidence supplied to the model; review the model's inline source citations when assessing its claims.

The loaded demo scenarios include a clearly fictional credit/dispute policy. Scenario reset replaces that policy along with the sample records; personal company policies remain.

Retrieval is limited to 20 detailed invoices, 10 orders, 40 attention findings and six document passages per question; the model receives counts and an explicit limitation. Select a specific invoice for focused questions. No relevant policy means the assistant should report missing evidence instead of inventing terms. Policies supply guidance and do not change executable approval rules, balances, fees or permissions. AI suggestions never independently approve an order, verify payment, resolve a dispute or send a customer message.

Cloud mode sends retrieved policy excerpts and selected business facts to Ollama. PDF extraction itself runs locally. Browser-only mode retains policy entry and demo controls, but assistant answers remain the existing predefined rules rather than model-generated RAG answers. A configured model is not proof that the API is connected; failed calls display an error.

Run `npm run test:demo-rag` for scenario, retrieval, policy-review, scope and persistence checks. These tests mock model responses and do not prove live model answer quality.


## Order links and printed commercial terms

The Invoices list and Invoice Details provide **View order** for invoices linked to an order. Open it to review the requested items, quotation and delivery history. Legacy invoices without a linked order show that no order is available.

Under **Settings > Quotation defaults**, set your company's payment terms and price-validity period (initially seven days). New quotation drafts use those defaults; review or override them before saving. Quotation PDFs print the saved payment terms and **Prices valid until** date. Changing Settings does not rewrite existing quotations or buyer agreements.

Generated invoice PDFs use current recorded balances: invoices fully covered by recorded payments show **FULLY PAID**. Those settled with credit adjustments show **FULLY SETTLED** instead of claiming cash was received. Invoice and final-receipt PDFs include: “This is a computer-generated digital copy. No signature is required.” This wording does not replace payment verification or resolve disputes.


Transaction currency follows the agreed quotation into the PO and newly issued invoice. Invoice PDFs, receipts and invoice-detail amounts use that transaction currency, rather than the company default. Existing invoices without a saved currency infer it from the linked quotation or order. Invoice-list outstanding totals are grouped by currency; this is not foreign-exchange conversion.


## Draft a payment request by email or WhatsApp

In **Orders > Payment and receipt**, use **Draft payment request · Email / WhatsApp**. The draft uses the invoice reference, current outstanding balance, transaction currency, due date and buyer contacts. Review or edit the recipient, email subject and message before opening your email app or WhatsApp. Missing contacts can be entered in the draft without changing the customer record. Copy is available if no email handler is configured.

**Open email draft** opens the configured mail app; **Open in WhatsApp** opens a prefilled chat. The seller sends the message in that application. NudgeWise has no email delivery provider here and does not record these drafts as sent. Requests are disabled for settled invoices, active disputes and verification holds. If invoice facts change while the draft is open, the draft refreshes and needs review again.

The included **demo payment link** opens a preview with an invoice reference and illustrative amount. It does not collect payment details, process funds or change invoice status. Link values can be edited and are not trusted financial records. Localhost links work only on the hosting computer; sharing an accessible demo requires a deployed URL and any configured demo access. Record payment only after independently checking settled funds.

Payment-request drafts support **EN / BM / 中文**, initially using the buyer’s saved language (English when unspecified). Switching language regenerates the subject and message while preserving recipient details. Both email and WhatsApp use the selected draft text; review any edits again after switching.


## Prioritize orders by next step

Use **Orders > Next step** to focus on Order, Quotation, Buyer’s PO, Delivery, Invoice, Payment or Receipt. **Blocked / needs review** includes any order whose next action is blocked; **Completed** shows orders with no remaining stage. The filter uses the same live workflow calculation as the Next step badge, works together with customer/order search, and shows matching counts. **Clear filters** restores the full list when a search has no matches. Filtering changes the display only; it does not approve orders or change payment rules.

## Share quotation or PO/order-summary drafts

The order workspace has **Draft request: share order / PO summary for review** near its order-summary PDF action. The Quotation section has **Draft request: share quotation for review** once a quotation is saved. Both use the same **EN / BM / 中文** controls as other buyer drafts, default to the buyer language, and allow recipient email/phone, subject and message editing.

Drafts use saved references, status, currency, totals and payment terms; quotations include their saved price-validity date. They do not record buyer agreement or change workflow status. Unsaved quotation form edits are not included. Download the relevant PDF and manually attach it in your email app or WhatsApp. Opening a mail/chat draft does not send it, attach files or record delivery in NudgeWise. Switching language regenerates message/subject while keeping recipient edits.
