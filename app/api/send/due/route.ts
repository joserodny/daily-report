import { sendDueJobs } from "../../../lib/mail";

export const maxDuration = 60;

export async function POST() {
  await sendDueJobs();
  return Response.json({ ok: true });
}
