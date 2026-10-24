# Graph Report - SDC-test  (2026-10-24)

## Corpus Check
- 119 files · ~91,486 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .css 1, .lock 1)

## Summary
- 1357 nodes · 3152 edges · 71 communities (63 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Build and runtime dependencies
- Build and runtime dependencies
- Build and runtime dependencies
- Demo simulation controls
- Shared attention queue
- Build and runtime dependencies
- Order intake and approval
- Customer history
- Action Center approvals
- Build and runtime dependencies
- Planned email workflow
- Collection dashboard
- Build and runtime dependencies
- Build and runtime dependencies
- Seller progress
- Build and runtime dependencies
- Invoice review and payments
- Shared business records
- Money and date formatting
- Build and runtime dependencies
- Reminder tone editing
- Invoice actions and safeguards
- Development commands
- Build and runtime dependencies
- Invoice browsing
- Demo access guard
- Package and runtime settings
- Build and runtime dependencies
- Reminder eligibility and checkpoints
- Phone lookup and onboarding
- Build and runtime dependencies
- OCR and AI integrations
- Build and runtime dependencies
- Build and runtime dependencies
- Assistant conversation
- Project setup and scope
- Frontend compiler settings
- Invoice assistant rules
- Buyer reply review
- Build and runtime dependencies
- Test compiler settings
- Navigation and notifications
- Payment feedback
- Build and runtime dependencies
- Browser backend commands
- Build tool dependencies
- Build and runtime dependencies
- Demo passcode screen
- Build and runtime dependencies
- Shared display labels
- Backend setup and integrations
- State and invoice actions
- Frontend dependencies
- Build and runtime dependencies
- Customer payment priorities
- Build and runtime dependencies
- Build and runtime dependencies
- State and invoice actions
- Build and runtime dependencies
- Phone lookup and onboarding
- Order intake and approval
- Server compiler settings
- Build and runtime dependencies
- Order intake and approval
- Browser backend commands
- Order intake and approval
- Python environment

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 70 edges
2. `computeInvoiceWithCustomer()` - 54 edges
3. `update()` - 51 edges
4. `refreshStore()` - 37 edges
5. `vue` - 32 edges
6. `DEMO_BUSINESS_ID` - 31 edges
7. `createBackend()` - 29 edges
8. `sumMoney()` - 29 edges
9. `useDemoStore()` - 26 edges
10. `scripts` - 24 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `createBackend()`  [EXTRACTED]
  tests/business-settings.test.cjs → server/app.cjs
- `acceptedOrder()` --calls--> `createBackend()`  [EXTRACTED]
  tests/credit-note.test.cjs → server/app.cjs
- `fixture()` --calls--> `createBackend()`  [EXTRACTED]
  tests/order-workflow.test.cjs → server/app.cjs
- `fixture()` --calls--> `createBackend()`  [EXTRACTED]
  tests/settlement.test.cjs → server/app.cjs
- `fixture()` --calls--> `createBackend()`  [EXTRACTED]
  tests/backend.test.cjs → server/app.cjs

## Import Cycles
- None detected.

## Communities (71 total, 8 thin omitted)

### Community 0 - "Build and runtime dependencies"
Cohesion: 0.10
Nodes (72): BusinessSettings, quotationDefaults(), saveBusinessSettings(), supplierFromCompany(), approvePurchaseOrder(), boundedText(), createCustomer(), createPurchaseOrder() (+64 more)

### Community 1 - "Build and runtime dependencies"
Cohesion: 0.04
Nodes (49): activity, actor, asMoney(), blockers, busy, buyerEvidence, buyerNote, buyerPos (+41 more)

### Community 2 - "Build and runtime dependencies"
Cohesion: 0.07
Nodes (41): copied, documentDraft, email, lang, langs, mail, open, phone (+33 more)

### Community 3 - "Demo simulation controls"
Cohesion: 0.08
Nodes (39): advanceDate(), {data,refreshStore}, expanded, invoices, notice, paymentAmount, paymentDate, paymentInvoice (+31 more)

### Community 4 - "Shared attention queue"
Cohesion: 0.07
Nodes (29): vue, vue-router, {data,refreshStore}, mainContent, notifications, onStorage(), seller, business (+21 more)

### Community 5 - "Build and runtime dependencies"
Cohesion: 0.09
Nodes (19): typescript, output, source, facts, mod, source, mem, root (+11 more)

### Community 6 - "Order intake and approval"
Cohesion: 0.05
Nodes (36): approvePurchaseOrder, activeOrder, activeOrderId, actor, approve(), availableCustomers, busy, calculatedTotal (+28 more)

### Community 7 - "Customer history"
Cohesion: 0.06
Nodes (32): deleteCustomer, updateCustomer, currentBusiness, currentUser, customerBusy, customerEdit, customerError, customerNotice (+24 more)

### Community 8 - "Action Center approvals"
Cohesion: 0.06
Nodes (31): Phase 1: Replace Telegram coupling with email-ready backend access, lucide-vue-next, emit, approveFollowUp, rejectFollowUp, sendApprovedFollowUp, activity, blocked (+23 more)

### Community 9 - "Build and runtime dependencies"
Cohesion: 0.08
Nodes (12): connectMariaDb(), day(), dt(), fixedId(), json(), MemoryDb, num(), PROJECTED (+4 more)

### Community 10 - "Planned email workflow"
Cohesion: 0.06
Nodes (22): Business rules to implement, How documents enter the system, Main seller flow, Minimum data additions, Minimum system contents, Not in this proof of concept, NudgeWise email proof-of-concept plan, Official email references (+14 more)

### Community 11 - "Collection dashboard"
Cohesion: 0.07
Nodes (31): sumMoney(), outstandingFor(), aging, bizId, blocked, chartOptions, collected, currentBusiness (+23 more)

### Community 12 - "Build and runtime dependencies"
Cohesion: 0.10
Nodes (11): createBackend(), monitor(), transaction(), fileExtension(), fixture(), fixture(), fixture(), fixture() (+3 more)

### Community 13 - "Build and runtime dependencies"
Cohesion: 0.08
Nodes (28): baseline, chatWarnings, company, {data}, details, dirty, disabled, emit (+20 more)

### Community 14 - "Seller progress"
Cohesion: 0.10
Nodes (27): collected, dash, { data }, draft, editing, goal, input, monthName (+19 more)

### Community 15 - "Build and runtime dependencies"
Cohesion: 0.07
Nodes (28): AI Assistant: policies, current records and workflow guidance, Approve a reviewed order with an exception, Downloading order, quotation and invoice PDFs, Draft a payment request by email or WhatsApp, Empty workspace and recovery, Extract requested items from chat screenshots or PDFs, Find or add a customer, Full PO entry and original evidence (+20 more)

### Community 16 - "Invoice review and payments"
Cohesion: 0.09
Nodes (28): activity, amount, confirmPromiseAction(), {data,refreshStore}, date, emit, error, followups (+20 more)

### Community 17 - "Shared business records"
Cohesion: 0.15
Nodes (25): DEMO_COMPANY_PROFILE, WorkflowData, Receipt, StoreData, ActivityEvent, AiConversation, ApprovalState, Business (+17 more)

### Community 18 - "Money and date formatting"
Cohesion: 0.13
Nodes (21): current, invoiceView, getAttention(), promiseOutstanding(), replyNeedsReview(), addMoney(), formatMYR(), fromCents() (+13 more)

### Community 19 - "Build and runtime dependencies"
Cohesion: 0.10
Nodes (8): validatePurchaseOrderExtraction(), actor, fixture(), settings, actor, fixture(), actor, fixture()

### Community 20 - "Reminder tone editing"
Cohesion: 0.14
Nodes (22): emit, finish(), generate(), lang, loading, preview, props, remember (+14 more)

### Community 21 - "Invoice actions and safeguards"
Cohesion: 0.27
Nodes (25): actionForBusiness(), ActionResult, actorForBusiness(), applyCustomerReply(), approveFollowUp(), balanceForInvoice(), cancelAction(), checkEligibility() (+17 more)

### Community 22 - "Development commands"
Cohesion: 0.08
Nodes (24): scripts, build, db:check, dev, preview, server, server:build, start (+16 more)

### Community 23 - "Build and runtime dependencies"
Cohesion: 0.10
Nodes (22): uploadProof(), createQuickSale, extractQuickSaleDocument(), uploadPaymentEvidence(), business, busy, customerId, {data} (+14 more)

### Community 24 - "Invoice browsing"
Cohesion: 0.09
Nodes (19): InvoiceStatus, currentBusiness, currentPage, currentUser, { data }, drawerOpen, filteredInvoices, outstandingByCurrency (+11 more)

### Community 25 - "Demo access guard"
Cohesion: 0.12
Nodes (11): Current project and reuse, Configuration and persistence, Replit hosting, Runtime and build, createAccessGuard(), authenticated(), digest(), equal() (+3 more)

### Community 26 - "Package and runtime settings"
Cohesion: 0.10
Nodes (18): engines, node, name, private, type, version, autoprefixer, chart.js (+10 more)

### Community 27 - "Build and runtime dependencies"
Cohesion: 0.13
Nodes (22): addCase(), addDebit(), args(), confirmDeliveryAction(), makeInvoice(), resolveCase(), run(), saveQuote() (+14 more)

### Community 28 - "Reminder eligibility and checkpoints"
Cohesion: 0.18
Nodes (20): buyerLang, setCustomerLanguage(), notifyMissedPromises(), daysBetween(), daysOverdue(), approvalFingerprint(), CheckpointResult, determineCheckpoint() (+12 more)

### Community 29 - "Phone lookup and onboarding"
Cohesion: 0.10
Nodes (20): Where to make changes, busy, creatingDirectly, { data, refreshStore }, error, extracted, form, matches (+12 more)

### Community 30 - "Build and runtime dependencies"
Cohesion: 0.11
Nodes (19): blockers, busy, completed, completionBlockers, confirmed, {data,refreshStore}, error, finish() (+11 more)

### Community 31 - "OCR and AI integrations"
Cohesion: 0.20
Nodes (13): activeModel(), aiSettings(), chat(), classifyReply(), extract(), extractCustomer(), extractOrderChat(), extractPurchaseOrder() (+5 more)

### Community 32 - "Build and runtime dependencies"
Cohesion: 0.22
Nodes (16): pdf(), download(), ascii(), createDocumentPdf(), documentContactSections(), DocumentSection, downloadDocumentPdf(), esc() (+8 more)

### Community 33 - "Build and runtime dependencies"
Cohesion: 0.13
Nodes (14): busy, {data,refreshStore}, error, form, notice, open, policies, route (+6 more)

### Community 34 - "Assistant conversation"
Cohesion: 0.15
Nodes (16): addAiMessage, askAiAssistant, clearAiConversation, aiError, clear(), {data,refreshStore}, input, invoices (+8 more)

### Community 35 - "Project setup and scope"
Cohesion: 0.12
Nodes (15): Backend with SQLite and cloud AI, Choose a workflow, Documentation, Features, Frontend-only demo, License and attribution, Local setup, MariaDB with Laragon or XAMPP (+7 more)

### Community 36 - "Frontend compiler settings"
Cohesion: 0.12
Nodes (15): @vue/tsconfig/tsconfig.dom.json, compilerOptions, baseUrl, module, moduleResolution, noUnusedLocals, noUnusedParameters, paths (+7 more)

### Community 37 - "Invoice assistant rules"
Cohesion: 0.17
Nodes (12): AI_CATEGORIES, AiClassification, askAiAssistant(), classifyCustomerResponse(), deterministicAnswer(), extractDate(), businessDate(), REPLY_FLAGS (+4 more)

### Community 38 - "Buyer reply review"
Cohesion: 0.16
Nodes (13): act(), amount, busy, date, decide(), emit, flags, notice (+5 more)

### Community 39 - "Build and runtime dependencies"
Cohesion: 0.18
Nodes (12): saveBusinessSettings, business, busy, {data,refreshStore}, dirty, error, form, isDemoProfile (+4 more)

### Community 40 - "Test compiler settings"
Cohesion: 0.15
Nodes (12): compilerOptions, baseUrl, module, moduleResolution, noEmitOnError, outDir, paths, skipLibCheck (+4 more)

### Community 41 - "Navigation and notifications"
Cohesion: 0.18
Nodes (11): formattedDate, openNotification(), props, {refreshStore}, route, router, showNotifs, showProfile (+3 more)

### Community 42 - "Payment feedback"
Cohesion: 0.18
Nodes (11): arm(), confetti, { data }, known, paid, pieces, props, stopArmWatch (+3 more)

### Community 43 - "Build and runtime dependencies"
Cohesion: 0.21
Nodes (11): CreditNote, DeliveryConfirmation, OrderEvidence, OrderStage, Raw, STAGE_KEYS, STAGE_NAMES, StageInput (+3 more)

### Community 44 - "Browser backend commands"
Cohesion: 0.29
Nodes (11): replaceSnapshot(), ChatOrderUpload, checkAccess(), command(), EvidenceUpload, extractChatOrder(), PurchaseOrderExtraction, refreshServer() (+3 more)

### Community 45 - "Build tool dependencies"
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, postcss, tailwindcss, @types/markdown-it, @types/node, typescript, vite (+3 more)

### Community 46 - "Build and runtime dependencies"
Cohesion: 0.20
Nodes (3): acceptedOrder(), actor, actor

### Community 47 - "Demo passcode screen"
Cohesion: 0.18
Nodes (7): AccessState, authenticated, message, passcode, state, submitting, backendEnabled

### Community 48 - "Build and runtime dependencies"
Cohesion: 0.20
Nodes (4): business, customer, details, item

### Community 49 - "Shared display labels"
Cohesion: 0.24
Nodes (9): CustomerPriority, DerivedLabel, formatShortPriorityReason(), getDerivedLabelChips(), getDerivedLabels(), plural(), Invoice, InvoiceWithCustomer (+1 more)

### Community 50 - "Backend setup and integrations"
Cohesion: 0.22
Nodes (8): Browser-only mode, Checks, Demo scenarios and assistant retrieval, MariaDB / XAMPP, NudgeWise backend, OCR and AI, Quick start (SQLite, Windows), Troubleshooting

### Community 51 - "State and invoice actions"
Cohesion: 0.31
Nodes (8): addAiMessage(), addCustomerResponse(), addFollowUpAction(), addPayment(), clearAiConversation(), markNotificationReadById(), setDemoDate(), uid()

### Community 52 - "Frontend dependencies"
Cohesion: 0.25
Nodes (8): dependencies, chart.js, lucide-vue-next, markdown-it, mysql2, vue, vue-chartjs, vue-router

### Community 53 - "Build and runtime dependencies"
Cohesion: 0.25
Nodes (8): choose(), creditPreview(), issueCredit(), keepAmount(), netUnit(), res(), acceptDeliveryShortfall, issueCreditNote

### Community 54 - "Customer payment priorities"
Cohesion: 0.29
Nodes (7): calculateCustomerPriorities(), PriorityLevel, SettledEvidence, settlementDate(), priorityRecords, priorities, priorityRecords

### Community 55 - "Build and runtime dependencies"
Cohesion: 0.38
Nodes (5): markdown-it, html, props, markdown, renderAssistantMarkdown()

### Community 56 - "Build and runtime dependencies"
Cohesion: 0.38
Nodes (7): next, hasBuyerPo(), nextStage(), orderStages(), stageSummary(), orderProgress(), progressRows

### Community 57 - "State and invoice actions"
Cohesion: 0.43
Nodes (7): getDemoState(), getSeedData(), load(), migrate(), readStored(), resetStore(), save()

### Community 59 - "Phone lookup and onboarding"
Cohesion: 0.33
Nodes (6): choose(), emit, save(), search(), startNewCustomer(), createCustomer

### Community 60 - "Order intake and approval"
Cohesion: 0.33
Nodes (6): deletePurchaseOrder, closeEditor(), openOrder(), removeOrder(), selectCustomer(), startOrder()

### Community 62 - "Server compiler settings"
Cohesion: 0.40
Nodes (4): ./tsconfig.logic-tests.json, compilerOptions, outDir, extends

### Community 64 - "Order intake and approval"
Cohesion: 0.67
Nodes (3): matchesOrderNextStep(), nextStepCount(), rows

### Community 65 - "Browser backend commands"
Cohesion: 0.67
Nodes (3): createPurchaseOrder, updatePurchaseOrder, saveDraft()

## Knowledge Gaps
- **587 isolated node(s):** `name`, `private`, `version`, `type`, `start` (+582 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 701 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Verification` connect `Project setup and scope` to `Package and runtime settings`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _587 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Build and runtime dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09691358024691359 - nodes in this community are weakly interconnected._
- **Why does `getStore()` connect `Build and runtime dependencies` to `State and invoice actions`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **Should `Build and runtime dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.03918722786647315 - nodes in this community are weakly interconnected._
- **Should `Build and runtime dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06567992599444958 - nodes in this community are weakly interconnected._
- **Should `Demo simulation controls` be split into smaller, more focused modules?**
  _Cohesion score 0.07948717948717948 - nodes in this community are weakly interconnected._
## Scope and interpretation

- Code relationships come from Graphify's deterministic AST extraction. Document nodes represent headings and literal source-path references; they are a navigation index, not a claim of complete semantic understanding.
- `docs/email-mvp-plan.md` describes proposed work. A document referencing a source file does not mean that proposal is implemented. Telegram integration has been removed; legacy record fields may remain in source.
- Secrets, environment files, runtime customer databases, dependencies, builds, datasets, RunPod assets, submission material and binary fixtures/PDFs are excluded. Source CSS, lockfiles and other unsupported formats may not have nodes.
- SQL relationships require the optional `tree_sitter_sql` parser.
- Vue template interactions, dynamic dispatch and runtime effects may be absent or approximate. Verify critical behavior in source and tests.
- No external LLM extraction was used; extraction token counters are zero, and host-session token usage is unavailable rather than measured as zero.
- `graphify-out/` was written into the working tree. Commit only the outputs the team wants to share; generated caches and machine-specific interpreter paths need not be committed.

## Extraction health

```text
[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 1296
unverified_code_nodes: 0
raw_edges: 3269
valid_candidate_edges: 3040
missing_endpoint_edges: 0
dangling_endpoint_edges: 105
external_reference_edges: 124
self_loop_edges: 1
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 2928
directed_same_endpoint_collapsed_edges: 112
undirected_unique_endpoint_pairs: 2925
undirected_same_endpoint_collapsed_edges: 115
same_endpoint_group_count: 111
relation_variant_groups: 78
source_file_variant_groups: 0
source_location_variant_groups: 33
context_variant_groups: 0
post_build_graph_type: DiGraph
post_build_edges: 3152
producer_suppression_sites: 12
producer_suppression_examples:
  - L1813 seen_ids arity=unknown
  - L2377 seen_ids arity=unknown
  - L2379 seen_doc_refs arity=unknown
  - L3046 seen_ids arity=unknown
  - L3193 seen_ids arity=unknown
  - L4222 seen_keys arity=unknown
  - L4408 seen_keys arity=unknown
  - L7689 seen_ids arity=unknown
examples:
  - docs_email_mvp_plan_current_project_and_reuse -> server_app edges=3 relations=['references'] locations=['Line 26', 'Line 27', 'Line 28'] contexts=['']
  - server_access -> server_access_createaccessguard edges=2 relations=['contains', 'indirect_call'] locations=['L69', 'L8'] contexts=['', 'collection']
  - server_access_createaccessguard -> server_access_createaccessguard_authenticated edges=2 relations=['calls', 'contains'] locations=['L13', 'L28'] contexts=['', 'call']
  - server_app -> server_app_createbackend edges=2 relations=['calls', 'contains'] locations=['L22', 'L307'] contexts=['', 'call']
  - server_app_createbackend -> server_app_createbackend_monitor edges=2 relations=['calls', 'contains'] locations=['L57', 'L67'] contexts=['', 'call']
note: normal graph.json is post-build; raw producer loss must be measured earlier.
```
