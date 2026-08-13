// === Colvir Schedule & APR Calculator — app.js ===

// ─── Holidays Data ───────────────────────────────────────────────────────────
const __HOLIDAYS_DATA__ = {"colvir":{"fixed":[{"month":1,"day":1,"name":"Новый год"},{"month":1,"day":2,"name":"Новый год"},{"month":3,"day":8,"name":"Международный женский день"},{"month":3,"day":21,"name":"Наурыз мейрамы"},{"month":3,"day":22,"name":"Наурыз мейрамы"},{"month":3,"day":23,"name":"Наурыз мейрамы"},{"month":5,"day":1,"name":"Праздник единства народа Казахстана"},{"month":5,"day":7,"name":"День защитника Отечества"},{"month":5,"day":9,"name":"День Победы"},{"month":7,"day":6,"name":"День столицы"},{"month":8,"day":30,"name":"День Конституции Республики Казахстан"},{"month":12,"day":1,"name":"День Первого Президента"},{"month":12,"day":16,"name":"День Независимости"},{"month":12,"day":17,"name":"День Независимости"}]},"actual":{"2026":{"holidays":[{"date":"2026-01-01","name":"Новый год"},{"date":"2026-01-02","name":"Новый год"},{"date":"2026-03-08","name":"Международный женский день"},{"date":"2026-03-21","name":"Наурыз мейрамы"},{"date":"2026-03-22","name":"Наурыз мейрамы"},{"date":"2026-03-23","name":"Наурыз мейрамы"},{"date":"2026-05-01","name":"Праздник единства народа Казахстана"},{"date":"2026-05-07","name":"День защитника Отечества"},{"date":"2026-05-09","name":"День Победы"},{"date":"2026-07-06","name":"День столицы"},{"date":"2026-08-30","name":"День Конституции Республики Казахстан"},{"date":"2026-12-01","name":"День Первого Президента"},{"date":"2026-12-16","name":"День Независимости"},{"date":"2026-12-17","name":"День Независимости"}],"transfers":[]},"2025":{"holidays":[{"date":"2025-01-01","name":"Новый год"},{"date":"2025-01-02","name":"Новый год"},{"date":"2025-03-08","name":"Международный женский день"},{"date":"2025-03-21","name":"Наурыз мейрамы"},{"date":"2025-03-22","name":"Наурыз мейрамы"},{"date":"2025-03-23","name":"Наурыз мейрамы"},{"date":"2025-03-24","name":"Наурыз мейрамы (перенос с 22.03)"},{"date":"2025-05-01","name":"Праздник единства народа Казахстана"},{"date":"2025-05-07","name":"День защитника Отечества"},{"date":"2025-05-09","name":"День Победы"},{"date":"2025-07-06","name":"День столицы"},{"date":"2025-07-07","name":"День столицы (перенос с 06.07)"},{"date":"2025-08-30","name":"День Конституции Республики Казахстан"},{"date":"2025-12-01","name":"День Первого Президента"},{"date":"2025-12-16","name":"День Независимости"},{"date":"2025-12-17","name":"День Независимости"}],"transfers":[{"from":"2025-03-22","to":"2025-03-24","note":"Суббота → понедельник"},{"from":"2025-07-06","to":"2025-07-07","note":"Воскресенье → понедельник"}]}}};

// ─── Core: Enums ─────────────────────────────────────────────────────────────
const PaymentMethod = Object.freeze({
    ANNUITY:         "ANNUITY",
    EQUAL_PRINCIPAL: "EQUAL_PRINCIPAL"
});

const RowType = Object.freeze({
    NORMAL: "NORMAL",
    GRACE:  "GRACE"
});

const DistributionMode = Object.freeze({
    FIRST_PAYMENT:     "FIRST_PAYMENT",
    ALL_NEXT_PAYMENTS: "ALL_NEXT_PAYMENTS"
});

// ─── Core: Constants ─────────────────────────────────────────────────────────
const APR = Object.freeze({
    BASIS_DAYS:     365,
    MAX_ITERATIONS: 1000,
    EPSILON:        1e-9
});

