"use client";

import { useEffect, useMemo, useState } from "react";

type Report = {
  date: string;
  greeting: string;
  accomplishments: string;
  overtime: string;
  overtimeTime: string;
  overtimeEnabled: boolean;
  blockers: string;
  notes: string;
  nextTasks: string;
};

type ActivityRow = { project: string; task: string; hours: string };

const emptyReport: Report = {
  date: new Date().toISOString().slice(0, 10),
  greeting: "Dear Mr. Heng,\n\nPlease find the below report.",
  accomplishments: "Meetings Attended:\nDaily Meeting with Engineers\nDaily Leadership Huddles\n\nAWWA School:\nAWWASchool-web\nSocial Work Module\nAdded: the following UI\nCase transfer details page - acknowledgements section\nChanged: case transfer service\nEnforce acknowledge case transfer api\nAdded: Case transfer enum\nCase transfer acknowledgement types\nChanged: case transfer status enum\nChanged: integrate the following\nAcknowledge Case Transfer API\nAdded: route config for case transfer details and form\n\nAWWASchool-api\nSocial Work Module\nAdded: process acknowledgement\nSet status based on acknowledgement types\nInclude status validation\nAdded: case transfer acknowledgement model\n\nDatabase:\nChanged: include 'is_acknowledge' field in 'case_transfer_acknowledgement' table",
  overtime: "AWWA School:\nAWWASchool-web\nAdded: cancel case transfer dialog UI\nChanged: integrate cancel transfer API\nEnforce: case transfer permissions\n\nAWWASchool-api\nAdded: cancel case transfer function\nAdded: cancel rules validation\nAdded: api route for cancel case transfer\nAdded: case transfer permissions\n\nDatabase:\nChanged: include 'cancel_reason' field in 'social_work_case_transfers' table",
  overtimeTime: "6:00pm - 9:00pm",
  overtimeEnabled: false,
  blockers: "None.",
  notes: "None",
  nextTasks: "",
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );

const lines = (value: string) => value.split("\n").filter((line) => line.trim());

