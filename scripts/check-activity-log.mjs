import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { updateActivityLog } from "../app/lib/mail.ts";

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("November 2026");
sheet.getCell("A4").value = "Project";
sheet.getCell("B4").value = "Task";
sheet.getCell("C4").value = "11/11/2026";
sheet.getCell("A5").value = "General";
sheet.getCell("B5").value = "Old meeting";
sheet.getCell("C5").value = 0.5;
sheet.getCell("C22").value = { formula: "SUM(C5:C15)", result: 0.5 };
sheet.getCell("A23").value = "below block";

const rows = [{ project: "General", task: "Daily Meeting", hours: "0.5" }, { project: "SSCC", task: "Activity log", hours: "7.5" }];
const read = async (buffer) => { const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer); return book.worksheets[0]; };

const once = await updateActivityLog(Buffer.from(await workbook.xlsx.writeBuffer()), "2026-11-12", rows);
let result = await read(once);
assert.equal(result.getCell("C4").text, "11/12/2026");
assert.equal(result.getCell("A6").text, "SSCC");
assert.equal(result.getCell("C6").value, 7.5);
assert.equal(result.getCell("C22").value.formula, "SUM(C5:C21)");
assert.equal(result.getCell("G4").text, "11/11/2026");
assert.equal(result.getCell("F5").text, "Old meeting");
assert.equal(result.getCell("G22").value.formula, "SUM(G5:G15)");
assert.equal(result.getCell("A23").text, "below block");

result = await read(await updateActivityLog(once, "2026-11-12", rows));
assert.equal(result.getCell("K4").text, "", "same-day resend must not shift again");
assert.equal(result.getCell("G4").text, "11/11/2026");

result = await read(await updateActivityLog(once, "2026-11-11", [{ project: "AWWA", task: "Edited old day", hours: "8" }]));
assert.equal(result.getCell("C4").text, "11/12/2026", "editing an existing date must not insert a block");
assert.equal(result.getCell("E5").text, "AWWA");
assert.equal(result.getCell("F5").text, "Edited old day");
assert.equal(result.getCell("G22").value.formula, "SUM(G5:G21)");
assert.equal(result.getCell("K4").text, "");

console.log("activity log check passed");
