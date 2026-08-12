/**
 * app.js — точка входа UI.
 * Вся логика UI (обработчики событий, рендер таблицы, экспорт)
 */

import './styles.css';
import Loan             from './models/Loan.js';
import GracePeriod     from './models/GracePeriod.js';
import LoanCalculator  from './services/LoanCalculator.js';
import APRCalculator   from './math/APRCalculator.js';
import { APR }         from './core/Constants.js';
import KazakhstanCalendar from './calendar/KazakhstanCalendar.js';
import { CalendarMode } from './core/CalendarMode.js';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const els = {
    principal:         document.getElementById('principal'),
    annualRate:        document.getElementById('annualRate'),
    term:              document.getElementById('term'),
    issueDate:         document.getElementById('issueDate'),
    firstPaymentDate:  document.getElementById('firstPaymentDate'),
    lastPaymentDate:   document.getElementById('lastPaymentDate'),
    paymentMethod:     document.getElementById('paymentMethod'),
    distributionMode:  document.getElementById('distributionMode'),
    upfrontFee:        document.getElementById('upfrontFee'),
    calendarMode:      document.getElementById('calendarMode'),
    calendarModeBadge: document.getElementById('calendarModeBadge'),
    modeSimpleBtn:     document.getElementById('modeSimpleBtn'),
    modeManualBtn:     document.getElementById('modeManualBtn'),
    simplePanel:       document.getElementById('simplePanel'),
    manualPanel:       document.getElementById('manualPanel'),
    simpleMonths:      document.getElementById('simpleMonths'),
    simpleOd:          document.getElementById('simpleOd'),
    simplePct:         document.getElementById('simplePct'),
    applySimpleBtn:    document.getElementById('applySimpleBtn'),
    clearSimpleBtn:    document.getElementById('clearSimpleBtn'),
    fillManualBtn:     document.getElementById('fillManualBtn'),
    clearManualBtn:    document.getElementById('clearManualBtn'),
    manualRows:        document.getElementById('manualRows'),
    calcBtn:           document.getElementById('calcBtn'),
    exportBtn:         document.getElementById('exportBtn'),
    recalcBtn:         document.getElementById('recalcBtn'),
    errorBox:          document.getElementById('errorBox'),
    scheduleBody:      document.querySelector('#scheduleTable tbody'),
    summary:           document.getElementById('summary'),
    editHint:          document.getElementById('editHint')
};

