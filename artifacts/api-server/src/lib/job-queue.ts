import { db } from "@workspace/db";
import { jobQueueTable } from "@workspace/db";
import { and, inArray, lte, lt, eq } from "drizzle-orm";
import { logger } from "./logger.js";

export async function enqueueJob(type: string, payload: Record<string, unknown>): Promise<void> {
  await db.insert(jobQueueTable).values({ type, payload });
}

async function processJobs(): Promise<void> {
  const now = new Date();

  const jobs = await db
    .select()
    .from(jobQueueTable)
    .where(
      and(
        inArray(jobQueueTable.status, ["pending", "retrying"]),
        lte(jobQueueTable.nextRetryAt, now),
        lt(jobQueueTable.attempts, jobQueueTable.maxAttempts),
      ),
    )
    .limit(20);

  for (const job of jobs) {
    const nextAttempts = job.attempts + 1;

    await db
      .update(jobQueueTable)
      .set({ status: "processing", attempts: nextAttempts, updatedAt: new Date() })
      .where(eq(jobQueueTable.id, job.id));

    try {
      const p = job.payload as Record<string, any>;

      if (job.type === "email:verification") {
        const { sendVerificationEmail } = await import("./mailer.js");
        await sendVerificationEmail(p["to"] as string, p["code"] as string, p["siteName"] as string | undefined);
      } else if (job.type === "email:password-reset") {
        const { sendPasswordResetEmail } = await import("./mailer.js");
        await sendPasswordResetEmail(p["to"] as string, p["code"] as string, p["siteName"] as string | undefined);
      } else if (job.type === "push") {
        const { sendPushNotification } = await import("./push.js");
        await sendPushNotification(
          p["token"] as string,
          p["title"] as string,
          p["body"] as string,
          p["data"] as Record<string, unknown> | undefined,
        );
      } else {
        logger.warn({ jobId: job.id, type: job.type }, "Job queue: unknown job type, discarding");
      }

      await db
        .update(jobQueueTable)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(jobQueueTable.id, job.id));
    } catch (err: unknown) {
      const isDead = nextAttempts >= job.maxAttempts;
      const backoffMs = ([60_000, 300_000, 900_000] as number[])[nextAttempts - 1] ?? 900_000;
      const errMsg = err instanceof Error ? err.message : String(err);

      await db
        .update(jobQueueTable)
        .set({
          status: isDead ? "failed" : "retrying",
          lastError: errMsg,
          nextRetryAt: new Date(Date.now() + backoffMs),
          updatedAt: new Date(),
        })
        .where(eq(jobQueueTable.id, job.id));

      logger.error({ err, jobId: job.id, type: job.type, attempt: nextAttempts }, "Job queue: job failed");
    }
  }
}

export function setupJobQueue(): void {
  processJobs().catch((err) => logger.error({ err }, "Job queue: initial run failed"));
  setInterval(() => {
    processJobs().catch((err) => logger.error({ err }, "Job queue: tick failed"));
  }, 60_000);
}
