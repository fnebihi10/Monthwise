import ExcelJS from 'exceljs';
import type { Snapshot } from './models';
const currency = '"\u20ac"#,##0.00;[Red]-"\u20ac"#,##0.00';
const orange = 'FFB4472C',
  paper = 'FFF4F1E9',
  ink = 'FF292A24';
function header(sheet: ExcelJS.Worksheet, row: number) {
  sheet.getRow(row).height = 36;
  sheet.getRow(row).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orange } };
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}
function setup(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.columns = widths.map((width) => ({ width }));
  sheet.properties.defaultRowHeight = 23;
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}
function body(sheet: ExcelJS.Worksheet, row: number) {
  const r = sheet.getRow(row);
  r.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Calibri', size: 11, color: { argb: ink } };
    cell.alignment = { vertical: 'top', wrapText: true };
    if (row % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: paper } };
  });
  const longest = Math.max(
    ...(r.values instanceof Array
      ? r.values.map((v) => (typeof v === 'string' ? v.length : 0))
      : [0]),
  );
  r.height = Math.min(105, Math.max(25, Math.ceil(longest / 32) * 15));
}
export async function excelWorkbook(data: Snapshot) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Monthwise';
  book.created = new Date();
  const summary = book.addWorksheet('Monthly summary');
  setup(summary, [22, 22, 22, 24]);
  summary.addRow(['MONTHWISE', 'Income', 'Expenses', 'Income minus expenses']);
  header(summary, 1);
  const months = [...new Set(data.entries.map((e) => e.date.slice(0, 7)))].sort();
  for (const month of months) {
    let income = 0,
      expenses = 0;
    for (const e of data.entries.filter((e) => e.date.startsWith(month + '-'))) {
      if (e.kind === 'income') income += e.amountCents;
      else expenses += e.amountCents;
    }
    const row = summary.addRow([month, income / 100, expenses / 100, (income - expenses) / 100]);
    body(summary, row.number);
  }
  const income = data.entries
      .filter((e) => e.kind === 'income')
      .reduce((n, e) => n + e.amountCents, 0),
    expenses = data.entries
      .filter((e) => e.kind === 'expense')
      .reduce((n, e) => n + e.amountCents, 0);
  const totals = summary.addRow([
    'ALL RECORDED MONTHS',
    income / 100,
    expenses / 100,
    (income - expenses) / 100,
  ]);
  header(summary, totals.number);
  for (const n of [2, 3, 4]) summary.getColumn(n).numFmt = currency;
  summary.addRow([]);
  summary.addRow(['Income minus expenses is not your account balance.']);
  summary.mergeCells('A' + summary.rowCount + ':D' + summary.rowCount);
  summary.addRow(['Opening balances and transfers are excluded from monthly income and expenses.']);
  summary.mergeCells('A' + summary.rowCount + ':D' + summary.rowCount);
  summary.addRow([
    'All recorded transactions are included; this file is a report, not a restorable backup.',
  ]);
  summary.mergeCells('A' + summary.rowCount + ':D' + summary.rowCount);
  const entries = book.addWorksheet('Transactions');
  setup(entries, [16, 14, 28, 38, 23, 20, 54]);
  entries.addRow(['Date', 'Type', 'Account', 'Name / place', 'Category', 'Amount (EUR)', 'Note']);
  header(entries, 1);
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  for (const e of [...data.entries].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  )) {
    const row = entries.addRow([
      new Date(e.date + 'T00:00:00.000Z'),
      e.kind === 'income' ? 'Income' : 'Expense',
      accounts.get(e.accountId) || '',
      e.merchant,
      e.category,
      e.amountCents / 100,
      e.note,
    ]);
    body(entries, row.number);
    row.getCell(1).numFmt = 'dd mmm yyyy';
    row.getCell(6).numFmt = currency;
    row.getCell(6).font = {
      name: 'Calibri',
      color: { argb: e.kind === 'income' ? 'FF586044' : orange },
    };
  }
  entries.autoFilter = { from: 'A1', to: 'G' + Math.max(1, entries.rowCount) };
  const balances = book.addWorksheet('Accounts');
  setup(balances, [32, 16, 24, 24]);
  balances.addRow(['Account', 'Type', 'Opening balance', 'Current balance']);
  header(balances, 1);
  for (const a of data.accounts) {
    const r = balances.addRow([a.name, a.kind, a.openingBalanceCents / 100, a.balanceCents / 100]);
    body(balances, r.number);
    r.getCell(3).numFmt = currency;
    r.getCell(4).numFmt = currency;
  }
  return book;
}
export async function exportExcel(data: Snapshot) {
  const workbook = await excelWorkbook(data);
  const bytes = await workbook.xlsx.writeBuffer();
  const { download } = await import('./download');
  download(
    'monthwise-report-' + new Date().toISOString().slice(0, 10) + '.xlsx',
    new Uint8Array(bytes).buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