// ─── Core: DateUtils ─────────────────────────────────────────────────────────
class DateUtils {
    static daysBetween(from, to) {
        const msPerDay = 86400000;
        const fromUTC  = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
        const toUTC    = Date.UTC(to.getFullYear(),   to.getMonth(),   to.getDate());
        return Math.round((toUTC - fromUTC) / msPerDay);
    }
    static days30_360(from, to) {
        let y1 = from.getFullYear(), m1 = from.getMonth() + 1, d1 = from.getDate();
        let y2 = to.getFullYear(),   m2 = to.getMonth()   + 1, d2 = to.getDate();
        if (d1 === 31) d1 = 30;
        if (d1 === 30 && d2 === 31) d2 = 30;
        return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
    }
    static clone(date) { return new Date(date.getTime()); }
    static addMonths(date, n) {
        const d   = new Date(date.getTime());
        const day = d.getDate();
        d.setMonth(d.getMonth() + n);
        if (d.getDate() < day) d.setDate(0);
        return d;
    }
    static addDays(date, n) {
        const d = new Date(date.getTime());
        d.setDate(d.getDate() + n);
        return d;
    }
    static compare(a, b) {
        const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        if (aUTC < bUTC) return -1;
        if (aUTC > bUTC) return  1;
        return 0;
    }
    static equals(a, b) { return DateUtils.compare(a, b) === 0; }
    static dayOfWeek(date) { return date.getDay(); }
    static isWeekend(date) { const dow = date.getDay(); return dow === 0 || dow === 6; }
    static format(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}.${m}.${y}`;
    }
    static nextWorkingDay(date, isHolidayFn = null) {
        let d = DateUtils.clone(date);
        d = DateUtils.addDays(d, 1);
        while (DateUtils.isWeekend(d) || (isHolidayFn && isHolidayFn(d))) {
            d = DateUtils.addDays(d, 1);
        }
        return d;
    }
}

// ─── Core: Validation ────────────────────────────────────────────────────────
class Validation {
    static requireNumber(name, value) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new TypeError(`${name} must be a finite number, got: ${value}`);
        }
    }
    static requirePositive(name, value) {
        Validation.requireNumber(name, value);
        if (value <= 0) throw new RangeError(`${name} must be positive, got: ${value}`);
    }
    static requirePositiveOrZero(name, value) {
        Validation.requireNumber(name, value);
        if (value < 0) throw new RangeError(`${name} must be >= 0, got: ${value}`);
    }
    static requireInteger(name, value) {
        if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer, got: ${value}`);
    }
    static requireDate(name, value) {
        if (!(value instanceof Date) || isNaN(value.getTime())) {
            throw new TypeError(`${name} must be a valid Date, got: ${value}`);
        }
    }
    static requireString(name, value) {
        if (typeof value !== "string" || value.length === 0) {
            throw new TypeError(`${name} must be a non-empty string, got: ${value}`);
        }
    }
}

