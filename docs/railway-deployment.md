# Railway deployment

The Vue build and Node API run in the same `nudgewise` service. The Dockerfile builds with Node 24 and includes Python 3.12, CPU PyTorch and the existing Docling requirements. MariaDB runs privately in a separate service.

Project: https://railway.com/project/ab8a0a42-9f9c-4b49-b043-4db73ec154bc

The repository includes [`railway.toml`](../railway.toml), which selects the Dockerfile builder and starts `node server/app.cjs`. The Railway service root directory must be the repository root (`/`); do not set it to `server`, because the Dockerfile and Node package manifest are at the root.

## Storage and access

Railway's pre-deploy command is `node server/init-schema.cjs`. It imports the schema-only SQL when MariaDB has no tables. Existing databases receive the idempotent `delivery_status` migration from `VARCHAR` to `TEXT`, preserving full reminder cancellation explanations and existing rows. The adapter creates its runtime snapshot/evidence tables on startup. Other partially initialized or incompatible databases require explicit repair.

- `mariadb`: persistent volume at `/var/lib/mysql`; no public database endpoint.
- `nudgewise`: persistent volume at `/app/.local-data` for email state, OAuth tokens and model cache.
- `DEMO_ACCESS_KEY`: generated shared demo passcode, stored in Railway variables. This is demo access protection, not individual user authentication.
- `PUBLIC_DEMO=true` deliberately disables the passcode for a shared public demo. Anyone with the URL can read and edit the workspace and use its AI/OCR; use only non-sensitive demo data. Remove this setting to restore passcode protection.
- Fresh cloud database: local database files and credentials are excluded from uploads.

## External integrations

AI initially uses `AI_PROVIDER=off`. Enable it by setting the existing backend AI provider variables in Railway. A local `localhost` Ollama URL is not reachable from Railway.

Gmail requires `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and the generated `EMAIL_TOKEN_KEY`. Register `https://nudgewise-production.up.railway.app/api/email/callback` as an authorized redirect URI in Google, set `GMAIL_REDIRECT_URI` to that URL in Railway, then connect Gmail through Settings. Existing local OAuth sessions are not uploaded. Mailpit is not used by the current Gmail implementation.

Text-only customer/image/PDF intake uses RapidOCR directly with two CPU threads. Docling table extraction still needs more than this plan's 1 GB memory limit; upgrade host memory for table uploads. RapidOCR is pinned to 3.9.1 because 3.10.0 removed an API needed by Docling 2.133.0. Run `python tests/ocr-smoke.py` in the OCR Python environment for synthetic PNG/PDF and upload-limit checks.

Configure database backups in Railway before relying on it for business data; persistent volumes alone are not backups.

## Deploy updates

From the repository root, after signing in with `railway login`:

```powershell
railway up --project ab8a0a42-9f9c-4b49-b043-4db73ec154bc --environment 1e479b2a-e7b9-4a0a-bf20-119e774a3b3a --service 6275e8a9-4a1f-45f2-8d42-12bd2d18dc86 --detach
```

Check that deployment's status in Railway; upload completion alone does not confirm a running app. The health check is `/api/access`. Local uploads do not enable automatic deployment on Git pushes.

If Railway reports `No start command detected` and mentions Python/Railpack, the service is not using the repository root or the Dockerfile builder. Set the service's root directory to `/`, set the builder to **Dockerfile**, and redeploy. The committed `railway.toml` applies those settings for source-based deployments from this repository.
