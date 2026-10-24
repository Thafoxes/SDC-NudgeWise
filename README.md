# NudgeWise - Sales and Invoice Follow-Up Assistant

NudgeWise helps Malaysian micro and small businesses manage customer orders, quotations, direct invoices, payment reviews and invoice follow-ups in one seller-controlled workspace.

**Version:** 1.1.0 · **Status:** Working prototype with optional backend persistence, local OCR and configurable Ollama AI. Use synthetic records for demos. Bank verification, production user authentication and statutory e-invoice submission are not implemented.

Start with [local setup](#local-setup) to run the app, the [workflow manual](docs/customer-order-workflow.md) to use it, or the [project structure](#project-structure) to find the code you need.

## Team

| Field | Details |
| --- | --- |
| Team name | YOLO |
| Domain | Domain 2 |
| SDG track | SDG 8 - Decent Work and Economic Growth |
| Team leader | WONG JIA SOON |
| University | UNIVERSITI TEKNOLOGI MALAYSIA |
| Members | 4 |

## Links
| Resource | Link |
| --- | --- |
| Source repository | [SDC-NudgeWise](https://github.com/Thafoxes/SDC-NudgeWise) |
| Live Demo         | https://nudgewise-production.up.railway.app/              |
| Slides | https://canva.link/jg055mv4dvbzpgc |
| Demo Video        | https://youtu.be/V7hNoXaBXlE               |


## Overview

### Problem

Malaysian micro and small business owners often track customer orders, invoices and payment updates across chat messages, paper documents and spreadsheets. Checking what each customer owes and following up on late payments takes time, and missed reminders can delay money the business needs for daily expenses. Owners need a simple way to keep records together and see what needs attention.

### Solution

NudgeWise brings customer details, orders, quotations, invoices and payment records into one workspace. It shows unpaid and overdue invoices, helps owners plan follow-ups, and uses AI to suggest reminder wording and answer questions using business records and reviewed company policies. It can also extract details from uploaded order documents for the seller to check, reducing repeated typing.

The seller stays in control: they review extracted details, approve reminders and verify payments before marking invoices as paid. The current prototype simulates reminder delivery; it does not send reminders or verify bank payments automatically.



## Features

- **Customers:** Find customers by phone, add details manually, or review contact suggestions extracted from a document.
- **Orders and quotations:** Capture buyer requests with or without a buyer PO, negotiate quotation items, retain supporting evidence and use agreed items for the order. Drafts remain editable before agreement/approval.
- **PO review:** Upload PDF, PNG or JPG documents; review contacts, line items, currency and totals against the original. Total mismatches and customer holds require correction or an explicit seller exception.
- **Quick sale / direct invoice:** Issue an invoice immediately for agreed small B2B/POS-style transactions without a quotation or buyer PO. Choose paid immediately or pay later.
- **Order extraction:** Read quick-sale items, quantities and explicit prices from screenshots or PDFs using local Docling and the configured AI. Review results before issuing an invoice; failed extraction leaves a manual-entry path.
- **Payments and evidence:** Record verified payments, including partial payments, and attach bank-transfer/card receipt images or PDFs. Payment proof is supporting evidence and does not automatically mark an invoice paid.
- **Documents and completion:** View, print or download quotation/invoice PDFs with contacts and item tables. Issue a final settlement receipt and complete the order after settlement, delivery and holds are resolved.
- **Company settings:** Edit seller name, address, phone, email and document preparer. New orders use this company as the seller. An editable fictional company profile is provided for demos.
- **Dashboard and Action Center:** Review balances, overdue invoices, reminder approvals, customer replies, payment claims and activity history.
- **Reminder safeguards:** Recheck invoice eligibility before recording a simulated follow-up; respect dispute and payment-verification holds and duplicate-checkpoint rules.
- **Customer priorities:** Explainable Red / Yellow / Green / Grey follow-up classifications, separate from operational review urgency.
- **AI assistant with RAG:** Retrieves current invoice facts, reviewed company policies and workflow guidance for source-linked suggestions through Ollama. Includes optional invoice context and PDF/text policy import.
- **Repeatable demo scenarios:** Load, reset or remove a fictional set of quotations, POs and invoices, including overdue, disputed, blocked and completed cases, while preserving independent manual records and company settings.

The workspace starts without sample transactions. Demo controls load, reset or remove fictional scenarios. Browser-only mode also supports a simulated business date; backend mode uses the current business date. The [sample buyer PO](output/pdf/demo-buyer-purchase-order.pdf) contains fictional contacts and three items totaling **MYR 1,520.00**.

## Choose a workflow

| Situation | Where to start |
| --- | --- |
| Agreed items and prices; invoice needed immediately | **Invoices > New quick sale / invoice** |
| Quotation negotiation, buyer PO or longer delivery process | **Orders** / purchase-order intake |
| Review a payment, invoice PDF or final receipt | **Invoice Details** |
| Update your own company information | **Settings** |

For paid-immediately quick sales, confirm goods handover and settled funds before issuing the invoice, receipt and completion record. For credit sales, record later payments, issue the final receipt after settlement and complete delivery review before closing the order.

Read the [customer and order workflow manual](docs/customer-order-workflow.md) for step-by-step procedures, exceptions and document rules.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3, TypeScript, Vue Router |
| Styling and visuals | Tailwind CSS, Lucide, Chart.js, vue-chartjs, Inter font |
| Build | Vite, vue-tsc, PostCSS, Autoprefixer |
| Backend | Node.js 24+ built-in HTTP server |
| Persistence | Browser localStorage, or backend SQLite / MySQL-MariaDB-compatible storage through mysql2 |
| Document extraction | Python 3.12, Docling, RapidOCR, ONNX Runtime |
| AI | Ollama-compatible local/cloud API; documented cloud example uses Gemma 4 |
| Tests | TypeScript compiler and Node.js built-in test runner |

The frontend calls the project's own `/api` backend. Docling runs as a local Python worker, not through the Docling MCP server. Cloud AI receives extracted document text. Payment-proof uploads are stored without OCR or cloud extraction. Google Fonts supplies Inter; WhatsApp links open prefilled messages without a WhatsApp Business API integration.

## Local setup

Run commands from the repository root with Node.js 24+ installed. Python 3.12 is only needed for backend document extraction:

```powershell
npm install
```

### Frontend-only demo

Set this in your local `.env`:

```dotenv
VITE_BACKEND_ENABLED=false
```

```powershell
npm run dev
```

Open [localhost:5173](http://localhost:5173). This mode stores records in browser localStorage; backend OCR is unavailable.

### Backend with SQLite and cloud AI — Windows

Install Python 3.12 and the OCR dependencies:

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r server/requirements.txt
```

These Python commands and executable paths are Windows-specific. For macOS/Linux equivalents, see the [backend guide](server/README.md).

Create or edit `.env`, preserving existing credentials and settings:

```dotenv
DB_CLIENT=sqlite
VITE_BACKEND_ENABLED=true
AI_PROVIDER=cloud
OLLAMA_MODEL=gemma4:31b
CLOUD_AI_MODEL=gemma4:31b
OLLAMA_API_KEY=your_ollama_cloud_key
DOCLING_PYTHON=.venv/Scripts/python.exe
FRONTEND_ORIGIN=http://localhost:5173
```

Cloud mode needs an available model and valid cloud credentials; it does not require a local Ollama server. For local inference, use the configuration in the [backend guide](server/README.md).

Start these in separate terminals:

```powershell
npm run server
```

```powershell
npm run dev
```

The frontend runs at [localhost:5173](http://localhost:5173); the backend defaults to `127.0.0.1:8787`. Vite proxies `/api` to the backend. The first Docling conversion may download models. Restart the relevant process after changing environment settings.

### Runpod Ollama with Gemma 4 31B

This runs the model on a Runpod GPU while the frontend, Node backend, database and Docling OCR stay on your app computer. No new AI adapter is required: the backend already uses Ollama's `/api/chat` protocol.

#### 1. Configure the Pod

In the Runpod console, deploy a GPU Pod with the `ollama/ollama:latest` image. Select a GPU with enough memory for the model and context window; our RTX PRO 6000 Blackwell Server Edition session ran `gemma4:31b` entirely on GPU. Check the displayed compute and storage prices before deploying.

Configure these Pod settings:

| Setting | Value |
| --- | --- |
| HTTP port | `11434` |
| `OLLAMA_HOST` | `0.0.0.0:11434` |
| `OLLAMA_MODELS` | `/workspace/models` |
| `OLLAMA_FLASH_ATTENTION` | `1` |

Mount persistent storage at `/workspace` if you want downloaded models to survive replacement of the container. Merely setting `OLLAMA_MODELS` does not create persistent storage. Verify the actual mount and storage retention rules before stopping or deleting a Pod.

The exposed Ollama API has no built-in authentication. Use synthetic data for initial checks; protect the API with an authenticated gateway or a private SSH tunnel before sending private business documents. A Runpod account API key does not automatically protect this API.

#### 2. Download the model and verify GPU inference

Once the Pod is ready, open its Web Terminal:

```bash
ollama pull gemma4:31b
ollama run gemma4:31b
```

Send a short message. Keep that session open and use a second Pod terminal to check:

```bash
ollama ps
nvidia-smi
```

`ollama ps` should list `gemma4:31b` with `100% GPU`. `nvidia-smi` should show an Ollama inference process with GPU memory allocated. An empty model list means nothing is currently loaded; it does not prove CPU fallback. GPU utilization can fall between requests. Check GPU allocation before changing hardware because CPU saturation alone does not prove CPU offloading.

The first request can take longer to load the model. The backend currently waits for the complete answer (`stream:false`), so it does not display tokens as they are generated.

#### 3. Connect NudgeWise

Edit the project's `.env`, preserving your database, OCR and other credentials:

```dotenv
VITE_BACKEND_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://YOUR_POD_ID-11434.proxy.runpod.net
OLLAMA_MODEL=gemma4:31b
AI_TIMEOUT_MS=120000
```

Replace `YOUR_POD_ID` with the ID shown in Runpod and confirm the HTTP proxy URL in your Pod's connection settings. Update the URL whenever you replace the Pod. Do not append `/api/chat` to the base URL; the backend adds it.

`AI_PROVIDER=ollama` uses `OLLAMA_BASE_URL` without an API key, including when that URL points to Runpod. `http://localhost:11434` instead uses the computer running the backend. `AI_PROVIDER=cloud` uses `CLOUD_AI_BASE_URL` and the cloud key; saving a key alone does not select cloud mode.

Restart the backend, and restart Vite if you changed `VITE_BACKEND_ENABLED`:

```powershell
npm run server
```

```powershell
npm run dev
```

#### 4. Check the connection

From your app computer, replace the placeholder and list installed models:

```powershell
Invoke-RestMethod "https://YOUR_POD_ID-11434.proxy.runpod.net/api/tags"
```

Then submit an AI assistant question in NudgeWise using synthetic records. Confirm that the Pod is processing the request rather than relying only on its Running status.

| Symptom | Check or action |
| --- | --- |
| `/api/tags` returns 404 rather than JSON | Check the current Pod ID, exposed HTTP port, startup readiness and container logs. |
| `/api/tags` returns `{"models":[]}` | Download `gemma4:31b` again and verify the persistent storage mount. |
| `/api/chat` returns 404 but `/api/tags` works | Ensure `OLLAMA_MODEL` exactly matches an installed tag, then restart the backend. |
| Slow first response | Allow model loading to finish; inspect `ollama ps` while generating. |
| Model shows CPU or mixed CPU/GPU | Inspect Ollama logs and GPU memory availability; verify allocation before renting a different GPU. |
| `ECONNREFUSED 127.0.0.1:3306` | Start the configured MySQL/MariaDB service or intentionally select SQLite; this error is independent of Runpod. |

Stop GPU compute when finished and review any continuing storage charges. See the [Runpod Ollama tutorial](https://docs.runpod.io/tutorials/pods/run-ollama) and [Ollama GPU checks](https://docs.ollama.com/faq#how-can-i-tell-if-my-model-was-loaded-onto-the-gpu) for upstream guidance.

### MariaDB with Laragon or XAMPP

Start your database server and configure a dedicated demo database and account:

```dotenv
DB_CLIENT=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nudgewise_db
DB_USER=nudgewise_app
DB_PASSWORD=your_database_password
```

Keep the backend/frontend and OCR settings above as needed, then run:

```powershell
npm run db:check
npm run server
```

The credentials must match an actual database account; a blank password only works if that account permits it. Node connects directly to the database, independently of Laragon/phpMyAdmin. The adapter stores authoritative state and original evidence and updates relational projection tables.

The `database/BACKUP_V*.sql` files are database exports, not incremental migrations. They contain database/table drop statements; importing them can replace existing data.

See the [backend setup and troubleshooting guide](server/README.md) for database permissions, AI modes, platform-specific Python paths and deployment settings. `npm start` builds and serves the frontend through the backend. Hosted/shared access requires the demo access settings described there.

## Verification

```powershell
npm run typecheck
npm run build
npm run test:logic
npm run test:workflow
npm run test:quick-sale
npm run test:settlement
npm run test:pdf
npm run test:settings
npm run test:mariadb
npm run test:ui
npm run test:demo-rag
```

Additional customer, PO, backend and AI suites are listed in `package.json` and the backend guide. Synthetic/mock integration tests do not independently prove that live OCR, cloud inference or a real database installation is working.

## Project structure

```text
src/
  views/             Pages: dashboard, orders, invoices, quick sale, settings
  components/        Customer intake, order workspace, invoice details, documents
  lib/               Sales, settlement, reminder, customer and persistence rules
  services/          Frontend-to-backend commands and AI requests
  presentation/      Order stages, labels and review messages
  composables/       Shared reactive store access
  router/            Routes and page navigation
server/              HTTP API, database adapters, OCR worker and AI integration
tests/               Regression suites and synthetic fixtures
docs/                Workflow manual and technical guides
database/            SQL export and database materials
output/pdf/          Fictional buyer PO for manual demos
submission/          Competition submission evidence
graphify-out/        Generated code map (snapshot; confirm against source)
```

## Documentation

| Need | Guide |
| --- | --- |
| Use the application | [Customer and order workflow](docs/customer-order-workflow.md) |
| Configure the API, database, OCR or AI | [Backend setup and troubleshooting](server/README.md) |
| Find code and related tests | [Project structure](#project-structure) and `tests/` |
| Explore code relationships | [Interactive Graphify map](graphify-out/graph.html) (download and open locally); [map report](graphify-out/GRAPH_REPORT.md) |
| Understand assistant rendering | [Markdown rendering and attribution](docs/assistant-markdown.md) |

### Refresh the code map

With `graphifyy` installed in your Python environment, run from the repository root:

```powershell
python graphify-out/rebuild.py
```

This refreshes `graph.html`, `graph.json`, `GRAPH_REPORT.md` and `coverage.json` in `graphify-out/`. The map indexes code relationships and documentation headings; verify runtime behavior in the source and tests. Secrets, runtime data, dependencies, builds and binary fixtures are excluded. See the [map report](graphify-out/GRAPH_REPORT.md) for the generated snapshot, and confirm coverage against the current source.

## Prototype limits

Reminder delivery is simulated. Email delivery and live payment-provider verification are not implemented. The application is not an integrated card terminal or statutory e-invoice submission service. A receipt image, pending transfer or OCR result does not prove that funds settled.

Demo roles and the shared access mechanism are not production user authentication. Use synthetic contacts and transactions. Keep `.env`, API keys, database backups, original business documents, local environments and generated build folders out of commits.

## License and attribution

The repository contains the [Apache License 2.0](LICENSE). Third-party libraries, fonts, runtimes and model weights retain their respective licenses. Preserve applicable upstream license and notice files when distributing them. Markdown renderer attribution is recorded in [the rendering guide](docs/assistant-markdown.md).
