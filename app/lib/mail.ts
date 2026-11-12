import ExcelJS from "exceljs";
import MailComposer from "nodemailer/lib/mail-composer";
import { createHmac, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { classificationHtml, signatureHtml } from "./signature.ts";

export type ActivityRow = { project: string; task: string; hours: string };
export type MailJob = { id: string; owner: string; sendAt: string; to: string; cc: string; subject: string; html: string; date: string; rows: ActivityRow[]; signatureName: string; signatureTitle: string; error?: string };

const dataDir = path.join(process.cwd(), "data");
const logoPath = path.join(process.cwd(), "public", "signature-logos.png");
const redisUrlKey = Object.keys(process.env).find((key) => /(REST_API|REDIS_REST)_URL$/.test(key) && process.env[key.replace(/URL$/, "TOKEN")]);
const redisUrl = redisUrlKey && process.env[redisUrlKey];
const redisToken = redisUrlKey && process.env[redisUrlKey.replace(/URL$/, "TOKEN")];
const missingStorage = "Storage is not connected. In Vercel open Storage, add Upstash for Redis, connect it to this project, then redeploy.";

async function redis(command: (string | number)[]) {
  const response = await fetch(redisUrl!, { method: "POST", headers: { Authorization: `Bearer ${redisToken}` }, body: JSON.stringify(command), cache: "no-store" });
  const { result, error } = await response.json();
  if (error) throw new Error(`Redis: ${error}`);
  return result;
}

async function readStored<T>(key: string): Promise<T | null> {
  if (!redisUrl && process.env.VERCEL) throw new Error(missingStorage);
  try {
    const value = redisUrl ? await redis(["GET", key]) : await fs.readFile(localPath(key), "utf8");
    return value ? JSON.parse(value) : null;
  } catch (error) {
    if (redisUrl) throw error;
    return null;
  }
}

async function writeStored(key: string, value: unknown) {
  if (!redisUrl && process.env.VERCEL) throw new Error(missingStorage);
  if (redisUrl) return void await redis(value === null ? ["DEL", key] : ["SET", key, JSON.stringify(value)]);
  if (value === null) return fs.rm(localPath(key), { force: true });
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(localPath(key), JSON.stringify(value), { mode: 0o600 });
}

function localPath(key: string) {
  return path.join(dataDir, `${encodeURIComponent(key)}.json`);
}

const userKey = (email: string, key: string) => `user:${email}:${key}`;

const BLOCK_WIDTH = 4;
const HEADER_ROW = 4;
const TOTAL_ROW = 22;
export const MAX_ACTIVITY_ROWS = TOTAL_ROW - HEADER_ROW - 1;

export async function updateActivityLog(buffer: Buffer, date: string, rows: ActivityRow[]) {
  if (rows.length > MAX_ACTIVITY_ROWS) throw new Error(`Activity log block A4:D22 fits ${MAX_ACTIVITY_ROWS} tasks, got ${rows.length}.`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets.find((worksheet) => worksheet.name === monthSheetName(date)) ?? workbook.worksheets[0];
  const header = formatShortDate(date);
  let start = 0;
  for (let column = 3; column <= sheet.getRow(HEADER_ROW).cellCount; column += BLOCK_WIDTH) {
    if (sheet.getCell(HEADER_ROW, column).text === header) {
      start = column - 2;
      break;
    }
  }

  if (!start) {
    start = 1;
    for (let rowNumber = HEADER_ROW; rowNumber <= TOTAL_ROW; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      for (let column = row.cellCount; column >= 1; column--) {
        const source = row.getCell(column);
        const target = row.getCell(column + BLOCK_WIDTH);
        target.value = shiftFormula(source.value);
        target.style = source.style;
      }
    }
  }

  for (let rowNumber = HEADER_ROW; rowNumber <= TOTAL_ROW; rowNumber++) for (let column = start; column < start + BLOCK_WIDTH; column++) sheet.getCell(rowNumber, column).value = null;
  sheet.getCell(HEADER_ROW, start).value = "Project";
  sheet.getCell(HEADER_ROW, start + 1).value = "Task";
  sheet.getCell(HEADER_ROW, start + 2).value = header;
  rows.forEach((row, index) => {
    const rowNumber = HEADER_ROW + 1 + index;
    sheet.getCell(rowNumber, start).value = index === 0 || rows[index - 1].project !== row.project ? row.project : null;
    sheet.getCell(rowNumber, start + 1).value = row.task;
    sheet.getCell(rowNumber, start + 2).value = Number(row.hours) || 0;
  });
  const hoursColumn = columnName(start + 2);
  sheet.getCell(TOTAL_ROW, start + 2).value = { formula: `SUM(${hoursColumn}${HEADER_ROW + 1}:${hoursColumn}${TOTAL_ROW - 1})`, result: rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0) };
  workbook.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function shiftFormula(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (!value || typeof value !== "object" || !("formula" in value) || !value.formula) return value;
  return { ...value, formula: value.formula.replace(/(?<![A-Z$])(\$?)([A-Z]{1,3})(\$?\d+)(?![\d(])/g, (_, absolute, column, row) => `${absolute}${columnName(columnNumber(column) + BLOCK_WIDTH)}${row}`) };
}

function columnNumber(name: string) {
  return name.split("").reduce((number, character) => number * 26 + character.charCodeAt(0) - 64, 0);
}

function columnName(number: number): string {
  return number > 26 ? columnName(Math.floor((number - 1) / 26)) + columnName(((number - 1) % 26) + 1) : String.fromCharCode(64 + number);
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

function monthSheetName(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export async function saveActivityLog(email: string, name: string, buffer: Buffer) {
  await new ExcelJS.Workbook().xlsx.load(buffer as unknown as ArrayBuffer);
  const storedName = path.basename(name).replace(/-\d+(?=\.xlsx$)/i, "");
  await writeStored(userKey(email, "activity-log"), { name: storedName, data: buffer.toString("base64") });
  return storedName;
}

export async function readActivityLog(email: string) {
  const log = await readStored<{ name: string; data: string }>(userKey(email, "activity-log"));
  return log ? { name: log.name, buffer: Buffer.from(log.data, "base64") } : null;
}

export async function syncActivityLog(email: string, date: string, rows: ActivityRow[]) {
  const log = await readActivityLog(email);
  if (!log) return null;
  const buffer = await updateActivityLog(log.buffer, date, rows);
  await writeStored(userKey(email, "activity-log"), { name: log.name, data: buffer.toString("base64") });
  return { name: log.name, buffer };
}

type GoogleAccount = { email: string; name: string; refreshToken: string };

export function googleConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.");
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET };
}

export function readGoogleAccount(email: string) {
  return readStored<GoogleAccount>(userKey(email, "google"));
}

export function saveGoogleAccount(account: GoogleAccount) {
  return writeStored(userKey(account.email, "google"), account);
}

export async function deleteGoogleAccount(email: string) {
  const account = await readGoogleAccount(email);
  if (account) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.refreshToken)}`, { method: "POST" }).catch(() => undefined);
  await writeStored(userKey(email, "google"), null);
}

export const sessionCookie = "daily-report-session";
const sessionDays = 30;

export function isAllowedEmail(email: string) {
  const allowed = (process.env.ALLOWED_EMAIL ?? "").toLowerCase().split(",").map((entry) => entry.trim()).filter(Boolean);
  return !allowed.length || allowed.some((entry) => entry.startsWith("@") ? email.endsWith(entry) : email === entry);
}

function signSession(payload: string) {
  if (!process.env.SESSION_SECRET) throw new Error("Set SESSION_SECRET.");
  return createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
}

export function createSession(email: string) {
  const payload = `${email.toLowerCase()}|${Date.now() + sessionDays * 86_400_000}`;
  return { value: `${payload}|${signSession(payload)}`, maxAge: sessionDays * 86_400 };
}

export function sessionEmail(cookie?: string) {
  const [email, expires, signature] = cookie?.split("|") ?? [];
  if (!email || !expires || !signature || Number(expires) < Date.now() || !isAllowedEmail(email)) return null;
  const expected = Buffer.from(signSession(`${email}|${expires}`));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? email : null;
}

export function requireSession(request: { cookies: { get(name: string): { value: string } | undefined } }): string | Response {
  try {
    const email = sessionEmail(request.cookies.get(sessionCookie)?.value);
    if (email) return email;
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
  return Response.json({ error: "Sign in with Gmail first." }, { status: 401 });
}

export async function scheduleDelivery(origin: string, sendAt: string) {
  const { QSTASH_TOKEN, QSTASH_URL = "https://qstash.upstash.io", VERCEL } = process.env;
  if (!QSTASH_TOKEN) {
    if (VERCEL) throw new Error("Scheduling on Vercel needs QSTASH_TOKEN.");
    return;
  }
  const response = await fetch(`${QSTASH_URL}/v2/publish/${origin}/api/send/due`, { method: "POST", headers: { Authorization: `Bearer ${QSTASH_TOKEN}`, "Upstash-Not-Before": String(Math.floor(Date.parse(sendAt) / 1000)) } });
  if (!response.ok) throw new Error(`QStash: ${await response.text()}`);
}

async function googleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Gmail login expired, sign in again (${result.error}).`);
  return result.access_token as string;
}

