// === Colvir Schedule & APR Calculator — app.js ===

// ─── Holidays Data ────────────────────────────────────────────────────────────
const __HOLIDAYS_DATA__ = {"colvir":{"fixed":[{"month":1,"day":1,"name":"Новый год"},{"month":1,"day":2,"name":"Новый год"},{"month":1,"day":7,"name":"Православное Рождество"},{"month":3,"day":8,"name":"Международный женский день"},{"month":3,"day":21,"name":"Наурыз"},{"month":3,"day":22,"name":"Наурыз"},{"month":3,"day":23,"name":"Наурыз"},{"month":5,"day":1,"name":"Праздник единства народа"},{"month":5,"day":7,"name":"День защитника Отечества"},{"month":5,"day":9,"name":"День Победы"},{"month":7,"day":6,"name":"День столицы"},{"month":8,"day":30,"name":"День Конституции"},{"month":12,"day":1,"name":"День Первого Президента"},{"month":12,"day":16,"name":"День Независимости"},{"month":12,"day":17,"name":"День Независимости"}]}};

// ─── Enums ────────────────────────────────────────────────────────────────────
const PaymentMethod     = Object.freeze({ ANNUITY: 'ANNUITY', EQUAL_PRINCIPAL: 'EQUAL_PRINCIPAL' });
const DistributionMode  = Object.freeze({ FIRST_PAYMENT: 'FIRST_PAYMENT', ALL_NEXT: 'ALL_NEXT' });
const RowType           = Object.freeze({ NORMAL: 'normal', GRACE: 'grace' });

// ─── Validation ───────────────────────────────────────────────────────────────
class Validation {
    static requirePositive(name, v)        { if (typeof v !== 'number' || v <= 0)    throw new Error(`${name} must be positive`); }
    static requirePositiveOrZero(name, v)  { if (typeof v !== 'number' || v < 0)     throw new Error(`${name} must be ≥ 0`); }
    static requireInteger(name, v)         { if (!Number.isInteger(v) || v <= 0)     throw new Error(`${name} must be positive integer`); }
    static requireDate(name, v)            { if (!(v instanceof Date) || isNaN(v))   throw new Error(`${name} must be a valid Date`); }
}

// ─── Money ────────────────────────────────────────────────────────────────────
class Money {
    static round(v) { return Math.round(v * 100) / 100; }
}

// ─── DateUtils ────────────────────────────────────────────────────────────────
class DateUtils {
    static addMonths(date, months) {
        const d = new Date(date);
        const day = d.getDate();
        d.setMonth(d.getMonth() + months);
        // If day overflowed (e.g. Jan 31 + 1m → Mar 3), snap back to last day of intended month
        if (d.getDate() !== day) d.setDate(0);
        return d;
    }
    static clone(date) { return new Date(date); }
    static daysBetween(a, b) {
        return Math.round((b - a) / 86400000);
    }
    static days30_360(d1, d2) {
        let y1 = d1.getFullYear(), m1 = d1.getMonth() + 1, dd1 = d1.getDate();
        let y2 = d2.getFullYear(), m2 = d2.getMonth() + 1, dd2 = d2.getDate();
        if (dd1 === 31) dd1 = 30;
        if (dd2 === 31 && dd1 === 30) dd2 = 30;
        return (y2 - y1) * 360 + (m2 - m1) * 30 + (dd2 - dd1);
    }
    static toISODate(d) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
class Calendar {
    constructor(mode = 'none', holidaysData = null) {
        this.mode = mode;
        this._fixed = new Set();
        if (mode === 'colvir' && holidaysData && holidaysData.colvir) {
            for (const h of holidaysData.colvir.fixed) {
                this._fixed.add(`${h.month}-${h.day}`);
            }
        }
    }
    isHoliday(d) {
        if (this.mode === 'none') return false;
        const key = `${d.getMonth() + 1}-${d.getDate()}`;
        return this._fixed.has(key);
    }
    isWeekend(d) {
        return d.getDay() === 0 || d.getDay() === 6;
    }
    adjustPaymentDate(d) {
        if (this.mode === 'none') return d;
        let adj = new Date(d);
        while (this.isWeekend(adj) || this.isHoliday(adj)) {
            adj.setDate(adj.getDate() + 1);
        }
        return adj;
    }
}

// ─── Loan ─────────────────────────────────────────────────────────────────────
class Loan {
    constructor({ principal, annualRate, term, issueDate, firstPaymentDate, lastPaymentDate = null, paymentMethod, gracePeriods = [], distributionMode = DistributionMode.FIRST_PAYMENT }) {
        Validation.requirePositive("principal", principal);
        Validation.requirePositiveOrZero("annualRate", annualRate);
        Validation.requireInteger("term", term);
        Validation.requireDate("issueDate", issueDate);
        Validation.requireDate("firstPaymentDate", firstPaymentDate);
        if (lastPaymentDate !== null) Validation.requireDate("lastPaymentDate", lastPaymentDate);
        if (!Object.values(PaymentMethod).includes(paymentMethod)) throw new Error("Unknown payment method.");
        this.principal        = principal;
        this.annualRate       = annualRate;
        this.term             = term;
        this.issueDate        = issueDate;
        this.firstPaymentDate = firstPaymentDate;
        this.lastPaymentDate  = lastPaymentDate;
        this.paymentMethod    = paymentMethod;
        this.gracePeriods     = gracePeriods;
        this.distributionMode = distributionMode;
    }
}

// ─── PaymentCalculator ────────────────────────────────────────────────────────
class PaymentCalculator {

