# NudgeWise backend

The Node backend provides SQLite or MariaDB persistence, customer and purchase-order intake, document evidence storage, order workflow commands, AI assistance and reminder rewriting. The Vue frontend accesses it through `/api`.

**Telegram integration has been removed.** There is no bot polling, chat linking, Telegram sending or receipt download API. Old Telegram environment variables are ignored. Reminder sending is a simulation; email delivery and bank verification are not implemented. Existing database records and legacy attachment files are retained.

## Quick start (SQLite, Windows)

Run commands from the repository root. Use Node.js 24+ and Python 3.12 for OCR.

```powershell
npm install
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r server/requirements.txt
```

Create `.env` if it does not exist. Preserve existing credentials and database settings when editing it. For SQLite and cloud Gemma, use:

```dotenv
DB_CLIENT=sqlite
VITE_BACKEND_ENABLED=true
AI_PROVIDER=cloud
OLLAMA_MODEL=gemma4:31b
OLLAMA_API_KEY=your_ollama_cloud_key
DOCLING_PYTHON=.venv/Scripts/python.exe
FRONTEND_ORIGIN=http://localhost:5173
```

An existing Python environment can be reused: point `DOCLING_PYTHON` at its Python executable. The environment folder's name does not affect its function. On macOS/Linux, create it with `python3.12 -m venv .venv`, install requirements with `.venv/bin/python -m pip install -r server/requirements.txt`, and set `DOCLING_PYTHON=.venv/bin/python`.

Start the backend:

```powershell
npm run server
```

In another terminal:

```powershell
npm run dev
```

Open http://localhost:5173. The backend defaults to http://127.0.0.1:8787; Vite proxies `/api` there. SQLite data and original PO evidence are stored in `.local-data/demo.sqlite`. Do not commit `.env`, databases, backups, or original business documents.

`npm start` builds the frontend and starts the backend, which serves the built frontend too. Setting `PORT` makes the server listen on all interfaces and requires `DEMO_ACCESS_KEY`; this shared demo passcode is not production user authentication. Restart the backend after changing server settings and restart Vite after changing `VITE_*` settings.

## Runpod Ollama

The existing Ollama provider also accepts a remote Pod URL. This workspace's `.env` is configured for Pod `yj5ptfr3osz3l0`:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://yj5ptfr3osz3l0-11434.proxy.runpod.net
OLLAMA_MODEL=gemma4:31b
AI_TIMEOUT_MS=120000
```

Restart the backend with `npm run server` after changing these settings. No Runpod account key is needed for the Pod's native Ollama API; existing cloud credentials are unused in this mode. Frontend, database and local OCR settings stay the same.

If AI requests return HTTP 404, check the Pod's `/api/tags` response. An empty `models` list means the model must be downloaded again (`ollama pull gemma4:31b` in the Pod terminal). A directory named `/workspace/models` is not persistent unless a persistent volume is actually mounted there or at its parent. Verify the storage mount before stopping or replacing the Pod; otherwise downloaded models can be lost. `OLLAMA_MODEL` must exactly match an installed model tag.

This Pod URL currently has no authentication. Before sending private business documents, protect it with an authenticated gateway or use a private SSH tunnel. For an authenticated Ollama gateway, use `AI_PROVIDER=cloud`, its URL in `CLOUD_AI_BASE_URL`, `CLOUD_AI_MODEL=gemma4:31b`, and its dedicated token in `CLOUD_AI_API_KEY` (never a `VITE_*` variable). A replacement Pod needs a new URL.

## MariaDB / XAMPP

Use `DB_CLIENT=mariadb` with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` as shown in [`.env.example`](../.env.example). Start MariaDB before running the backend. phpMyAdmin is an administration UI; Node connects directly to MariaDB. Use a dedicated demo database: the adapter maintains a projection of application state in that schema.

```powershell
npm run db:check
npm run server
```

The database user needs the permissions required by the adapter's schema setup and persistence. MariaDB configuration is independent of OCR/AI configuration.

## OCR and AI

Document extraction runs **local Docling Python**, not the Docling MCP server. Docling uses RapidOCR and exports text to the Node process. The first conversion may download OCR/layout models. Customer, PO and quick-sale order extraction accept PDF, PNG and JPEG, up to 10 MiB and five pages. Quick-sale extraction proposes items and explicit prices for seller review. Payment-receipt uploads use a separate evidence-only route: they retain PDF/PNG/JPEG originals up to 10 MiB without OCR or cloud AI.