// ─── State ───────────────────────────────────────────────────────────────────
let currentMode  = 'simple';
let lastResult   = null;
let manualEdits  = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function num(v)        { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v)        { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }); }
function fmtPct(v)     { return Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %'; }
function formatDate(d) {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}
function isoDate(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function addMonthsSafe(dateValue, n) {
    const d = new Date(dateValue), day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0);
    return d;
}

function getCalendar() {
    const mode = els.calendarMode ? els.calendarMode.value : CalendarMode.COLVIR;
    return new KazakhstanCalendar(mode);
}

function updateCalendarBadge() {
    if (!els.calendarModeBadge) return;
    const mode = els.calendarMode ? els.calendarMode.value : CalendarMode.COLVIR;
    if (mode === CalendarMode.ACTUAL) {
        els.calendarModeBadge.textContent = 'По постановлениям';
        els.calendarModeBadge.className = 'calendar-mode-badge actual';
    } else {
        els.calendarModeBadge.textContent = 'Как в Colvir';
        els.calendarModeBadge.className = 'calendar-mode-badge';
    }
}

// ─── Mode tabs ───────────────────────────────────────────────────────────────
function setMode(mode) {
    currentMode = mode;
    els.modeSimpleBtn.classList.toggle('active', mode === 'simple');
    els.modeManualBtn.classList.toggle('active',  mode === 'manual');
    els.simplePanel.classList.toggle('active',    mode === 'simple');
    els.manualPanel.classList.toggle('active',    mode === 'manual');
}

// ─── Manual rows ─────────────────────────────────────────────────────────────
function clearManualRows() { els.manualRows.innerHTML = ''; }

function createMonthRow(period, paymentDate, odChecked = false, pctChecked = false) {
    const row = document.createElement('div');
    row.className = 'month-row';
    row.dataset.period = String(period);
    row.innerHTML = `
        <div class="period">${period}</div>
        <div class="date">${formatDate(paymentDate)}</div>
        <div class="check-wrap"><input type="checkbox" class="m-od"  ${odChecked  ? 'checked' : ''}></div>
        <div class="check-wrap"><input type="checkbox" class="m-pct" ${pctChecked ? 'checked' : ''}></div>
    `;
    return row;
}

function buildManualRows() {
    clearManualRows();
    const term     = parseInt(els.term.value, 10) || 0;
    const calendar = getCalendar();
    for (let p = 1; p <= term; p++) {
        const planned     = addMonthsSafe(els.firstPaymentDate.value, p - 1);
        const paymentDate = calendar.adjustPaymentDate(planned);
        els.manualRows.appendChild(createMonthRow(p, paymentDate, false, false));
    }
}

function applySimpleGrace() {
    clearManualRows();
    const months   = Math.max(1, parseInt(els.simpleMonths.value, 10) || 1);
    const term     = parseInt(els.term.value, 10) || 0;
    const calendar = getCalendar();
    for (let p = 1; p <= Math.min(months, term); p++) {
        const planned     = addMonthsSafe(els.firstPaymentDate.value, p - 1);
        const paymentDate = calendar.adjustPaymentDate(planned);
        els.manualRows.appendChild(createMonthRow(p, paymentDate, els.simpleOd.checked, els.simplePct.checked));
    }
    setMode('manual');
}

function readGracePeriods() {
    const rows = [...els.manualRows.querySelectorAll('.month-row')];
    const periods = [];
    for (const row of rows) {
        const period = Number(row.dataset.period);
        const od  = row.querySelector('.m-od').checked;
        const pct = row.querySelector('.m-pct').checked;
        if (od || pct) {
            periods.push(new GracePeriod({ startPeriod: period, endPeriod: period, odGrace: od, percentGrace: pct }));
        }
    }
    return periods;
}

// ─── Current rows (с учётом ручных правок) ───────────────────────────────────
function getCurrentRows() {
    if (!lastResult) return [];
    return lastResult.schedule.rows.map((row, idx) => {
        const edit = manualEdits[idx] || {};
        const date      = edit.date      !== undefined ? new Date(edit.date)    : new Date(row.paymentDate);
        const principal = edit.principal !== undefined ? Number(edit.principal) : row.principal;
        const interest  = edit.interest  !== undefined ? Number(edit.interest)  : row.interest;
        return { ...row, paymentDate: date, principal, interest,
                 payment: (row.metadata && row.metadata.kind === 'ISSUE') ? 0 : (principal + interest) };
    });
}

// ─── Recalc ГЭСВ ─────────────────────────────────────────────────────────────
function recalcGESV() {
    if (!lastResult) return;
    try {
        const rows = getCurrentRows();
        const issueRow = rows.find(r => r.metadata && r.metadata.kind === 'ISSUE');
        if (!issueRow) return;
        const issueDate  = new Date(issueRow.paymentDate);
        const upfrontFee = num(els.upfrontFee.value);
        const cashFlows  = [{ date: issueDate, amount: -(num(els.principal.value) - upfrontFee) }];
        for (const row of rows) {
            if (row.metadata && row.metadata.kind === 'ISSUE') continue;
            const payment = Number(row.principal || 0) + Number(row.interest || 0);
            if (payment !== 0) cashFlows.push({ date: new Date(row.paymentDate), amount: payment });
        }
        if (upfrontFee > 0) cashFlows.push({ date: issueDate, amount: upfrontFee });
        const apr = APRCalculator.calculate(cashFlows, { basisDays: APR.BASIS_DAYS });
        const totalPrincipal = rows.reduce((s, r) => s + (r.principal || 0), 0);
        const totalInterest  = rows.reduce((s, r) => s + (r.interest  || 0), 0);
        renderSummary({ totalPrincipal, totalInterest, totalPayment: totalPrincipal + totalInterest, rowCount: rows.length }, apr);
    } catch(e) { console.error('recalcGESV error:', e); }
}

// ─── Editable cells ──────────────────────────────────────────────────────────
function makeEditable(td, rowIdx, field, currentValue) {
    td.classList.add('editable');
    td.title = 'Нажмите для редактирования';
    td.addEventListener('click', function() {
        if (td.querySelector('input')) return;
        const isDate = field === 'date';
        const inp = document.createElement('input');
        inp.type = isDate ? 'date' : 'number';
        if (isDate) { inp.value = isoDate(currentValue); }
        else { inp.value = Number(currentValue).toFixed(2); inp.step = '0.01'; }
        td.innerHTML = '';
        td.appendChild(inp);
        inp.focus(); inp.select();
        function commit() {
            if (!manualEdits[rowIdx]) manualEdits[rowIdx] = {};
            let val = inp.value;
            if (!isDate) val = parseFloat(val) || 0;
            manualEdits[rowIdx][field] = val;
            currentValue = val;
            td.innerHTML = isDate ? formatDate(new Date(val)) : fmt(val);
            td.classList.add('edited');
            updateRowTotal(rowIdx);
            els.recalcBtn.style.display = '';
        }
        inp.addEventListener('blur', commit);
        inp.addEventListener('keydown', ev => {
            if (ev.key === 'Enter')  commit();
            if (ev.key === 'Escape') td.innerHTML = isDate ? formatDate(new Date(currentValue)) : fmt(currentValue);
        });
    });
}

function updateRowTotal(rowIdx) {
    const tr = els.scheduleBody.querySelector(`tr[data-row="${rowIdx}"]`);
    if (!tr) return;
    const rows = getCurrentRows();
    const row = rows[rowIdx];
    if (!row || (row.metadata && row.metadata.kind === 'ISSUE')) return;
    const paymentCell = tr.querySelector('.payment-cell');
    if (paymentCell) paymentCell.textContent = fmt(Number(row.principal||0) + Number(row.interest||0));
}

// ─── Summary ─────────────────────────────────────────────────────────────────
function renderSummary(totals, apr) {
    const gesvValue = apr && Number.isFinite(apr.annualPercentRate) ? apr.annualPercentRate : 0;
    els.summary.innerHTML = '';
    const items = [
        { label: 'Общий ОД',       value: fmt(totals.totalPrincipal) },
        { label: 'Общие проценты', value: fmt(totals.totalInterest)  },
        { label: 'Общая сумма',    value: fmt(totals.totalPayment)   },
        { label: 'Строк графика',  value: totals.rowCount            },
        { label: 'ГЭСВ (годовых)', value: fmtPct(gesvValue), gesv: true }
    ];
    for (const item of items) {
        const el = document.createElement('div');
        el.className = 'summary-item' + (item.gesv ? ' gesv' : '');
        el.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value}</div>`;
        els.summary.appendChild(el);
    }
}

// ─── Schedule render ─────────────────────────────────────────────────────────
function renderSchedule(result) {
    const { schedule, apr } = result;
    els.scheduleBody.innerHTML = '';
    manualEdits = {};
    schedule.rows.forEach((row, idx) => {
        const isIssue = row.metadata && row.metadata.kind === 'ISSUE';
        const isGrace = row.rowType === 'GRACE';
        const tr = document.createElement('tr');
        tr.dataset.row = idx;
        if (isGrace) tr.classList.add('grace-row');
        const tdIdx      = document.createElement('td'); tdIdx.className = 'left'; tdIdx.textContent = idx;
        const tdDate     = document.createElement('td'); tdDate.className = 'left'; tdDate.textContent = formatDate(row.paymentDate);
        const tdPayment  = document.createElement('td'); tdPayment.className = 'payment-cell'; tdPayment.textContent = isIssue ? '—' : fmt(row.payment);
        const tdInterest = document.createElement('td'); tdInterest.textContent = isIssue ? '—' : fmt(row.interest);
        const tdPrincipal= document.createElement('td'); tdPrincipal.textContent = isIssue ? '—' : fmt(row.principal);
        const tdBalance  = document.createElement('td'); tdBalance.textContent = fmt(row.closingBalance);
        const tdDays     = document.createElement('td'); tdDays.textContent = row.days;
        const tdType     = document.createElement('td'); tdType.className = 'left'; tdType.textContent = row.rowType || '';
        if (!isIssue) {
            makeEditable(tdDate,      idx, 'date',      row.paymentDate);
            makeEditable(tdPrincipal, idx, 'principal', row.principal);
            makeEditable(tdInterest,  idx, 'interest',  row.interest);
        }
        tr.append(tdIdx, tdDate, tdPayment, tdInterest, tdPrincipal, tdBalance, tdDays, tdType);
        els.scheduleBody.appendChild(tr);
    });
    renderSummary({
        totalPrincipal: schedule.totalPrincipal(),
        totalInterest:  schedule.totalInterest(),
        totalPayment:   schedule.totalPayment(),
        rowCount:       schedule.length
    }, apr);
    els.editHint.style.display = '';
}

// ─── Excel export ─────────────────────────────────────────────────────────────
function exportToExcel() {
    if (!lastResult) { alert('Сначала рассчитайте график.'); return; }
    const rows = getCurrentRows();
    const { apr } = lastResult;
    let gesvFinal = (apr && Number.isFinite(apr.annualPercentRate)) ? apr.annualPercentRate : 0;
    if (Object.keys(manualEdits).length > 0) {
        try {
            const issueDate  = new Date(rows.find(r => r.metadata && r.metadata.kind==='ISSUE').paymentDate);
            const upfrontFee = num(els.upfrontFee.value);
            const cashFlows  = [{ date: issueDate, amount: -(num(els.principal.value) - upfrontFee) }];
            for (const r of rows) {
                if (r.metadata && r.metadata.kind==='ISSUE') continue;
                const p = Number(r.principal||0) + Number(r.interest||0);
                if (p !== 0) cashFlows.push({ date: new Date(r.paymentDate), amount: p });
            }
            if (upfrontFee > 0) cashFlows.push({ date: issueDate, amount: upfrontFee });
            const aprRes = APRCalculator.calculate(cashFlows, { basisDays: APR.BASIS_DAYS });
            if (aprRes && Number.isFinite(aprRes.annualPercentRate)) gesvFinal = aprRes.annualPercentRate;
        } catch(e) {}
    }
    const totalPrincipal = rows.reduce((s,r) => s+(r.principal||0), 0);
    const totalInterest  = rows.reduce((s,r) => s+(r.interest||0),  0);
    const totalPayment   = totalPrincipal + totalInterest;
    const principal      = num(els.principal.value);
    const rate           = num(els.annualRate.value);
    const lastDateStr    = formatDate(new Date(els.lastPaymentDate.value));
    const todayStr       = formatDate(new Date());
    const methodLabel    = { ANNUITY: 'Аннуитет', EQUAL_PRINCIPAL: 'Равные части ОД' };
    const methodText     = methodLabel[els.paymentMethod.value] || els.paymentMethod.value;
    const gesvStr        = gesvFinal.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
    const principalStr   = principal.toLocaleString('ru-RU');

    function dateToExcel(d) {
        const dt = new Date(d);
        return Math.round((dt.getTime() - Date.UTC(1899,11,30)) / 86400000);
    }
    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function cellS(col,row,si,str) { return `<c r="${col}${row}" s="${si}" t="s"><v>${str}</v></c>`; }
    function cellN(col,row,si,n)   { return `<c r="${col}${row}" s="${si}" t="n"><v>${n}</v></c>`; }
    function cellD(col,row,si,d)   { return `<c r="${col}${row}" s="${si}" t="n"><v>${dateToExcel(d)}</v></c>`; }
    function cellEmpty(col,row,si) { return `<c r="${col}${row}" s="${si}"/>`; }

    const strings = []; const ssMap = {};
    function ss(s) { const k=String(s); if(ssMap[k]===undefined){ssMap[k]=strings.length;strings.push(k);} return ssMap[k]; }

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="DD.MM.YYYY"/><numFmt numFmtId="166" formatCode="#,##0.00;[RED]-#,##0.00"/></numFmts>
  <fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><sz val="10"/><name val="Arial"/></font></fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD6E4F0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF999999"/></left><right style="thin"><color rgb="FF999999"/></right><top style="thin"><color rgb="FF999999"/></top><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0"   fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0"   fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="left"/></xf>
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="right"/></xf>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right"/></xf>
  </cellXfs>
</styleSheet>`;

    const cellRows = [];
    const hdr = [
        ['График погашения займа',''],
        ['от '+todayStr,''],
        ['Сумма и валюта займа',`${principalStr} KZT`],
        ['Размер ставки вознаграждения:',`${rate} % годовых`],
        ['Размер ГЭСВ:',`${gesvStr} % годовых`],
        ['Срок займа:',lastDateStr],
        ['Метод погашения:',methodText],
    ];
    hdr.forEach(([label,val],i) => {
        const r=i+1;
        cellRows.push(`<row r="${r}" ht="16">`+cellS('A',r,7,ss(label))+cellS('D',r,8,ss(val))+`</row>`);
    });
    cellRows.push(`<row r="8"/>`);
    const HDR_COLS=['A','B','C','D','E','F'];
    const HDR_LABELS=['Дата платежа','Сумма платежа','Вознаграждение','Основной долг','Остаток ОД','Кол-во дней'];
    cellRows.push(`<row r="9" ht="28">`+HDR_COLS.map((c,i)=>cellS(c,9,1,ss(HDR_LABELS[i]))).join('')+`</row>`);
    rows.forEach((row,idx) => {
        const r=10+idx;
        const isIssue=row.metadata&&row.metadata.kind==='ISSUE';
        const interest=Number(row.interest||0), principal2=Number(row.principal||0);
        const closingBalance=Number(row.closingBalance||0);
        const days=row.days!=null?row.days:'';
        const payment=isIssue?0:(interest+principal2);
        const isGrace=row.rowType==='GRACE';
        const numSI=isGrace?9:2;
        cellRows.push(`<row r="${r}" ht="16">`+
            cellD('A',r,3,row.paymentDate)+
            (isIssue?cellEmpty('B',r,numSI):cellN('B',r,numSI,payment.toFixed(2)))+
            (isIssue?cellEmpty('C',r,numSI):cellN('C',r,numSI,interest.toFixed(2)))+
            (isIssue?cellEmpty('D',r,numSI):cellN('D',r,numSI,principal2.toFixed(2)))+
            cellN('E',r,numSI,closingBalance.toFixed(2))+
            (days!==''?cellN('F',r,2,days):cellEmpty('F',r,2))+
            `</row>`);
    });
    const totalR=10+rows.length;
    cellRows.push(`<row r="${totalR}" ht="18">`+
        cellS('A',totalR,6,ss('Итого:'))+
        cellN('B',totalR,5,totalPayment.toFixed(2))+
        cellN('C',totalR,5,totalInterest.toFixed(2))+
        cellN('D',totalR,5,totalPrincipal.toFixed(2))+
        cellEmpty('E',totalR,5)+cellEmpty('F',totalR,5)+`</row>`);

    const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetFormatPr defaultRowHeight="15" customHeight="1"/>
  <cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/><col min="6" max="6" width="14" customWidth="1"/></cols>
  <sheetData>${cellRows.join('')}</sheetData>
</worksheet>`;
    const ssXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s=>`  <si><t xml:space="preserve">${esc(s)}</t></si>`).join('\n')}
</sst>`;
    const wbXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="График погашения займа" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
    const wbRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
    const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
    const files={'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'xl/workbook.xml':wbXml,'xl/_rels/workbook.xml.rels':wbRels,'xl/worksheets/sheet1.xml':sheetXml,'xl/sharedStrings.xml':ssXml,'xl/styles.xml':stylesXml};

    function buildZip(fileMap) {
        const enc=new TextEncoder(),parts=[],centralDir=[];
        let offset=0;
        function crc32(data){
            let crc=0xFFFFFFFF;
            const table=crc32.table||(crc32.table=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}return t;})());
            for(let i=0;i<data.length;i++)crc=(crc>>>8)^table[(crc^data[i])&0xFF];
            return(crc^0xFFFFFFFF)>>>0;
        }
        for(const[name,content]of Object.entries(fileMap)){
            const nb=enc.encode(name),data=enc.encode(content),crc=crc32(data),sz=data.length;
            const lfh=new Uint8Array(30+nb.length),dv=new DataView(lfh.buffer);
            dv.setUint32(0,0x04034B50,true);dv.setUint16(4,20,true);dv.setUint16(6,0,true);dv.setUint16(8,0,true);
            dv.setUint16(10,0,true);dv.setUint16(12,0,true);dv.setUint32(14,crc,true);dv.setUint32(18,sz,true);
            dv.setUint32(22,sz,true);dv.setUint16(26,nb.length,true);dv.setUint16(28,0,true);lfh.set(nb,30);
            parts.push(lfh,data);
            const cde=new Uint8Array(46+nb.length),dvc=new DataView(cde.buffer);
            dvc.setUint32(0,0x02014B50,true);dvc.setUint16(4,20,true);dvc.setUint16(6,20,true);dvc.setUint16(8,0,true);
            dvc.setUint16(10,0,true);dvc.setUint16(12,0,true);dvc.setUint16(14,0,true);dvc.setUint32(16,crc,true);
            dvc.setUint32(20,sz,true);dvc.setUint32(24,sz,true);dvc.setUint16(28,nb.length,true);dvc.setUint16(30,0,true);
            dvc.setUint16(32,0,true);dvc.setUint16(34,0,true);dvc.setUint16(36,0,true);dvc.setUint32(38,0,true);
            dvc.setUint32(42,offset,true);cde.set(nb,46);centralDir.push(cde);
            offset+=lfh.length+data.length;
        }
        const cdSize=centralDir.reduce((s,b)=>s+b.length,0);
        const eocd=new Uint8Array(22),dve=new DataView(eocd.buffer);
        dve.setUint32(0,0x06054B50,true);dve.setUint16(4,0,true);dve.setUint16(6,0,true);
        dve.setUint16(8,centralDir.length,true);dve.setUint16(10,centralDir.length,true);
        dve.setUint32(12,cdSize,true);dve.setUint32(16,offset,true);dve.setUint16(20,0,true);
        const all=[...parts,...centralDir,eocd],total=all.reduce((s,b)=>s+b.length,0);
        const out=new Uint8Array(total);let pos=0;
        for(const b of all){out.set(b,pos);pos+=b.length;}
        return out;
    }

    const zipBytes=buildZip(files);
    const blob=new Blob([zipBytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const now=new Date();
    const ts=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.href=url; a.download=`schedule_${Math.round(principal/1000)}k_${ts}.xlsx`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
}

// ─── Event listeners ─────────────────────────────────────────────────────────
els.modeSimpleBtn.addEventListener('click', () => setMode('simple'));
els.modeManualBtn.addEventListener('click', () => { setMode('manual'); if (!els.manualRows.children.length) buildManualRows(); });
els.applySimpleBtn.addEventListener('click', applySimpleGrace);
els.clearSimpleBtn.addEventListener('click', () => { els.simpleMonths.value=3; els.simpleOd.checked=true; els.simplePct.checked=false; });
els.fillManualBtn.addEventListener('click', buildManualRows);
els.clearManualBtn.addEventListener('click', clearManualRows);
els.term.addEventListener('change', () => { if (currentMode==='manual') buildManualRows(); });
els.firstPaymentDate.addEventListener('change', () => { if (currentMode==='manual' && els.manualRows.children.length) buildManualRows(); });
els.exportBtn.addEventListener('click', exportToExcel);
els.recalcBtn.addEventListener('click', () => { recalcGESV(); els.recalcBtn.style.display='none'; });

if (els.calendarMode) {
    els.calendarMode.addEventListener('change', () => {
        updateCalendarBadge();
        if (els.manualRows.children.length) buildManualRows();
    });
    updateCalendarBadge();
}

els.calcBtn.addEventListener('click', () => {
    els.errorBox.textContent   = '';
    els.scheduleBody.innerHTML = '';
    els.summary.innerHTML      = '';
    els.recalcBtn.style.display = 'none';
    els.editHint.style.display  = 'none';
    lastResult = null; manualEdits = {};
    try {
        if (!els.manualRows.children.length) {
            currentMode === 'simple' ? applySimpleGrace() : buildManualRows();
        }
        const gracePeriods = readGracePeriods();
        const upfrontFee   = num(els.upfrontFee.value);
        const issueDate    = new Date(els.issueDate.value);
        const loan = new Loan({
            principal:        num(els.principal.value),
            annualRate:       num(els.annualRate.value),
            term:             parseInt(els.term.value, 10),
            issueDate,
            firstPaymentDate: new Date(els.firstPaymentDate.value),
            lastPaymentDate:  els.lastPaymentDate.value ? new Date(els.lastPaymentDate.value) : null,
            paymentMethod:    els.paymentMethod.value,
            distributionMode: els.distributionMode.value,
            gracePeriods
        });
        const options = upfrontFee > 0
            ? { fees: [{ date: issueDate, amount: upfrontFee, description: 'Единоразовая комиссия' }] }
            : {};
        const calculator = new LoanCalculator(getCalendar());
        const result     = calculator.calculate(loan, options);
        lastResult = result;
        renderSchedule(result);
    } catch(e) {
        console.error('calcBtn error:', e);
        els.errorBox.textContent = e.stack || e.message || String(e);
    }
});

buildManualRows();