    static calculateAnnuity(principal, annualRate, term, allPaymentDates) {
        // allPaymentDates includes issueDate at index 0
        return PaymentCalculator._calculateAnnuityBy30_360(principal, annualRate, allPaymentDates);
    }

    // PMT = PV / Σ_{j=1..n} [ Π_{k=1..j} 1/(1+r_k) ]
    // Прямой цикл дисконтирования (Colvir-совместимый: 30/360, shifted dates)
    static _calculateAnnuityBy30_360(principal, annualRate, dates) {
        const n = dates.length - 1;
        if (n <= 0) return 0;
        const r_periods = [];
        for (let i = 1; i <= n; i++) {
            const days = DateUtils.days30_360(dates[i-1], dates[i]);
            r_periods.push(annualRate / 100 * days / 360);
        }
        // PMT = PV / Σ_{j=1..n} [ Π_{k=1..j} 1/(1+r_k) ]
        // Прямой цикл дисконтирования (как Colvir: 30/360, shifted dates)
        let denominator = 0;
        let discount = 1;
        for (let j = 0; j < n; j++) {
            discount *= 1 / (1 + r_periods[j]);
            denominator += discount;
        }
        if (denominator === 0) return 0;
        return Money.round(principal / denominator);
    }

    static calculateAnnuityWithGrace(principal, annualRate, normalPeriods, allPaymentDates, gracePeriodIndices) {
        // Re-calculate PMT using only non-grace payment dates
        const normalDates = allPaymentDates.filter((_, i) => i === 0 || !gracePeriodIndices.includes(i));
        return PaymentCalculator._calculateAnnuityBy30_360(principal, annualRate, normalDates);
    }
}

// ─── GraceRange ───────────────────────────────────────────────────────────────
class GraceRange {
    constructor(from, to, { odGrace = false, percentGrace = false } = {}) {
        this.from         = from;
        this.to           = to;
        this.odGrace      = odGrace;
        this.percentGrace = percentGrace;
    }
    includes(period) { return period >= this.from && period <= this.to; }
}

// ─── ScheduleEngine ───────────────────────────────────────────────────────────
class ScheduleEngine {
    constructor(calendar = null) {
        this.calendar = calendar;
    }