The configured Ollama model turns OCR text into proposed fields. Cloud mode sends the extracted text to the configured Ollama endpoint. Never put API keys in `VITE_*` variables.

| Setting | Behavior |
| --- | --- |
| `AI_PROVIDER=cloud` | Cloud Ollama only; default when unset. Requires `OLLAMA_API_KEY` or `CLOUD_AI_API_KEY`. |
| `AI_PROVIDER=ollama` | Local Ollama only at `OLLAMA_BASE_URL` (default `http://localhost:11434`). |
| `AI_PROVIDER=auto` | Try local Ollama, then cloud when a cloud key is configured. |
| `AI_PROVIDER=off` | Reject AI requests; use manual entry. |
| `OLLAMA_MODEL` | Local model; also cloud model unless overridden. Local default is `llama3.2:3b`. |
| `CLOUD_AI_MODEL` | Optional cloud override; cloud default is `gemma4:31b` when neither model is set. |
| `CLOUD_AI_BASE_URL` | Ollama-compatible cloud base URL; default `https://ollama.com`. |
| `AI_TIMEOUT_MS` | AI timeout, clamped to 1–120 seconds; default 120 seconds in cloud mode, 30 seconds otherwise. |
| `DOCLING_PYTHON` | Python executable with `server/requirements.txt` installed; default `python`. |

Cloud mode needs no local Ollama installation. Local mode requires a running Ollama service and an installed model.

Customer extraction checks every returned field against OCR text, ignoring presentation differences. Unsupported fields or an extraction without usable contact details fail rather than populating fabricated details. The customer intake screen shows the error and logs `Customer document extraction failed` in the browser console. This check cannot establish that the model chose the correct party from a document; always review the buyer identity. Customer uploads are temporary and removed after extraction.

PO uploads retain the original file in database evidence storage, even if extraction fails. Draft fields remain editable; confirmed approval makes the PO read only. Chat screenshots propose order items, never agreement or verified payment. See [the customer/order manual](../docs/customer-order-workflow.md) for the workflow.

## Browser-only mode

Set `VITE_BACKEND_ENABLED=false`, restart Vite and run `npm run dev` without the backend. This uses browser localStorage and local rules. Document extraction and server AI are unavailable. Browser data and backend data are separate. Reminder delivery remains simulated in both modes. Backend mode uses the business's current date; browser-only mode offers simulated-date controls.

## Troubleshooting

- **API connection fails:** start the backend, check database connectivity and port 8787, and enable `VITE_BACKEND_ENABLED`. Existing Telegram flags no longer enable backend mode.
- **Docling fails:** check `DOCLING_PYTHON`, install the requirements into that environment, and allow the initial model downloads. Try a clearer document or enter fields manually.
- **Gemma times out or access is denied:** check the configured provider/model, internet connection and backend-only API key. Restart after configuration changes. No successful extraction is substituted for an API failure.
- **Customer fields rejected:** the model returned text that could not be verified against OCR, or OCR found no useful contact details. Use a clearer image or manual entry.
- **Original PO cannot be found:** use the same backend database/workspace where it was uploaded; original evidence is not stored in browser snapshots.

## Checks

```powershell
npm run test:server
npm run test:settings
npm run test:settlement
npm run test:quick-sale
npm run test:customers
npm run test:po
npm run test:workflow
npm run test:mariadb
npm run test:ai-v2
npm run test:logic
npm run test:ui
npm run build
```

These regression suites use synthetic fixtures and mocked AI; they do not verify a live Gemma service or real bank settlement. `test:mariadb` checks the adapter seam without requiring a live database; `db:check` checks the configured database connection. The old `test:telegram` and `test:telegram:live` commands have been removed.


## Demo scenarios and assistant retrieval

The `manageDemoScenarios` command loads, resets or removes a business-scoped fictional dataset. The store snapshot retains its record manifest and reviewed `knowledgePolicies`; both SQLite and MariaDB persist these through their existing state path. No new database service or embedding API is required. Reset refuses to remove demo data when independent manual sales records depend on it.

`/api/policy-document` retains the uploaded original and uses local Docling to propose text, without invoking cloud AI during import. The seller must review and publish that text using `saveKnowledgePolicy`. Assistant questions retrieve active, effective policy passages and workflow guide excerpts plus current invoice/order facts. Selected evidence is sent to the configured Ollama model; responses include source metadata. Policies are guidance, not executable approval rules.

See the workflow manual for limits and privacy behavior. Run `npm run test:demo-rag` for mocked scenario/RAG checks.