// ─── Core: Money ─────────────────────────────────────────────────────────────
class Money {
    static round(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
    static roundRate(value) { return Math.round((value + Number.EPSILON) * 10000) / 10000; }
}

// ─── Core: CalendarMode ──────────────────────────────────────────────────────
const CalendarMode = Object.freeze({
    COLVIR: "colvir",
    ACTUAL: "actual"
});

// ─── Models: PaymentRow ──────────────────────────────────────────────────────
class PaymentRow {
    constructor({ period, paymentDate, days, openingBalance, principal, interest, payment, closingBalance, rowType = RowType.NORMAL, metadata = {} }) {
        Validation.requireInteger("period", period);
        Validation.requireDate("paymentDate", paymentDate);
        Validation.requirePositiveOrZero("days", days);
        Validation.requirePositiveOrZero("openingBalance", openingBalance);
        Validation.requirePositiveOrZero("principal", principal);
        Validation.requirePositiveOrZero("interest", interest);
        Validation.requirePositiveOrZero("payment", payment);
        Validation.requirePositiveOrZero("closingBalance", closingBalance);
        if (!Object.values(RowType).includes(rowType)) throw new Error("Unknown row type.");
        this.period = period;
        this.paymentDate = new Date(paymentDate);
        this.days = days;
        this.openingBalance = Money.round(openingBalance);
        this.principal = Money.round(principal);
        this.interest = Money.round(interest);
        this.payment = Money.round(payment);
        this.closingBalance = Money.round(closingBalance);
        this.rowType = rowType;
        this.metadata = Object.freeze({ ...metadata });
        Object.freeze(this);
    }
    toJSON() {
        return { period: this.period, paymentDate: this.paymentDate, days: this.days, openingBalance: this.openingBalance, principal: this.principal, interest: this.interest, payment: this.payment, closingBalance: this.closingBalance, rowType: this.rowType, metadata: this.metadata };
    }
}

// ─── Models: Schedule ────────────────────────────────────────────────────────
class Schedule {
    constructor(rows = []) {
        if (!Array.isArray(rows)) throw new TypeError("rows must be an array.");
        for (const row of rows) {
            if (!(row instanceof PaymentRow)) throw new TypeError("Schedule accepts only PaymentRow objects.");
        }
        this.rows = Object.freeze([...rows]);
        Object.freeze(this);
    }
    get length() { return this.rows.length; }
    get(index) { return this.rows[index]; }
    totalPayment()   { return Money.round(this.rows.reduce((sum, row) => sum + row.payment,   0)); }
    totalInterest()  { return Money.round(this.rows.reduce((sum, row) => sum + row.interest,  0)); }
    totalPrincipal() { return Money.round(this.rows.reduce((sum, row) => sum + row.principal, 0)); }
    finalBalance() { return this.rows.length === 0 ? 0 : this.rows[this.rows.length - 1].closingBalance; }
    toJSON() { return { rows: this.rows.map(row => row.toJSON()) }; }
}

// ─── Models: GracePeriod ─────────────────────────────────────────────────────
class GracePeriod {
    constructor({ startPeriod, endPeriod, odGrace = false, percentGrace = false }) {
        this.startPeriod = Number(startPeriod);
        this.endPeriod = Number(endPeriod);
        this.odGrace = Boolean(odGrace);
        this.percentGrace = Boolean(percentGrace);
        if (!Number.isInteger(this.startPeriod) || this.startPeriod < 1) throw new Error("startPeriod must be integer >= 1.");
        if (!Number.isInteger(this.endPeriod) || this.endPeriod < this.startPeriod) throw new Error("endPeriod must be integer and >= startPeriod.");
        if (!this.odGrace && !this.percentGrace) throw new Error("At least one of odGrace or percentGrace must be true.");
        Object.freeze(this);
    }
    includes(period) { return period >= this.startPeriod && period <= this.endPeriod; }
}

// ─── Models: Loan ────────────────────────────────────────────────────────────
class Loan {
    constructor({ principal, annualRate, term, issueDate, firstPaymentDate, lastPaymentDate = null, paymentMethod, gracePeriods = [], distributionMode = DistributionMode.FIRST_PAYMENT }) {
        Validation.requirePositive("principal", principal);
        Validation.requirePositiveOrZero("annualRate", annualRate);
        Validation.requireInteger("term", term);
        Validation.requireDate("issueDate", issueDate);
        Validation.requireDate("firstPaymentDate", firstPaymentDate);
        if (lastPaymentDate !== null) Validation.requireDate("lastPaymentDate", lastPaymentDate);
        if (!Object.values(PaymentMethod).includes(paymentMethod)) throw new Error("Unknown payment method.");
        if (!Object.values(DistributionMode).includes(distributionMode)) throw new Error("Unknown distribution mode.");
        if (!Array.isArray(gracePeriods)) throw new TypeError("gracePeriods must be an array.");
        this.principal = Number(principal);
        this.annualRate = Number(annualRate);
        this.term = Number(term);
        this.issueDate = new Date(issueDate);
        this.firstPaymentDate = new Date(firstPaymentDate);
        this.lastPaymentDate = lastPaymentDate ? new Date(lastPaymentDate) : null;
        this.paymentMethod = paymentMethod;
        this.distributionMode = distributionMode;
        this.gracePeriods = gracePeriods;
        Object.freeze(this);
    }
}

// ─── Models: APRResult ───────────────────────────────────────────────────────
class APRResult {
    constructor({ annualRate, annualPercentRate, converged, iterations, residual, basisDays, metadata = {} }) {
        Validation.requireNumber("annualRate", annualRate);
        Validation.requireNumber("annualPercentRate", annualPercentRate);
        if (typeof converged !== "boolean") throw new TypeError("converged must be boolean.");
        Validation.requireInteger("iterations", iterations);
        Validation.requireNumber("residual", residual);
        Validation.requirePositive("basisDays", basisDays);
        if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) throw new TypeError("metadata must be an object.");
        this.annualRate = annualRate;
        this.annualPercentRate = Money.roundRate(annualPercentRate);
        this.converged = converged;
        this.iterations = iterations;
        this.residual = residual;
        this.basisDays = basisDays;
        this.metadata = Object.freeze({ ...metadata });
        Object.freeze(this);
    }
    toJSON() {
        return { annualRate: this.annualRate, annualPercentRate: this.annualPercentRate, converged: this.converged, iterations: this.iterations, residual: this.residual, basisDays: this.basisDays, metadata: this.metadata };
    }
}

// ─── Models: CashFlow ────────────────────────────────────────────────────────
class CashFlow {
    constructor({ date, amount, type = "GENERIC", metadata = {} }) {
        Validation.requireDate("date", date);
        Validation.requireNumber("amount", amount);
        if (typeof type !== "string" || type.length === 0) throw new TypeError("type must be a non-empty string.");
        if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) throw new TypeError("metadata must be an object.");
        this.date = new Date(date);
        this.amount = Money.round(amount);
        this.type = type;
        this.metadata = Object.freeze({ ...metadata });
        Object.freeze(this);
    }
    isInflow()  { return this.amount > 0; }
    isOutflow() { return this.amount < 0; }
    toJSON()    { return { date: this.date, amount: this.amount, type: this.type, metadata: this.metadata }; }
}