    generate(loan) {
        const isAnnuity     = loan.paymentMethod === PaymentMethod.ANNUITY;
        const totalPeriods  = loan.term;

        let balance = loan.principal;
        let prevDate = DateUtils.clone(loan.issueDate);

        // Build ALL payment dates upfront (needed for PMT calculation)
        const allPaymentDates = _buildPaymentDates(loan, this.calendar, totalPeriods);

        let annuityBasePayment = 0;
        if (isAnnuity) {
            // FIX: PMT всегда считается от ВСЕХ дат (включая grace),
            // чтобы срок не сокращался. calculateAnnuityWithGrace для
            // начального PMT не используется — только для ALL_NEXT пересчёта.
            annuityBasePayment = PaymentCalculator.calculateAnnuity(
                loan.principal,
                loan.annualRate,
                totalPeriods,
                allPaymentDates
            );
        }

        for (let period = 1; period <= totalPeriods; period++) {

            // Дата платежа
            let plannedDate;
            if (period === totalPeriods && loan.lastPaymentDate) {
                plannedDate = DateUtils.clone(loan.lastPaymentDate);
            } else {
                plannedDate = DateUtils.addMonths(
                    loan.firstPaymentDate,
                    period - 1
                );
            }

            const paymentDate = this.calendar
                ? this.calendar.adjustPaymentDate(plannedDate)
                : plannedDate;

            const actDays        = DateUtils.daysBetween(prevDate, paymentDate);
            const annuityDays    = DateUtils.days30_360(prevDate, paymentDate);
            const openingBalance = Money.round(balance);

            const grace = loan.gracePeriods
                ? loan.gracePeriods.find(
                    g => g && typeof g.includes === "function" && g.includes(period)
                  )
                : undefined;

            const inGrace      = !!grace;
            const odGrace      = inGrace && grace.odGrace;
            const percentGrace = inGrace && grace.percentGrace;

            const rowType = inGrace ? RowType.GRACE : RowType.NORMAL;

            // ═══════════════════════════════════════════════════════════════════
            // Обнаружение первого нормального периода после odGrace-серии
            // ═══════════════════════════════════════════════════════════════════
            const prevGrace = period > 1
                ? loan.gracePeriods && loan.gracePeriods.find(
                    g => g && typeof g.includes === "function" && g.includes(period - 1)
                  )
                : null;
            const prevOdGrace = prevGrace ? prevGrace.odGrace : false;
            const firstAfterOdGrace = prevOdGrace && !odGrace;

            // ─── Процентная ставка за период (30/360) ───────────────────────
            const periodRate  = loan.annualRate / 100 * annuityDays / 360;
            const interestAmt = Money.round(openingBalance * periodRate);

            let principalAmt, totalPayment;

            if (odGrace) {
                // OD-grace: платится только процент (или ноль при percentGrace)
                principalAmt = 0;
                totalPayment = percentGrace ? 0 : interestAmt;

            } else if (isAnnuity) {
                // ─── Аннуитет ───────────────────────────────────────────────

                if (firstAfterOdGrace && loan.distributionMode === DistributionMode.ALL_NEXT) {
                    // ALL_NEXT: пересчитать PMT на оставшиеся периоды
                    const remainingPeriods = totalPeriods - period + 1;
                    const remainingDates   = allPaymentDates.slice(period - 1);
                    annuityBasePayment = PaymentCalculator._calculateAnnuityBy30_360(
                        balance,
                        loan.annualRate,
                        remainingDates
                    );
                }

                if (period === totalPeriods) {
                    // Последний период: всё оставшееся ОД + проценты
                    principalAmt = Money.round(balance);
                    totalPayment = Money.round(principalAmt + interestAmt);
                } else {
                    totalPayment  = annuityBasePayment;
                    principalAmt  = Money.round(totalPayment - interestAmt);
                    if (principalAmt < 0) principalAmt = 0;
                    if (principalAmt > balance) principalAmt = Money.round(balance);
                }

            } else {
                // ─── Равные доли ОД ─────────────────────────────────────────
                principalAmt = period === totalPeriods
                    ? Money.round(balance)
                    : Money.round(loan.principal / totalPeriods);
                totalPayment = Money.round(principalAmt + (percentGrace ? 0 : interestAmt));
            }

            balance = Money.round(balance - principalAmt);

            yield {
                period,
                paymentDate,
                openingBalance,
                principalAmt,
                interestAmt,
                totalPayment,
                closingBalance: balance,
                actDays,
                annuityDays,
                rowType,
                inGrace,
                odGrace,
                percentGrace
            };

            prevDate = paymentDate;
        }
    }
}

// helper — выносим за пределы класса для чистоты
function _buildPaymentDates(loan, calendar, totalPeriods) {
    const dates = [DateUtils.clone(loan.issueDate)];
    for (let p = 1; p <= totalPeriods; p++) {
        let planned;
        if (p === totalPeriods && loan.lastPaymentDate) {
            planned = DateUtils.clone(loan.lastPaymentDate);
        } else {
            planned = DateUtils.addMonths(loan.firstPaymentDate, p - 1);
        }
        const adjusted = calendar ? calendar.adjustPaymentDate(planned) : planned;
        dates.push(adjusted);
    }
    return dates;
}

// ─── LoanCalculator ───────────────────────────────────────────────────────────
class LoanCalculator {
    constructor(calendar = null) {
        this.calendar = calendar;
        this._engine  = new ScheduleEngine(calendar);
    }

    calculate(loan, { fees = [] } = {}) {
        const rows = [];
        for (const row of this._engine.generate(loan)) {
            rows.push(row);
        }

        const totalInterest   = Money.round(rows.reduce((s, r) => s + r.interestAmt,   0));
        const totalPrincipal  = Money.round(rows.reduce((s, r) => s + r.principalAmt,  0));
        const totalPayment    = Money.round(rows.reduce((s, r) => s + r.totalPayment,  0));

        const aprResult = APRCalculator.calculate(loan, rows, fees);

        return {
            loan,
            rows,
            totalInterest,
            totalPrincipal,
            totalPayment,
            apr: aprResult.apr,
            gesv: aprResult.gesv,
            fees
        };
    }
}

// ─── APRCalculator ────────────────────────────────────────────────────────────
class APRCalculator {

