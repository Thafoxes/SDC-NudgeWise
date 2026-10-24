# Replit hosting

The checked-in `.replit` config runs the Vue frontend and Node backend together with `npm run start`. See the [backend guide](../server/README.md) for environment settings, access control and troubleshooting.

## Runtime and build

- Node.js 24 and Python 3.12 are configured.
- Build command: `npm ci && UV_PROJECT_ENVIRONMENT=.pythonlibs uv sync --frozen`.
- Run command: `npm run start`.
- Port: `5000`, exposed as HTTP port `80`.
- OCR interpreter: `.pythonlibs/bin/python`.
- Deployment target: VM.

Keep `pyproject.toml` and `uv.lock` aligned with `server/requirements.txt`; Replit uses them to install the OCR dependencies. The application entry point is `server/app.cjs`.

## Configuration and persistence

Set credentials through Replit Secrets. Public startup requires `DEMO_ACCESS_KEY`; configure AI and database settings using the backend guide and `.env.example`. Frontend feature flags must be set before building. Telegram integration has been removed.

Local SQLite data lives in `.local-data/demo.sqlite`. Process restarts on the same filesystem retain it, but redeployments or replacement filesystems may not. Back up demo data before replacing a deployment and use synthetic records.

This guide describes the repository configuration; it does not establish that a deployment is currently published or healthy.