// ─── Models: CashFlowSet ─────────────────────────────────────────────────────
class CashFlowSet {
    constructor(flows = []) {
        if (!Array.isArray(flows)) throw new TypeError("flows must be an array.");
        for (const flow of flows) {
            if (!(flow instanceof CashFlow)) throw new TypeError("CashFlowSet accepts only CashFlow objects.");
        }
        this.flows = Object.freeze([...flows]);
        Object.freeze(this);
    }
    get length() { return this.flows.length; }
    get(index) { return this.flows[index]; }
    toArray() { return this.flows.slice(); }
    sorted() {
        const sortedFlows = this.toArray().sort((a, b) => a.date.getTime() - b.date.getTime());
        return new CashFlowSet(sortedFlows);
    }
    baseDate() { return this.flows.length === 0 ? null : this.sorted().get(0).date; }
    totalInflow()  { return Money.round(this.flows.reduce((sum, flow) => flow.amount > 0 ? sum + flow.amount : sum, 0)); }
    totalOutflow() { return Money.round(this.flows.reduce((sum, flow) => flow.amount < 0 ? sum + Math.abs(flow.amount) : sum, 0)); }
    netAmount()    { return Money.round(this.flows.reduce((sum, flow) => sum + flow.amount, 0)); }
    hasMixedSigns() {
        const hasPositive = this.flows.some(flow => flow.amount > 0);
        const hasNegative = this.flows.some(flow => flow.amount < 0);
        return hasPositive && hasNegative;
    }
    withAppended(flow) {
        if (!(flow instanceof CashFlow)) throw new TypeError("flow must be a CashFlow instance.");
        return new CashFlowSet([...this.flows, flow]);
    }
    toJSON() { return { flows: this.flows.map(flow => flow.toJSON()) }; }
}

// ─── Calendar: KazakhstanCalendar ────────────────────────────────────────────
class KazakhstanCalendar {
    constructor(mode = CalendarMode.COLVIR) {
        if (!Object.values(CalendarMode).includes(mode)) throw new Error("Unknown CalendarMode: " + mode);
        this.mode = mode;
    }
    isHoliday(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const y = date.getFullYear();
        if (this.mode === CalendarMode.COLVIR) {
            return __HOLIDAYS_DATA__.colvir.fixed.some(h => h.month === m && h.day === d);
        }
        const yearData = __HOLIDAYS_DATA__.actual[y];
        if (!yearData) {
            return __HOLIDAYS_DATA__.colvir.fixed.some(h => h.month === m && h.day === d);
        }
        const isoStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        return yearData.holidays.some(h => h.date === isoStr);
    }
    isNonWorkingDay(date) { return DateUtils.isWeekend(date) || this.isHoliday(date); }
    adjustPaymentDate(date) {
        let d = DateUtils.clone(date);
        while (this.isNonWorkingDay(d)) { d = DateUtils.addDays(d, 1); }
        return d;
    }
    getHolidayName(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const y = date.getFullYear();
        if (this.mode === CalendarMode.COLVIR) {
            const h = __HOLIDAYS_DATA__.colvir.fixed.find(h => h.month === m && h.day === d);
            return h ? h.name : null;
        }
        const yearData = __HOLIDAYS_DATA__.actual[y];
        if (!yearData) {
            const h = __HOLIDAYS_DATA__.colvir.fixed.find(h => h.month === m && h.day === d);
            return h ? h.name : null;
        }
        const isoStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const holiday = yearData.holidays.find(h => h.date === isoStr);
        return holiday ? holiday.name : null;
    }
}

// ─── Math: InterestCalculator ────────────────────────────────────────────────
class InterestCalculator {
    static calculate(balance, annualRate, days) {
        return Money.round(balance * annualRate / 100 * days / 360);
    }
}

// ─── Math: PaymentCalculator ─────────────────────────────────────────────────
class PaymentCalculator {
    static calculateAnnuity(principal, annualRate, periods, dates = null) {
        if (annualRate === 0) return Money.round(principal / periods);
        if (dates && dates.length === periods + 1) {
            return PaymentCalculator._calculateAnnuityBy30_360(principal, annualRate, dates);
        }
        const monthlyRate = annualRate / 100 / 12;
        const factor = Math.pow(1 + monthlyRate, periods);
        return Money.round(principal * monthlyRate * factor / (factor - 1));
    }
    static calculateAnnuityWithGrace(principal, annualRate, allDates, gracePeriods, startPeriod = 1) {
        const totalPeriods = allDates.length - 1;
        if (annualRate === 0) {
            const normalCount = Array.from(
                { length: totalPeriods - startPeriod + 1 },
                (_, i) => i + startPeriod
            ).filter(p => !gracePeriods.some(g => g && g.odGrace && g.includes && g.includes(p))).length;
            return Money.round(principal / (normalCount || 1));
        }
        let graceEndIdx = startPeriod - 1;
        for (let i = startPeriod; i <= totalPeriods; i++) {
            const inOdGrace = gracePeriods.some(g => g && g.odGrace && g.includes && g.includes(i));
            if (inOdGrace) { graceEndIdx = i; } else { break; }
        }
        const virtualStartDate = allDates[graceEndIdx];
        const normalDates = [virtualStartDate];
        for (let i = graceEndIdx + 1; i <= totalPeriods; i++) {
            const inGrace = gracePeriods.some(g => g && g.odGrace && g.includes && g.includes(i));
            if (!inGrace) normalDates.push(allDates[i]);
        }
        if (normalDates.length <= 1) return 0;
        return PaymentCalculator._calculateAnnuityBy30_360(principal, annualRate, normalDates);
    }
    static _calculateAnnuityBy30_360(principal, annualRate, dates) {
        const n = dates.length - 1;
        if (n <= 0) return 0;
        const r_periods = [];
        for (let i = 1; i <= n; i++) {
            const days = DateUtils.days30_360(dates[i-1], dates[i]);
            r_periods.push(annualRate / 100 * days / 360);
        }
        let denominator = 0;
        let productSoFar = 1;
        for (let k = n - 1; k >= 0; k--) {
            productSoFar *= (1 + r_periods[k]);
            denominator += 1 / productSoFar;
        }
        if (denominator === 0) return 0;
        return Money.round(principal / denominator);
    }
}