    static calculate(loan, rows, fees = []) {
        // Build cash-flow array: [{ date, amount }]
        // Outflows (negative): principal disbursement + fees on issue date
        // Inflows (positive): each scheduled total payment

        const cf = [];

        // Disbursement
        cf.push({ date: loan.issueDate, amount: -loan.principal });

        // Upfront fees (paid on issue date)
        for (const fee of fees) {
            cf.push({ date: fee.date, amount: -fee.amount });
        }

        // Scheduled payments
        for (const row of rows) {
            if (row.totalPayment > 0) {
                cf.push({ date: row.paymentDate, amount: row.totalPayment });
            }
        }

        // Solve for APR (annual rate) using Newton-Raphson on actual days/365
        const apr = APRCalculator._solveAPR(cf);

        // ГЭСВ = (1 + apr/100)^1 − 1 expressed as %  [already annual]
        // By KZ regulation: GESV = ((1 + i)^(365/D) - 1) * 100
        // where D = days from first disbursement to last payment, i = period IRR
        const gesv = apr; // IRR is already annualised over actual/365

        return { apr: Money.round(apr * 100) / 100, gesv: Money.round(gesv * 100) / 100 };
    }

    static _solveAPR(cashflows) {
        // Normalise dates to day-offsets from t=0
        const t0    = cashflows[0].date;
        const flows = cashflows.map(cf => ({
            t: DateUtils.daysBetween(t0, cf.date),
            v: cf.amount
        }));

        // Newton-Raphson: find r such that Σ v_i / (1+r)^(t_i/365) = 0
        let r = 0.1; // initial guess 10%
        for (let iter = 0; iter < 200; iter++) {
            let f = 0, df = 0;
            for (const { t, v } of flows) {
                const exp  = t / 365;
                const disc = Math.pow(1 + r, exp);
                f  += v / disc;
                df -= exp * v / (disc * (1 + r));
            }
            if (Math.abs(df) < 1e-15) break;
            const delta = f / df;
            r -= delta;
            if (Math.abs(delta) < 1e-10) break;
        }
        return r * 100; // return as percentage
    }
}

// ─── Exports (browser global) ─────────────────────────────────────────────────
window.ColvirCalc = {
    PaymentMethod,
    DistributionMode,
    RowType,
    Loan,
    GraceRange,
    Calendar,
    LoanCalculator,
    APRCalculator,
    DateUtils,
    Money,
    PaymentCalculator,
    __HOLIDAYS_DATA__
};

// ─── Excel Export ─────────────────────────────────────────────────────────────
// Minimal XLSX builder (no dependencies)
function buildXlsx(aoa) {
    // aoa = array of arrays (rows of cells)
    const xmlHeader   = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
    const wbXml = `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="График" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const strings = []; const ssMap = {};
    function ss(s) { const k=String(s); if(ssMap[k]===undefined){ssMap[k]=strings.length;strings.push(k);} return ssMap[k]; }

    let wsXml = `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;
    for (let ri = 0; ri < aoa.length; ri++) {
        const row = aoa[ri];
        wsXml += `<row r="${ri+1}">`;
        for (let ci = 0; ci < row.length; ci++) {
            const col = String.fromCharCode(65 + ci);
            const row1 = ri + 1;
            const v = row[ci];
            if (v === null || v === undefined) { wsXml += `<c r="${col}${row1}"/>`; continue; }
            if (typeof v === 'number') {
                wsXml += `<c r="${col}${row1}" t="n"><v>${v}</v></c>`;
            } else {
                const si = ss(v);
                wsXml += `<c r="${col}${row1}" t="s"><v>${si}</v></c>`;
            }
        }
        wsXml += `</row>`;
    }
    wsXml += `</sheetData></worksheet>`;

    const sst = `${xmlHeader}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${
        strings.map(s=>`<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')
    }</sst>`;

    function escXml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

    // Build ZIP using JSZip-compatible structure manually via data URIs trick
    // We rely on the SheetJS CDN being available — if not, fall back to CSV
    // Actually: build a proper zip using fflate (loaded in index.html)
    return { wbXml, wsXml, sst, rels, wbRels, contentTypes };
}

window.ColvirCalc.buildXlsx = buildXlsx;

// ─── formatDate helper (used by index.html) ───────────────────────────────────
function formatDate(d) {
    if (!d || isNaN(d)) return '';
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear().toString().slice(-2);
    return `${dd}.${mm}.${yy}`;
}
window.formatDate = formatDate;
