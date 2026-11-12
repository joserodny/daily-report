export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  const scheduler = globalThis as typeof globalThis & { reportScheduler?: NodeJS.Timeout };
  if (scheduler.reportScheduler) return;
  const { sendDueJobs } = await import("./app/lib/mail");
  scheduler.reportScheduler = setInterval(() => void sendDueJobs(), 30_000);
}
