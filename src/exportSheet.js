// Builds a nicely designed spreadsheet (.xlsx) of your Monee data:
//   1. A title ("Tsar's Expenses") on a navy bar
//   2. Insights: this month vs all time, where your money went, your accounts, your streak
//   3. Every entry, newest first
// It uses the Lexend font and Monee's colours, and opens in Google Sheets or Excel.
//
// How: an .xlsx file is really a zip folder with a few XML (text) files inside.
// We write those XML files ourselves and zip them with the small "fflate" library,
// so this works the same on the website and on phones.
import { Platform } from 'react-native';
import { strToU8, zipSync } from 'fflate';
import { showAlert } from './dialog';
import { CATEGORY_COLORS, FULL_MONTHS } from './constants';
import { accountBalances, dailyStreak, kindLabel } from './money';
import { daysInMonth, fmtDate, formatRp, inMonth, isoDay } from './utils';

// Monee's palette (same as styles.js), written the way Excel wants colours: AARRGGBB
const COLOR = {
  navy: 'FF1E3260',
  teal: 'FF3A7F99',
  sky: 'FF89BBD6',
  yellow: 'FFF9DC7E',
  yellowSoft: 'FFFDF3D2',
  skySoft: 'FFE3EFF6',
  bg: 'FFEDF4F8',
  text: 'FF1A2540',
  muted: 'FF6B7A90',
  border: 'FFE1E8EF',
  in: 'FF2E8B6E',
  out: 'FFD9534F',
  white: 'FFFFFFFF',
};
const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase();
const FONT = 'Lexend';

