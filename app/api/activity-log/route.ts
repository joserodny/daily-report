import { NextRequest } from "next/server";
import { readActivityLog, requireSession, saveActivityLog, syncActivityLog } from "../../lib/mail";

export async function PUT(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  const { date, rows } = await request.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Array.isArray(rows)) return Response.json({ error: "Report is incomplete." }, { status: 400 });
  try {
    return Response.json({ name: (await syncActivityLog(owner, date, rows))?.name ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  const log = await readActivityLog(owner);
  if (!request.nextUrl.searchParams.has("download")) return Response.json({ name: log?.name ?? null });
  if (!log) return Response.json({ error: "No activity log imported." }, { status: 404 });
  return new Response(new Uint8Array(log.buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${encodeURIComponent(log.name)}"` } });
}

export async function POST(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "Choose an .xlsx activity log." }, { status: 400 });
  try {
    return Response.json({ name: await saveActivityLog(owner, file.name, Buffer.from(await file.arrayBuffer())) });
  } catch {
    return Response.json({ error: "File is not a readable .xlsx workbook." }, { status: 400 });
  }
}
