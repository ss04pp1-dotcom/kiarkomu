---
name: Orval mutateAsync data vs body
description: Orval-generated mutation hooks expect the variable key "data" not "body" when calling mutateAsync
---

The Orval-generated `useXxx` mutation hooks always destructure `const { data } = props` inside the internal `mutationFn`. Calling `mutateAsync({ body: {...} as any })` silently passes `undefined` as the request body — the server receives no body, `req.body` is `{}`, and any guard on empty updates fires.

**Why:** TypeScript's `as any` bypass hides the mismatch at compile time; the error only shows at runtime as a server 400.

**How to apply:** Always call `mutateAsync({ data: {...} })` (not `body`). When using `as any` to pass extra fields not in the generated schema, check the generated `MutationFunction` signature first.