// ─── Math: APRCalculator ─────────────────────────────────────────────────────
class APRCalculator {
    static calculate(cashFlowSet, options = {}) {
        if (!(cashFlowSet instanceof CashFlowSet)) throw new TypeError("cashFlowSet must be CashFlowSet.");
        if (cashFlowSet.length === 0) throw new Error("cashFlowSet is empty.");
        if (!cashFlowSet.hasMixedSigns()) throw new Error("cashFlowSet must contain both positive and negative flows.");
        const basisDays     = options.basisDays || APR.BASIS_DAYS;
        Validation.requirePositive("basisDays", basisDays);
        const guess         = typeof options.guess === "number" ? options.guess : 0.30;
        const tolerance     = typeof options.tolerance === "number" ? options.tolerance : APR.EPSILON;
        const maxIterations = Number.isInteger(options.maxIterations) ? options.maxIterations : APR.MAX_ITERATIONS;
        const flows         = cashFlowSet.sorted().toArray();
        const baseDate      = flows[0].date;
        let rate = guess, converged = false, residual = null, iterations = 0;
        for (let i = 0; i < maxIterations; i++) {
            iterations = i + 1;
            const f  = APRCalculator.npv(flows, rate, baseDate, basisDays);
            const df = APRCalculator.npvDerivative(flows, rate, baseDate, basisDays);
            residual = f;
            if (Math.abs(f) < tolerance) { converged = true; break; }
            if (Math.abs(df) < tolerance) break;
            const nextRate = rate - f / df;
            if (!Number.isFinite(nextRate)) break;
            if (nextRate <= -0.9999999999) break;
            rate = nextRate;
        }
        return new APRResult({ annualRate: rate, annualPercentRate: rate * 100, converged, iterations, residual: residual ?? 0, basisDays, metadata: { baseDate, method: "NEWTON_RAPHSON" } });
    }
    static npv(flows, annualRate, baseDate, basisDays) {
        return flows.reduce((sum, flow) => {
            const days = DateUtils.daysBetween(baseDate, flow.date);
            return sum + flow.amount / Math.pow(1 + annualRate, days / basisDays);
        }, 0);
    }
    static npvDerivative(flows, annualRate, baseDate, basisDays) {
        return flows.reduce((sum, flow) => {
            const days = DateUtils.daysBetween(baseDate, flow.date);
            const exponent = days / basisDays;
            if (exponent === 0) return sum;
            return sum + flow.amount * (-exponent / Math.pow(1 + annualRate, exponent + 1));
        }, 0);
    }
}

// ─── Engine: ScheduleEngine (v4 logic) ───────────────────────────────────────
/**
 * Матрица поведения при отсрочке:
 *
 * 1. odGrace=true (отсрочка ОД):
 *    Льготный период: principal=0, interest начисляется и платится.
 *    После:
 *      FIRST_PAYMENT     — весь пропущенный ОД добавляется к первому
 *                          нормальному платежу одной суммой поверх PMT/доли.
 *      ALL_NEXT_PAYMENTS — аннуитет: PMT пересчитывается от текущего баланса.
 *                          Равные доли: доля пересчитывается от текущего баланса.
 *
 * 2. percentGrace=true (отсрочка процентов):
 *    Льготный период: PMT целиком идёт в ОД, interest=0 (накапливается).
 *    Накопленные проценты распределяются по distributionMode.
 *
 * 3. odGrace + percentGrace (полная отсрочка):
 *    Льготный период: principal=0, interest=0, payment=0.
 *    Накопленные проценты распределяются по distributionMode.
 */
class ScheduleEngine {

    constructor(calendar = null) {
        this.calendar = calendar;
    }