export async function sendReport(job: Omit<MailJob, "id" | "sendAt">) {
  const account = await readGoogleAccount(job.owner);
  if (!account) throw new Error("Sign in with Gmail first.");
  const log = await syncActivityLog(job.owner, job.date, job.rows);
  const raw = await new MailComposer({
    from: { name: account.name, address: account.email },
    to: job.to,
    cc: job.cc || undefined,
    subject: job.subject,
    html: `${classificationHtml}${job.html}${signatureHtml(job.signatureName || account.name, job.signatureTitle, "cid:signature-logos")}`,
    attachments: [
      { filename: "signature-logos.png", path: logoPath, cid: "signature-logos" },
      ...(log ? [{ filename: log.name, content: log.buffer }] : []),
    ],
  }).compile().build();
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${await googleAccessToken(account.refreshToken)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: raw.toString("base64url") }),
  });
  if (!response.ok) throw new Error(`Gmail send failed: ${(await response.json()).error?.message ?? response.status}`);
}

export async function readQueue() {
  return (await readStored<MailJob[]>("scheduled")) ?? [];
}

export async function updateQueue(change: (jobs: MailJob[]) => MailJob[]) {
  await writeStored("scheduled", change(await readQueue()));
}

let sending = false;

export async function sendDueJobs() {
  if (sending || (redisUrl && await redis(["SET", "sending-lock", "1", "NX", "EX", 120]) !== "OK")) return;
  sending = true;
  try {
    for (const job of (await readQueue()).filter((queued) => !queued.error && new Date(queued.sendAt) <= new Date())) {
      try {
        await sendReport(job);
        await updateQueue((jobs) => jobs.filter((queued) => queued.id !== job.id));
      } catch (error) {
        await updateQueue((jobs) => jobs.map((queued) => queued.id === job.id ? { ...queued, error: String(error) } : queued));
      }
    }
  } finally {
    sending = false;
    if (redisUrl) await redis(["DEL", "sending-lock"]);
  }
}
