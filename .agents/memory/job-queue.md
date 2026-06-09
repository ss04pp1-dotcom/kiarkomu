---
name: Job queue retry system
description: How background email and push notification retries work in this project
---

## The rule
All email sends (verification, password reset) and push notifications use the `job_queue` DB table via `enqueueJob()`. Never use fire-and-forget `.catch` directly — the queue handles retries.

## Job types
- `email:verification` — payload: `{ to, code, siteName? }`
- `email:password-reset` — payload: `{ to, code, siteName }`
- `push` — payload: `{ token, title, body, data? }`

## Status lifecycle
`pending` → `processing` → `done`
                         ↘ `retrying` (backoff: 1 min, 5 min, 15 min) → `failed` (after max_attempts=3)

## Worker
`artifacts/api-server/src/lib/job-queue.ts` — `setupJobQueue()` called in `index.ts` after server starts.

**Why:** Transient Brevo/Expo API failures would silently drop verification emails and order notifications. The queue guarantees at-least-once delivery with retry.

**How to apply:** Any new outbound email or push notification must call `enqueueJob(type, payload)` — not the sender function directly.