    generate(loan) {

        const rows = [];

        // Строка 0: дата выдачи
        rows.push(new PaymentRow({
            period:         0,
            paymentDate:    DateUtils.clone(loan.issueDate),
            days:           0,
            openingBalance: loan.principal,
            principal:      0,
            interest:       0,
            payment:        0,
            closingBalance: loan.principal,
            rowType:        RowType.NORMAL,
            metadata:       { technical: true, kind: "ISSUE" }
        }));

        const totalPeriods     = loan.term;
        const distributionMode = loan.distributionMode || DistributionMode.FIRST_PAYMENT;
        const isAnnuity        = loan.paymentMethod === PaymentMethod.ANNUITY;

        let balance          = Money.round(loan.principal);
        let prevDate         = DateUtils.clone(loan.issueDate);
        let deferredInterest = 0;

        // Пропущенный ОД за odGrace-серию (для FIRST_PAYMENT, оба метода погашения).
        // Накапливается в odGrace-периодах, сбрасывается в первом нормальном.
        let deferredPrincipal = 0;

        // Для EQUAL_PRINCIPAL + ALL_NEXT: пересчитанная доля после grace
        let afterGraceEqualPrincipal = null;

        // Последний известный «конец серии» odGrace — для отслеживания новых серий
        let lastKnownOdGraceEndPeriod = -1;

        // АННУИТЕТ: базовый PMT (пересчитывается при ALL_NEXT после каждой серии)
        let annuityBasePayment = 0;

        const allPaymentDates = _buildPaymentDates(loan, this.calendar, totalPeriods);

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

            // ═══════════════════════════════════════════════════════════
            // Обнаружение первого нормального периода после odGrace-серии
            // ═══════════════════════════════════════════════════════════
            const isFirstNormalAfterNewOdGrace = (
                !inGrace &&
                _hadNewOdGraceSince(loan, lastKnownOdGraceEndPeriod + 1, period - 1)
            );

            if (isFirstNormalAfterNewOdGrace) {
                lastKnownOdGraceEndPeriod = _findOdGraceEndBefore(loan, period);

                // АННУИТЕТ + ALL_NEXT: пересчитать PMT от текущего баланса
                // АННУИТЕТ + FIRST_PAYMENT: PMT не пересчитывается —
                //   пропущенный ОД уже накоплен в deferredPrincipal и будет
                //   добавлен одним куском в БЛОКЕ 4.
                if (isAnnuity && distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                    annuityBasePayment = PaymentCalculator.calculateAnnuityWithGrace(
                        balance,
                        loan.annualRate,
                        allPaymentDates,
                        loan.gracePeriods,
                        period
                    );
                }

                // EQUAL_PRINCIPAL + ALL_NEXT: сбросить кэш для пересчёта доли
                if (!isAnnuity && distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                    afterGraceEqualPrincipal = null;
                }
            }

            // Проценты: аннуитет — 30/360, равные доли — actual days
            const interestDays = isAnnuity ? annuityDays : actDays;

            let interest = Money.round(
                InterestCalculator.calculate(
                    openingBalance,
                    loan.annualRate,
                    interestDays
                )
            );

            let principal;

            // ═══════════════════════════════════════════════════════════
            // БЛОК 1: АННУИТЕТ
            // ═══════════════════════════════════════════════════════════
            if (isAnnuity) {

                if (period === totalPeriods) {
                    principal = openingBalance;

                } else if (odGrace) {
                    principal = 0;

                } else if (percentGrace) {
                    principal = Math.min(
                        Money.round(annuityBasePayment),
                        openingBalance
                    );

                } else {
                    principal = Money.round(annuityBasePayment - interest);
                    if (principal < 0) principal = 0;
                    if (principal > openingBalance) principal = openingBalance;
                }

            // ═══════════════════════════════════════════════════════════
            // БЛОК 2: РАВНЫЕ ДОЛИ
            // ═══════════════════════════════════════════════════════════
            } else {

                if (afterGraceEqualPrincipal !== null) {
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(afterGraceEqualPrincipal);

                } else {
                    // Базовая доля; накопленный пропущенный ОД добавится в БЛОКЕ 4
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(loan.principal / totalPeriods);
                }

            }

            // ═══════════════════════════════════════════════════════════
            // БЛОК 3: Обработка отсрочки (grace overrides)
            // ═══════════════════════════════════════════════════════════
            if (inGrace) {

                if (odGrace) {
                    // Накапливаем пропущенный ОД для FIRST_PAYMENT
                    if (distributionMode === DistributionMode.FIRST_PAYMENT) {
                        let contrib;
                        if (isAnnuity) {
                            // ОД который был бы в этом периоде = PMT - interest
                            contrib = Money.round(annuityBasePayment - interest);
                            if (contrib < 0) contrib = 0;
                        } else {
                            contrib = Money.round(loan.principal / totalPeriods);
                        }
                        deferredPrincipal = Money.round(deferredPrincipal + contrib);
                    }
                    principal = 0;
                }

                if (percentGrace) {
                    deferredInterest = Money.round(deferredInterest + interest);
                    interest = 0;
                }

            // ═══════════════════════════════════════════════════════════
            // БЛОК 4: Период ПОСЛЕ льготы
            // ═══════════════════════════════════════════════════════════
            } else {

                // Распределение deferredInterest
                if (deferredInterest > 0) {

                    if (distributionMode === DistributionMode.FIRST_PAYMENT) {
                        interest = Money.round(interest + deferredInterest);
                        deferredInterest = 0;

                    } else if (distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                        const remainingNormal = _countRemainingNormalPeriods(loan, period);
                        const share = period === totalPeriods
                            ? deferredInterest
                            : Money.round(deferredInterest / remainingNormal);
                        interest = Money.round(interest + share);
                        deferredInterest = Money.round(deferredInterest - share);
                    }

                }

                // Распределение deferredPrincipal (FIRST_PAYMENT, оба метода)
                if (deferredPrincipal > 0 && distributionMode === DistributionMode.FIRST_PAYMENT) {
                    principal = Money.round(principal + deferredPrincipal);
                    deferredPrincipal = 0;
                }

                // EQUAL_PRINCIPAL + ALL_NEXT: пересчёт доли при первом нормальном
                if (
                    !isAnnuity &&
                    distributionMode === DistributionMode.ALL_NEXT_PAYMENTS &&
                    afterGraceEqualPrincipal === null
                ) {
                    const hadOdGrace = loan.gracePeriods.some(
                        g => g && g.odGrace && g.endPeriod < period
                    );
                    if (hadOdGrace) {
                        const remainingNormal = _countRemainingNormalPeriods(loan, period);
                        afterGraceEqualPrincipal = remainingNormal > 0
                            ? Money.round(openingBalance / remainingNormal)
                            : openingBalance;
                        principal = period === totalPeriods
                            ? openingBalance
                            : Money.round(afterGraceEqualPrincipal);
                    }
                }

            }

            if (principal < 0) principal = 0;
            if (principal > openingBalance) principal = openingBalance;

            if (period === totalPeriods) {
                principal = openingBalance;
            }

            const closingBalance = Money.round(openingBalance - principal);
            const payment        = Money.round(principal + interest);

            rows.push(new PaymentRow({
                period,
                paymentDate,
                days:           actDays,
                openingBalance,
                principal:      Money.round(principal),
                interest:       Money.round(interest),
                payment,
                closingBalance,
                rowType,
                metadata: {
                    grace:            inGrace,
                    odGrace,
                    percentGrace,
                    distributionMode,
                    plannedDate,
                    adjustedDate:     paymentDate,
                    annuityBasePayment:    isAnnuity ? annuityBasePayment : null,
                    annuityDays30_360:     isAnnuity ? annuityDays       : null,
                    deferredPrincipalLeft: deferredPrincipal,
                    deferredInterestLeft:  deferredInterest
                }
            }));

            balance  = closingBalance;
            prevDate = paymentDate;
        }

