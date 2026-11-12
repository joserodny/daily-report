import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { MailJob, readQueue, requireSession, scheduleDelivery, sendReport, updateQueue } from "../../lib/mail";

const emailList = /^\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+(\s*,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+)*\s*$/;

export async function GET(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  return Response.json((await readQueue()).filter((job) => job.owner === owner));
}

export async function POST(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  const { to, cc = "", subject, html, date, rows, sendAt, signatureName = "", signatureTitle = "" } = await request.json();
  if (!emailList.test(to ?? "")) return Response.json({ error: "Enter valid To addresses, separated by commas." }, { status: 400 });
  if (cc && !emailList.test(cc)) return Response.json({ error: "Enter valid Cc addresses, separated by commas." }, { status: 400 });
  if (!subject || !html || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Array.isArray(rows)) return Response.json({ error: "Report is incomplete." }, { status: 400 });
  const job = { owner, to, cc, subject, html, date, rows, signatureName: String(signatureName), signatureTitle: String(signatureTitle) };
  try {
    if (sendAt) {
      if (Number.isNaN(Date.parse(sendAt)) || Date.parse(sendAt) <= Date.now()) return Response.json({ error: "Schedule time must be in the future." }, { status: 400 });
      const scheduled: MailJob = { ...job, id: randomUUID(), sendAt };
      await scheduleDelivery(`${request.nextUrl.protocol}//${request.headers.get("host")}`, sendAt);
      await updateQueue((jobs) => [...jobs, scheduled]);
      return Response.json(scheduled);
    }
    await sendReport(job);
    return Response.json({ sent: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  const id = request.nextUrl.searchParams.get("id");
  await updateQueue((jobs) => jobs.filter((job) => job.id !== id || job.owner !== owner));
  return Response.json({ cancelled: true });
}