export default function Home() {
  const [report, setReport] = useState<Report>(emptyReport);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activityCopied, setActivityCopied] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("daily-report");
    if (stored) setReport(JSON.parse(stored));
  }, []);

  const subject = useMemo(() => `Daily Report for ${formatDate(report.date)}`, [report.date]);
  const update = (key: keyof Report, value: string | boolean) => setReport((current) => ({ ...current, [key]: value }));
  const reportText = buildReportText(report, subject);
  const reportHtml = buildReportHtml(report, subject);
  const activityRows = useMemo(() => {
    const regularRows = buildActivityRows(report.accomplishments, 8);
    return report.overtimeEnabled ? [...regularRows, ...buildActivityRows(report.overtime)] : regularRows;
  }, [report.accomplishments, report.overtime, report.overtimeEnabled]);
  const activityText = buildActivityText(activityRows, report.date);

  const save = () => {
    persistReport(report);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const copy = async () => {
    persistReport(report);
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([reportHtml], { type: "text/html" }),
          "text/plain": new Blob([reportText], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(reportText);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyActivityLog = async () => {
    await navigator.clipboard.writeText(activityText);
    setActivityCopied(true);
    window.setTimeout(() => setActivityCopied(false), 1800);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Daily Report home"><span className="brand-mark">DR</span><span>Daily Report</span></a>
        <div className="top-actions"><span className="autosave"><span className="status-dot" /> Saved locally</span><button className="button button-ghost" onClick={() => window.print()}>Print report</button><button className="button button-dark" onClick={save}>{saved ? "Saved" : "Save report"}</button></div>
      </header>

      <section className="intro"><div><p className="eyebrow">WORK LOG · 2026</p><h1>Make today <em>count.</em></h1><p className="subtitle">A clear daily report takes less than five minutes. Capture the work, call out the blockers, and start tomorrow with direction.</p></div><div className="date-card"><span>Report date</span><input type="date" value={report.date} onChange={(event) => update("date", event.target.value)} /></div></section>

      <div className="workspace">
        <section className="editor-panel">
          <div className="panel-heading"><div><p className="eyebrow">COMPOSE</p><h2>Your daily report</h2></div><span className="required">* Required fields</span></div>
          <label>Opening note<span className="optional">Optional</span><textarea value={report.greeting} onChange={(event) => update("greeting", event.target.value)} rows={3} /></label>
          <label>Accomplished <span className="required">*</span><textarea value={report.accomplishments} onChange={(event) => update("accomplishments", event.target.value)} rows={9} placeholder="List meetings, projects, and completed tasks..." /><small>Add projects on their own line, for example:<br />SSCC<br />sscc-api<br />sscc-web</small></label>
          <div className="section-label overtime-toggle"><label className="checkbox-label"><input type="checkbox" checked={report.overtimeEnabled} onChange={(event) => update("overtimeEnabled", event.target.checked)} /> <span>Include overtime</span></label><span className="optional">Optional</span></div>
          {report.overtimeEnabled ? <div className="overtime-grid"><label>Time range<input type="text" value={report.overtimeTime} onChange={(event) => update("overtimeTime", event.target.value)} placeholder="6:00pm - 9:00pm" /></label><label>Work completed<textarea value={report.overtime} onChange={(event) => update("overtime", event.target.value)} rows={3} placeholder="Leave blank if none" /></label></div> : <p className="disabled-note">Overtime is hidden from the report.</p>}
          <label>Blockers <span className="required">*</span><textarea value={report.blockers} onChange={(event) => update("blockers", event.target.value)} rows={6} placeholder="None. Or include category, solution, expected date, and status." /><small>Keep unresolved blockers here until the day they are resolved. Categorize as Internal or External.</small></label>
          <label>Notes <span className="required">*</span><textarea value={report.notes} onChange={(event) => update("notes", event.target.value)} rows={4} placeholder="Important updates, leave, or management attention..." /></label>
          <label>Next day tasks <span className="required">*</span><textarea value={report.nextTasks} onChange={(event) => update("nextTasks", event.target.value)} rows={6} placeholder="What will you work on next?" /></label>
          <div className="form-footer"><span className="word-count">{reportText.split(/\s+/).filter(Boolean).length} words</span><div><button className="button button-ghost" onClick={copy}>{copied ? "Copied" : "Copy report"}</button><button className="button button-dark" onClick={save}>{saved ? "Saved" : "Save report"}</button></div></div>
        </section>

        <aside className="preview-panel"><div className="preview-heading"><div><p className="eyebrow">LIVE PREVIEW</p><h2>Ready to send</h2></div><span className="preview-pill">A4</span></div><article className="paper"><h3>{subject}</h3><div className="paper-content"><p>{report.greeting}</p><ReportSection title="Accomplished" value={report.accomplishments} />{report.overtimeEnabled ? <ReportSection title={`Accomplished - OT [${report.overtimeTime}]`} value={report.overtime || "None"} /> : null}<ReportSection title="Blockers" value={report.blockers} /><ReportSection title="Notes" value={report.notes} /><ReportSection title="Next Day Tasks" value={report.nextTasks} /><p className="closing">Thank you!</p></div></article><button className="send-hint" onClick={copy}><span className="send-icon">↗</span><span><strong>Copy a polished version</strong><small>Paste it into email or your team chat</small></span><span className="arrow">→</span></button><ActivityLog rows={activityRows} date={report.date} copied={activityCopied} onCopy={copyActivityLog} /></aside>
      </div>
    </main>
  );
}

function persistReport(report: Report) {
  window.localStorage.setItem("daily-report", JSON.stringify(report));
}

function ReportSection({ title, value, muted = false }: { title: string; value: string; muted?: boolean }) {
  return <section className={`paper-section ${muted ? "muted" : ""}`}><h4>{title}</h4><PreviewNodes nodes={buildReportNodes(title, value)} isOvertime={title.startsWith("Accomplished - OT")} /></section>;
}

function PreviewNodes({ nodes, isOvertime, parentLevel = 0 }: { nodes: ReportNode[]; isOvertime: boolean; parentLevel?: number }) {
  const listType = isOvertime ? ["1", "a", "i", "1"][parentLevel] : ["1", "circle", "i", "1", "a"][parentLevel];
  const List = listType === "circle" ? "ul" : "ol";
  const type = listType === "circle" ? undefined : listType as "1" | "a" | "i";
  return <List {...(type ? { type } : {})} className="paper-list">{nodes.map((node, index) => <li className={isReportHeading(node.text) ? "paper-list-heading" : ""} key={`${node.text}-${index}`}>{node.text}{node.children.length ? <PreviewNodes nodes={node.children} isOvertime={isOvertime} parentLevel={node.level + 1} /> : null}</li>)}</List>;
}

function ActivityLog({ rows, date, copied, onCopy }: { rows: ActivityRow[]; date: string; copied: boolean; onCopy: () => void }) {
  const totalHours = rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
  return <section className="activity-card"><div className="activity-heading"><div><p className="eyebrow">DAILY ACTIVITY LOG</p><h3>Excel-ready rows</h3></div><button className="button button-ghost" onClick={onCopy}>{copied ? "Copied" : "Copy for Excel"}</button></div><p className="activity-note">Projects are grouped like your Excel log. The date appears once as the column header; meeting hours stay blank.</p><div className="activity-table"><div className="activity-row activity-header"><span>Project</span><span>Task</span><span>{formatShortDate(date)}</span></div>{rows.slice(0, 8).map((row, index) => <div className="activity-row" key={`${row.task}-${index}`}><span>{index === 0 || rows[index - 1].project !== row.project ? row.project : ""}</span><span>{row.task}</span><span>{row.hours}</span></div>)}</div><small className="activity-total">Generated task total: {totalHours} hrs</small>{rows.length > 8 ? <small className="activity-more">+ {rows.length - 8} more rows included when copied</small> : null}</section>;
}

function buildActivityRows(value: string, maxHours?: number): ActivityRow[] {
  const rows: ActivityRow[] = [];
  let project = "General";
  let meetings = false;
  let taskIndex = 0;
  const taskRows: number[] = [];
  value.split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
    if (line === "Meetings Attended:") { meetings = true; return; }
    if (isProjectRoot(line)) { meetings = false; project = line.replace(/:$/, ""); return; }
    if (isSubProject(line) || line === "Database:") { project = line.replace(":", ""); return; }
    if (line === "Social Work Module") return;
    const isMeeting = meetings;
    if (isMeeting) rows.push({ project: "General", task: line, hours: "" });
    else {
      rows.push({ project, task: line, hours: "" });
      taskRows.push(rows.length - 1);
      taskIndex += 1;
    }
  });
  if (maxHours === undefined) {
    taskRows.forEach((rowIndex, index) => { rows[rowIndex].hours = String([0.5, 1, 1.5, 2][index % 4]); });
  } else {
    distributeHours(taskRows.length, maxHours).forEach((hours, index) => { rows[taskRows[index]].hours = hours ? String(hours) : ""; });
  }
  return rows;
}