        return new Schedule(rows);
    }

}

/**
 * Построить массив дат платежей (рабочих) для расчёта PMT аннуитета.
 */
function _buildPaymentDates(loan, calendar, totalPeriods) {
    const dates = [];
    dates.push(DateUtils.clone(loan.issueDate));

    for (let p = 1; p <= totalPeriods; p++) {
        let planned;
        if (p === totalPeriods && loan.lastPaymentDate) {
            planned = DateUtils.clone(loan.lastPaymentDate);
        } else {
            planned = DateUtils.addMonths(loan.firstPaymentDate, p - 1);
        }
        const adjusted = calendar
            ? calendar.adjustPaymentDate(planned)
            : planned;
        dates.push(adjusted);
    }

    return dates;
}

/**
 * Проверить: были ли odGrace-периоды в диапазоне [fromPeriod, toPeriod].
 */
function _hadNewOdGraceSince(loan, fromPeriod, toPeriod) {
    if (!loan.gracePeriods || fromPeriod > toPeriod) return false;
    for (let p = fromPeriod; p <= toPeriod; p++) {
        const grace = loan.gracePeriods.find(
            g => g && typeof g.includes === "function" && g.includes(p)
        );
        if (grace && grace.odGrace) return true;
    }
    return false;
}

/**
 * Найти последний odGrace-период строго до fromPeriod.
 */
function _findOdGraceEndBefore(loan, fromPeriod) {
    if (!loan.gracePeriods) return -1;
    let last = -1;
    for (let p = 1; p < fromPeriod; p++) {
        const grace = loan.gracePeriods.find(
            g => g && typeof g.includes === "function" && g.includes(p)
        );
        if (grace && grace.odGrace) last = p;
    }
    return last;
}

/**
 * Подсчитать кол-во НОРМАЛЬНЫХ (не-odGrace) периодов начиная с fromPeriod.
 */
function _countRemainingNormalPeriods(loan, fromPeriod) {
    let count = 0;
    for (let p = fromPeriod; p <= loan.term; p++) {
        const grace = loan.gracePeriods
            ? loan.gracePeriods.find(
                g => g && typeof g.includes === "function" && g.includes(p)
              )
            : undefined;
        if (!(grace && grace.odGrace)) count++;
    }
    return count || 1;
}

