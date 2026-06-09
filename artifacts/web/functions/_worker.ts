export interface Env {
  ASSETS: Fetcher;
  RENDER_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const base = env.RENDER_API_URL ?? "https://shohure-api.onrender.com";
    ctx.waitUntil(
      fetch(`${base}/api/healthz`, { method: "GET" })
        .then((r) => console.log(`[keep-alive] ${r.status} ${new Date().toISOString()}`))
        .catch((e) => console.error(`[keep-alive] failed: ${e}`)),
    );
  },
};