function distributeHours(count: number, total: number) {
  if (!count) return [];
  const totalUnits = Math.round(total * 2);
  const activeCount = Math.min(count, totalUnits);
  const hours = Array.from({ length: count }, () => 0);
  for (let index = 0; index < activeCount; index += 1) hours[index] = 1;
  let remainingUnits = totalUnits - activeCount;
  let seed = count * 97 + totalUnits * 13;
  for (let index = 0; index < activeCount - 1; index += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const extraUnits = index === activeCount - 2 ? remainingUnits : Math.floor((seed / 233280) * (remainingUnits + 1));
    hours[index] += extraUnits;
    remainingUnits -= extraUnits;
  }
  if (activeCount) hours[activeCount - 1] += remainingUnits;
  return hours.map((units) => units / 2);
}

function buildActivityText(rows: ActivityRow[], date: string) {
  return [["Project", "Task", formatShortDate(date)], ...rows.map((row, index) => [index === 0 || rows[index - 1].project !== row.project ? row.project : "", row.task, row.hours])].map((row) => row.join("\t")).join("\n");
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

function buildReportHtml(report: Report, subject: string) {
  const section = (title: string, value: string) => `<h3 style="color:#2e674f;font-size:14px;font-weight:400;margin:24px 0 8px">${escapeHtml(title)}</h3>${buildNestedListHtml(title, value)}`;
  return `<div style="font-family:Arial,sans-serif;color:#17211d;line-height:1.5"><p style="font-size:16px">${escapeHtml(subject)}</p><p>${escapeHtml(report.greeting).replaceAll("\n", "<br>")}</p>${section("Accomplished", report.accomplishments)}${report.overtimeEnabled ? section(`Accomplished - OT [${report.overtimeTime}]`, report.overtime) : ""}${section("Blockers", report.blockers)}${section("Notes", report.notes)}${section("Next Day Tasks", report.nextTasks)}<p style="margin-top:28px">Thank you!</p></div>`;
}

type ReportNode = { text: string; level: number; children: ReportNode[] };

function buildNestedListHtml(title: string, value: string) {
  const isOvertime = title.startsWith("Accomplished - OT");
  const nodes = buildReportNodes(title, value);
  if (!nodes.length) return "<p>None</p>";
  return renderReportNodes(nodes, isOvertime ? 0 : 0, isOvertime);
}

function buildReportNodes(title: string, value: string) {
  const rows = value.split("\n").map((text) => text.trim()).filter(Boolean);
  const nodes: ReportNode[] = [];
  const stack: ReportNode[] = [];
  let meetingsMode = title === "Accomplished";
  rows.forEach((text) => {
    if (isProjectRoot(text)) meetingsMode = false;
    const level = meetingsMode && text !== "Meetings Attended:" ? 1 : reportLevel(text, title, stack.at(-1)?.text);
    const node: ReportNode = { text, level, children: [] };
    while (stack.length && stack.at(-1)!.level >= level) stack.pop();
    if (stack.length) stack.at(-1)!.children.push(node);
    else nodes.push(node);
    stack.push(node);
  });
  return nodes;
}

function buildReportText(report: Report, subject: string) {
  const section = (title: string, value: string) => `${title}\n${value.trim() || "None."}`;
  return [
    subject,
    report.greeting,
    section("Accomplished:", renderPlainReportNodes(buildReportNodes("Accomplished", report.accomplishments), false)),
    report.overtimeEnabled ? section(`Accomplished - OT [${report.overtimeTime}]`, renderPlainReportNodes(buildReportNodes("Accomplished - OT", report.overtime), true)) : "",
    section("Blockers:", report.blockers),
    section("Notes:", report.notes),
    section("Next Day Tasks:", report.nextTasks),
    "Thank you!",
  ].filter(Boolean).join("\n\n");
}

function renderPlainReportNodes(nodes: ReportNode[], isOvertime: boolean, depth = 0): string {
  return nodes.map((node, index) => {
    const topMarker = `${plainMarker(node.level, index, isOvertime)} `;
    const indent = "   ".repeat(node.level);
    const children = node.children.length ? `\n${renderPlainReportNodes(node.children, isOvertime, depth + 1)}` : "";
    return `${indent}${topMarker}${node.text}${children}`;
  }).join("\n");
}

function plainMarker(level: number, index: number, isOvertime: boolean) {
  if (level === 0) return `${index + 1}.`;
  if (!isOvertime && level === 1) return "○";
  if ((isOvertime && level === 1) || (!isOvertime && level === 4)) return `${String.fromCharCode(97 + index)}.`;
  if (level === 2) return `${toRoman(index + 1)}.`;
  if (level === 3) return `${index + 1}.`;
  return "•";
}

function toRoman(value: number) {
  return ([[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]] as [number, string][]).reduce((result, [number, numeral]) => {
    while (value >= number) {
      result += numeral;
      value -= number;
    }
    return result;
  }, "");
}

function reportLevel(text: string, title: string, parent?: string) {
  const isOvertime = title.startsWith("Accomplished - OT");
  if (isProjectRoot(text)) return 0;
  if (isSubProject(text)) return 1;
  const module = text === "Social Work Module";
  const action = /^(Added|Changed|Enforce|Set|Include):?\b/i.test(text) || text === "Database:";
  const topHeading = text === "Meetings Attended:";

  if (isOvertime) {
    if (isActionLine(text) && parent && isSubProject(parent)) return 2;
    if (action) return 2;
    return 3;
  }
  if (topHeading) return 0;
  if (module) return 2;
  if (text.startsWith("Added: route config")) return 2;
  if (isActionLine(text) && parent && isSubProject(parent)) return 2;
  if (action) return 3;
  if (parent === "Meetings Attended:") return 1;
  return 4;
}

function isActionLine(text: string) {
  return /^(Added|Changed|Enforce|Set|Include):?\b/i.test(text) || text === "Database:";
}

function isSubProject(text: string) {
  return /-(api|web)$/i.test(text);
}

function isProjectRoot(text: string) {
  return text !== "Meetings Attended:" && text !== "Database:" && (/^[A-Z0-9][A-Z0-9 &_-]*$/.test(text) || (text.endsWith(":") && !isActionLine(text)));
}

function renderReportNodes(nodes: ReportNode[], parentLevel: number, isOvertime: boolean): string {
  const listType = isOvertime ? ["1", "a", "i", "1"][parentLevel] : ["1", "circle", "i", "1", "a"][parentLevel];
  const tag = listType === "circle" ? "ul" : "ol";
  const type = listType === "circle" ? "" : ` type="${listType}"`;
  return `<${tag}${type} style="margin:0 0 12px;padding-left:28px">${nodes.map((node) => `<li style="margin:0 0 4px">${escapeHtml(node.text)}${node.children.length ? renderReportNodes(node.children, node.level + 1, isOvertime) : ""}</li>`).join("")}</${tag}>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function isHeading(line: string) {
  return line.trim().endsWith(":") || isSubProject(line) || line === "Social Work Module";
}

function isReportHeading(line: string) {
  return isHeading(line);
}