// ─── Builder: CashFlowBuilder ────────────────────────────────────────────────
class CashFlowBuilder {
    static fromLoanAndSchedule(loan, schedule, options = {}) {
        const fees = Array.isArray(options.fees) ? options.fees : [];
        const issueAmount = loan.principal - fees.reduce((sum, f) => {
            if (DateUtils.equals(new Date(f.date), loan.issueDate)) return sum + f.amount;
            return sum;
        }, 0);
        const flowList = [
            new CashFlow({ date: DateUtils.clone(loan.issueDate), amount: -issueAmount, type: 'DISBURSEMENT', metadata: { description: 'Выдача займа' } })
        ];
        for (const row of schedule.rows) {
            if (row.metadata && row.metadata.technical) continue;
            if (row.payment === 0) continue;
            flowList.push(new CashFlow({ date: DateUtils.clone(row.paymentDate), amount: row.payment, type: 'PAYMENT', metadata: { period: row.period } }));
        }
        for (const fee of fees) {
            if (!DateUtils.equals(new Date(fee.date), loan.issueDate)) {
                flowList.push(new CashFlow({ date: new Date(fee.date), amount: fee.amount, type: 'FEE', metadata: { description: fee.description || 'Комиссия' } }));
            }
        }
        return new CashFlowSet(flowList);
    }
}

// ─── Service: LoanCalculator ─────────────────────────────────────────────────
class LoanCalculator {
    constructor(calendar = null) {
        this.calendar = calendar;
        this.scheduleEngine = new ScheduleEngine(calendar);
    }
    calculate(loan, options = {}) {
        const schedule   = this.scheduleEngine.generate(loan);
        const fees       = Array.isArray(options.fees) ? options.fees : [];
        const cashFlows  = CashFlowBuilder.fromLoanAndSchedule(loan, schedule, { fees });
        const aprOptions = {
            basisDays:     options.apr && Number.isFinite(options.apr.basisDays)     ? options.apr.basisDays     : APR.BASIS_DAYS,
            guess:         options.apr && Number.isFinite(options.apr.guess)         ? options.apr.guess         : undefined,
            tolerance:     options.apr && Number.isFinite(options.apr.tolerance)     ? options.apr.tolerance     : undefined,
            maxIterations: options.apr && Number.isInteger(options.apr.maxIterations) ? options.apr.maxIterations : undefined
        };
        const apr = APRCalculator.calculate(cashFlows, aprOptions);
        return { loan, schedule, cashFlows, apr };
    }
}

// ─── APR Helper ──────────────────────────────────────────────────────────────
function __aprFromArray(rawFlows, opts) {
  const flows = rawFlows.map(f => new CashFlow({ date: f.date, amount: f.amount, type: 'GENERIC', metadata: {} }));
  return APRCalculator.calculate(new CashFlowSet(flows), opts);
}

// ─── UI: App.js ──────────────────────────────────────────────────────────────

// DOM refs
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

// State
let currentMode  = 'simple';
let lastResult   = null;
let manualEdits  = {};

// Helpers
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

// Mode tabs
function setMode(mode) {
    currentMode = mode;
    els.modeSimpleBtn.classList.toggle('active', mode === 'simple');
    els.modeManualBtn.classList.toggle('active',  mode === 'manual');
    els.simplePanel.classList.toggle('active',    mode === 'simple');
    els.manualPanel.classList.toggle('active',    mode === 'manual');
}

// Manual rows
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

// Current rows (with manual edits)
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

// Recalc GESV
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
        const apr = __aprFromArray(cashFlows, { basisDays: APR.BASIS_DAYS });
        const totalPrincipal = rows.reduce((s, r) => s + (r.principal || 0), 0);
        const totalInterest  = rows.reduce((s, r) => s + (r.interest  || 0), 0);
        renderSummary({ totalPrincipal, totalInterest, totalPayment: totalPrincipal + totalInterest, rowCount: rows.length }, apr);
    } catch(e) { console.error('recalcGESV error:', e); }
}

// Editable cells
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
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } if (e.key === 'Escape') { td.innerHTML = isDate ? formatDate(currentValue) : fmt(currentValue); } });
    });
}

function updateRowTotal(rowIdx) {
    const tr = document.querySelector(`tr[data-row="${rowIdx}"]`);
    if (!tr) return;
    const edit = manualEdits[rowIdx] || {};
    const row  = lastResult.schedule.rows[rowIdx];
    if (!row) return;
    const principal = edit.principal !== undefined ? Number(edit.principal) : row.principal;
    const interest  = edit.interest  !== undefined ? Number(edit.interest)  : row.interest;
    const payCell   = tr.querySelector('.payment-cell');
    if (payCell) payCell.textContent = fmt(principal + interest);
}

// Summary
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

// Schedule render
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

// Excel export
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
            const aprRes = __aprFromArray(cashFlows, { basisDays: APR.BASIS_DAYS });
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
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
    }
    function cellS(col,row,si,str) { return `<c r="${col}${row}" s="${si}" t="s"><v>${str}</v></c>`; }
    function cellN(col,row,si,n)   { return `<c r="${col}${row}" s="${si}" t="n"><v>${n}</v></c>`; }
    function cellD(col,row,si,d)   { return `<c r="${col}${row}" s="${si}" t="n"><v>${dateToExcel(d)}</v></c>`; }
    function cellEmpty(col,row,si) { return `<c r="${col}${row}" s="${si}"/>`; }

    const strings = []; const ssMap = {};
    function ss(s) { const k=String(s); if(ssMap[k]===undefined){ssMap[k]=strings.length;strings.push(k);} return ssMap[k]; }
