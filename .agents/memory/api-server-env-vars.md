---
name: API Server Required Env Vars
description: The API server crashes on startup if these three env vars are missing
---

Three env vars must be set before the API server can start:

- `CONFIG_ENCRYPTION_KEY` — 32-byte hex string for encrypting config values
- `ADMIN_JWT_SECRET` — 32-byte hex string for admin JWT signing
- `JWT_SECRET` — 32-byte hex string for user JWT signing

**Why:** The crypto module validates CONFIG_ENCRYPTION_KEY at import time (not lazily), so the server crashes before binding its port if any are missing.

**How to apply:** Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set via `setEnvVars` in the shared environment. Do this before any attempt to restart the API server workflow.