/* ---------- Styles ---------- */
// Each cell style is a mix of a font, a fill (background), a border and a number format.
// Excel stores each of those in a list and each style points to them by number, so we keep lists here.
function makeStyles() {
  const fonts = [];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const numFmts = []; // custom number formats start at id 164
  const xfs = [];
  const seen = {};

  const indexOf = (list, xml) => {
    let i = list.indexOf(xml);
    if (i < 0) i = list.push(xml) - 1;
    return i;
  };

  // style({ size, bold, color, fill, border, fmt, align, wrap }) → style number for a cell
  function style({ size = 11, bold = false, italic = false, color = COLOR.text, fill, border, fmt, align, valign = 'center', wrap = false, indent = 0 } = {}) {
    const key = JSON.stringify(arguments[0] || {});
    if (seen[key] != null) return seen[key];
    const font = indexOf(
      fonts,
      `<font>${bold ? '<b/>' : ''}${italic ? '<i/>' : ''}<sz val="${size}"/><color rgb="${color}"/><name val="${FONT}"/></font>`
    );
    const fillId = fill ? indexOf(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const borderId = border
      ? indexOf(borders, `<border><left/><right/><top/><bottom style="${border.style || 'thin'}"><color rgb="${border.color}"/></bottom><diagonal/></border>`)
      : 0;
    let numFmtId = 0;
    if (fmt === 'percent') numFmtId = 9;
    else if (fmt) {
      const i = indexOf(numFmts, fmt);
      numFmtId = 164 + i;
    }
    const alignment = `<alignment vertical="${valign}"${align ? ` horizontal="${align}"` : ''}${wrap ? ' wrapText="1"' : ''}${indent ? ` indent="${indent}"` : ''}/>`;
    xfs.push(
      `<xf numFmtId="${numFmtId}" fontId="${font}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmtId ? ' applyNumberFormat="1"' : ''}>${alignment}</xf>`
    );
    seen[key] = xfs.length - 1;
    return seen[key];
  }

  style({}); // style 0 = normal text in Lexend

  const xml = () =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="${numFmts.length}">${numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>
<fonts count="${fonts.length}">${fonts.join('')}</fonts>
<fills count="${fills.length}">${fills.join('')}</fills>
<borders count="${borders.length}">${borders.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  return { style, xml };
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // characters that aren't allowed in XML at all
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const COLS = 'ABCDEFGH';
// Excel counts days from 30 Dec 1899
const excelDate = (d) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;

/* ---------- The sheet ---------- */
function buildSheet(data, name) {
  const S = makeStyles();
  const RP = '"Rp "#,##0;-"Rp "#,##0';
  const st = {
    title: S.style({ size: 22, bold: true, color: COLOR.white, fill: COLOR.navy, indent: 1 }),
    titleBar: S.style({ fill: COLOR.navy }),
    subtitle: S.style({ size: 10, color: COLOR.sky, fill: COLOR.navy, indent: 1 }),
    section: S.style({ size: 14, bold: true, color: COLOR.navy, border: { color: COLOR.teal, style: 'medium' } }),
    sectionLine: S.style({ border: { color: COLOR.teal, style: 'medium' } }),
    colHead: S.style({ size: 10, bold: true, color: COLOR.white, fill: COLOR.teal, align: 'left', indent: 1 }),
    colHeadRight: S.style({ size: 10, bold: true, color: COLOR.white, fill: COLOR.teal, align: 'right' }),
    label: S.style({ size: 11, color: COLOR.muted, border: { color: COLOR.border } }),
    side: S.style({ size: 10, color: COLOR.muted, indent: 1 }),
    money: S.style({ size: 11, bold: true, fmt: RP, border: { color: COLOR.border } }),
    moneyIn: S.style({ size: 11, bold: true, color: COLOR.in, fmt: RP, border: { color: COLOR.border } }),
    moneyOut: S.style({ size: 11, bold: true, color: COLOR.out, fmt: RP, border: { color: COLOR.border } }),
    keptLabel: S.style({ size: 11, bold: true, color: COLOR.navy, fill: COLOR.yellowSoft }),
    kept: S.style({ size: 13, bold: true, color: COLOR.navy, fill: COLOR.yellowSoft, fmt: RP }),
    text: S.style({ size: 11, border: { color: COLOR.border } }),
    textBold: S.style({ size: 11, bold: true, border: { color: COLOR.border } }),
    percent: S.style({ size: 11, color: COLOR.muted, fmt: 'percent', border: { color: COLOR.border } }),
    note: S.style({ size: 9, italic: true, color: COLOR.muted }),
  };
  // Entry rows: every other row gets a light blue background (easier to read across)
  const row = (zebra) => {
    const fill = zebra ? COLOR.bg : undefined;
    const b = { color: COLOR.border };
    return {
      date: S.style({ size: 10, fmt: 'd mmm yyyy', fill, border: b, align: 'left', indent: 1 }),
      text: S.style({ size: 10, fill, border: b }),
      wrap: S.style({ size: 10, fill, border: b, wrap: true }),
      in: S.style({ size: 10, color: COLOR.in, fill, border: b }),
      out: S.style({ size: 10, color: COLOR.out, fill, border: b }),
      amountIn: S.style({ size: 10, bold: true, color: COLOR.in, fmt: RP, fill, border: b }),
      amountOut: S.style({ size: 10, bold: true, color: COLOR.text, fmt: RP, fill, border: b }),
    };
  };
  const rows = [row(false), row(true)];
  const catStyle = (cat) =>
    S.style({ size: 11, bold: true, color: COLOR.navy, fill: argb(CATEGORY_COLORS[cat] || '#B8C4CF'), indent: 1, border: { color: COLOR.white } });

  // ---------- Cells ----------
  const lines = []; // one entry per row: { r, cells: [ { c, v, s, type } ], ht }
  const merges = [];
  let r = 0;
  const put = (cells, ht) => {
    r += 1;
    lines.push({ r, cells, ht });
    return r;
  };
  const blank = (ht) => put([], ht);
  const str = (c, v, s) => ({ c, v, s, type: 's' });
  const num = (c, v, s) => ({ c, v, s, type: 'n' });
  const fillRow = (s) => [...COLS].map((c) => str(c, '', s));

  // ---------- Numbers ----------
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const tx = data.transactions; // newest first
  const sum = (list, type) => list.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const month = tx.filter((t) => inMonth(t.date, y, m));
  const all = { inc: sum(tx, 'income'), out: sum(tx, 'expense') };
  const mon = { inc: sum(month, 'income'), out: sum(month, 'expense') };
  const daysSoFar = now.getDate();
  const spendDays = new Set(month.filter((t) => t.type === 'expense').map((t) => new Date(t.date).getDate()));
  const biggest = month.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0];
  const cats = {};
  month.filter((t) => t.type === 'expense').forEach((t) => (cats[t.category] = (cats[t.category] || 0) + t.amount));
  const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const balances = accountBalances(data);
  const streak = dailyStreak(data);
  const accName = (id, fallback) => data.accounts.find((a) => a.id === id)?.name || fallback || '';

  // ---------- Title ----------
  const titleRow = put([str('A', `${name ? `${name}’s` : 'My'} Expenses`, st.title), ...fillRow(st.titleBar).slice(1)], 44);
  merges.push(`A${titleRow}:H${titleRow}`);
  const subRow = put(
    [str('A', `Exported from Monee on ${fmtDate(now)}  ·  ${tx.length} entries`, st.subtitle), ...fillRow(st.titleBar).slice(1)],
    22
  );
  merges.push(`A${subRow}:H${subRow}`);
  blank(14);

  // ---------- Insights: summary ----------
  const section = (title) => put([str('A', title, st.section), ...[...'BCDEFGH'].map((c) => str(c, '', st.sectionLine))], 26);
  section('Insights');
  const insightsTop = r + 1; // the chart sits to the right of these rows
  put([str('A', '', st.colHead), str('B', `${FULL_MONTHS[m]} ${y}`, st.colHeadRight), str('C', 'All time', st.colHeadRight)], 20);
  put([str('A', 'Money in', st.label), num('B', mon.inc, st.moneyIn), num('C', all.inc, st.moneyIn)]);
  put([str('A', 'Money out', st.label), num('B', mon.out, st.moneyOut), num('C', all.out, st.moneyOut)]);
  put([str('A', 'You kept', st.keptLabel), num('B', mon.inc - mon.out, st.kept), num('C', all.inc - all.out, st.kept)], 24);
  blank(8);
  put([str('A', 'Average spent per day', st.label), num('B', daysSoFar ? Math.round(mon.out / daysSoFar) : 0, st.money)]);
  put([str('A', 'Days with no spending', st.label), num('B', Math.max(0, daysSoFar - spendDays.size), st.textBold)]);
  put([str('A', 'Streak (days within budget)', st.label), num('B', streak.current, st.textBold), str('C', `best: ${streak.best} days`, st.side)]);
  if (data.profile.monthlyBudget > 0) {
    put([
      str('A', 'Monthly budget', st.label),
      num('B', data.profile.monthlyBudget, st.money),
      str('C', mon.out <= data.profile.monthlyBudget ? 'on track' : 'over budget', st.side),
    ]);
  }
  if (biggest) {
    put([
      str('A', 'Biggest expense', st.label),
      num('B', biggest.amount, st.moneyOut),
      str('C', biggest.store || biggest.note || biggest.category, st.side),
    ]);
  }
  put([str('A', `Days left in ${FULL_MONTHS[m]}`, st.label), num('B', daysInMonth(y, m) - daysSoFar + 1, st.textBold)]);
  const insightsEnd = r;
  blank(14);

  // ---------- Where your money went ----------
  section(`Where your money went · ${FULL_MONTHS[m]}`);
  put([str('A', 'Category', st.colHead), str('B', 'Spent', st.colHeadRight), str('C', 'Share', st.colHeadRight)], 20);
  if (!catList.length) put([str('A', 'No spending yet this month', st.note)]);
  const catFirst = r + 1; // the pie chart reads its numbers from these rows
  catList.forEach(([cat, amt]) =>
    put([str('A', cat, catStyle(cat)), num('B', amt, st.money), num('C', mon.out ? amt / mon.out : 0, st.percent)])
  );
  blank(14);

  // ---------- Accounts ----------
  section('Your accounts');
  put([str('A', 'Account', st.colHead), str('B', 'Available', st.colHeadRight), str('C', 'Saved for goals', st.colHeadRight), str('D', 'Type', st.colHead)], 20);
  data.accounts.forEach((a) => {
    const b = balances.byId[a.id] || { available: 0, saved: 0 };
    put([
      str('A', a.name + (a.id === data.mainAccountId ? '  (main)' : ''), st.textBold),
      num('B', b.available, st.money),
      num('C', b.saved, st.money),
      str('D', kindLabel(a.kind), st.label),
    ]);
  });
  blank(14);

  // ---------- Every entry ----------
  section('All entries');
  const heads = ['Date', 'Type', 'Category', 'Account', 'Store', 'Note', 'Items', 'Amount'];
  const headRow = put(heads.map((h, i) => str(COLS[i], h, i === 7 ? st.colHeadRight : st.colHead)), 22);
  tx.forEach((t, i) => {
    const s = rows[i % 2];
    const isIn = t.type === 'income';
    put([
      num('A', excelDate(new Date(t.date)), s.date),
      str('B', isIn ? 'Money in' : 'Money out', isIn ? s.in : s.out),
      str('C', t.category, s.text),
      str('D', accName(t.accountId, t.wallet), s.text),
      str('E', t.store, s.text),
      str('F', t.note, s.wrap),
      str('G', (t.items || []).map((it) => `${it.name} (${formatRp(it.price)})`).join(', '), s.wrap),
      num('H', isIn ? t.amount : -t.amount, isIn ? s.amountIn : s.amountOut),
    ]);
  });
  if (!tx.length) put([str('A', 'No entries yet', st.note)]);
  const lastRow = r;

  // ---------- Sheet XML ----------
  const widths = [26, 18, 18, 16, 22, 28, 36, 18];
  const cellXml = ({ c, v, s, type }, rowNum) =>
    type === 'n'
      ? `<c r="${c}${rowNum}" s="${s}"><v>${Number(v) || 0}</v></c>`
      : v === ''
        ? `<c r="${c}${rowNum}" s="${s}"/>`
        : `<c r="${c}${rowNum}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><tabColor rgb="${COLOR.teal}"/><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${lines
    .map(
      (l) =>
        `<row r="${l.r}"${l.ht ? ` ht="${l.ht}" customHeight="1"` : ''}>${l.cells.map((cell) => cellXml(cell, l.r)).join('')}</row>`
    )
    .join('')}</sheetData>
${tx.length ? `<autoFilter ref="A${headRow}:H${lastRow}"/>` : ''}
<mergeCells count="${merges.length}">${merges.map((m2) => `<mergeCell ref="${m2}"/>`).join('')}</mergeCells>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
${catList.length ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`;

  const chart = catList.length
    ? { cats: catList, first: catFirst, last: catFirst + catList.length - 1, top: insightsTop, end: insightsEnd, month: FULL_MONTHS[m] }
    : null;
  return { sheet, styles: S.xml(), headRow, lastRow, hasEntries: tx.length > 0, chart };
}

/* ---------- The pie (doughnut) chart ---------- */
// Excel and Google Sheets draw it themselves from the category rows, using these colours.
const hex6 = (c) => c.replace('#', '').toUpperCase();
const lexend = (sz, color, bold = false) =>
  `<a:defRPr sz="${sz}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr>`;
const txPr = (sz, color, bold) =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${lexend(sz, color, bold)}</a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;

function chartXml({ cats, first, last, month }) {
  const white = '<a:ln w="25400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>';
  const points = cats
    .map(
      ([cat], i) =>
        `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${hex6(CATEGORY_COLORS[cat] || '#B8C4CF')}"/></a:solidFill>${white}</c:spPr></c:dPt>`
    )
    .join('');
  const catCache = cats.map(([cat], i) => `<c:pt idx="${i}"><c:v>${esc(cat)}</c:v></c:pt>`).join('');
  const valCache = cats.map(([, amt], i) => `<c:pt idx="${i}"><c:v>${amt}</c:v></c:pt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:roundedCorners val="0"/>
<c:chart>
<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${lexend(1200, '1E3260', true)}</a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1"><a:solidFill><a:srgbClr val="1E3260"/></a:solidFill><a:latin typeface="${FONT}"/></a:rPr><a:t>Where your money went · ${esc(month)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
<c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/>
<c:doughnutChart><c:varyColors val="1"/>
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Spent</c:v></c:tx>
<c:spPr>${white}</c:spPr>
${points}
<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, '1E3260', true)}<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>
<c:cat><c:strRef><c:f>Monee!$A$${first}:$A$${last}</c:f><c:strCache><c:ptCount val="${cats.length}"/>${catCache}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>Monee!$B$${first}:$B$${last}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${cats.length}"/>${valCache}</c:numCache></c:numRef></c:val>
</c:ser>
<c:firstSliceAng val="0"/><c:holeSize val="55"/>
</c:doughnutChart>
<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>
</c:plotArea>
<c:legend><c:legendPos val="r"/><c:overlay val="0"/>${txPr(1000, '1A2540')}</c:legend>
<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>
</c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
${txPr(1000, '1A2540')}
</c:chartSpace>`;
}

// Where the chart sits: to the right of the Insights table (columns D to G)
function drawingXml({ top, end }) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>3</xdr:col><xdr:colOff>228600</xdr:colOff><xdr:row>${top - 1}</xdr:row><xdr:rowOff>63500</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${end}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Where your money went"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>
</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>
</xdr:wsDr>`;
}

const rels = (target, type) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>
</Relationships>`;

export function buildXlsx(data, name) {
  const { sheet, styles, headRow, lastRow, hasEntries, chart } = buildSheet(data, name);
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${chart ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` : ''}
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Monee" sheetId="1" r:id="rId1"/></sheets>
${hasEntries ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Monee!$A$${headRow}:$H$${lastRow}</definedName></definedNames>` : ''}
</workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': sheet,
  };
  if (chart) {
    files['xl/worksheets/_rels/sheet1.xml.rels'] = rels('../drawings/drawing1.xml', 'drawing');
    files['xl/drawings/drawing1.xml'] = drawingXml(chart);
    files['xl/drawings/_rels/drawing1.xml.rels'] = rels('../charts/chart1.xml', 'chart');
    files['xl/charts/chart1.xml'] = chartXml(chart);
  }
  const zipped = {};
  Object.entries(files).forEach(([path, text]) => (zipped[path] = strToU8(text)));
  return zipSync(zipped, { level: 6 });
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Makes the file and downloads it (website) or opens the share menu (phone)
export async function exportSpreadsheet(data, name) {
  if (!data.transactions.length) {
    showAlert('Nothing to export yet', 'Add a few entries first.');
    return;
  }
  const bytes = buildXlsx(data, name);
  const fileName = `monee-${isoDay(new Date())}.xlsx`;

  if (Platform.OS === 'web') {
    const blob = new Blob([bytes], { type: XLSX_TYPE });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return;
  }

  try {
    // Loaded only on phones (these packages don't work in a browser)
    const Sharing = require('expo-sharing');
    const { File, Paths } = require('expo-file-system');
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    await Sharing.shareAsync(file.uri, {
      mimeType: XLSX_TYPE,
      dialogTitle: 'Export Monee data',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  } catch (e) {
    showAlert('Couldn’t export', e.message);
  }
}
