/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev5
 *
 * ScheduleEngine.js
 *
 * Матрица поведения при отсрочке (аннуитет):
 *
 * 1. odGrace=true  (отсрочка ОД):
 *    Льготный период: principal=0, interest начисляется и платится.
 *    После: PMT пересчитывается при каждой новой серии odGrace через
 *    calculateAnnuityWithGrace() — срез дат начиная с конца текущей серии.
 *
 * 2. percentGrace=true (отсрочка процентов):
 *    Льготный период: PMT целиком идёт в ОД, interest=0 (накапливается).
 *    Баланс снижается быстрее. Накопленные проценты распределяются
 *    по distributionMode.
 *
 * 3. odGrace + percentGrace (полная отсрочка):
 *    Льготный период: principal=0, interest=0, payment=0.
 *    Накопленные проценты распределяются по distributionMode.
 *
 * distributionMode:
 *   FIRST_PAYMENT    — накопленные % добавляются к первому платежу после льготы.
 *   ALL_NEXT_PAYMENTS — равномерно по всем оставшимся НОРМАЛЬНЫМ периодам.
 * ==========================================================
 */

import PaymentRow from "../models/PaymentRow.js";
import Schedule from "../models/Schedule.js";
import InterestCalculator from "../math/InterestCalculator.js";
import PaymentCalculator from "../math/PaymentCalculator.js";
import PeriodCalculator from "../math/PeriodCalculator.js";
import DateUtils from "../core/DateUtils.js";
import Money from "../core/Money.js";
import { RowType, PaymentMethod, DistributionMode } from "../core/Enums.js";

export default class ScheduleEngine {

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

        // Для EQUAL_PRINCIPAL: равная часть ОД после отсрочки (ALL_NEXT)
        let afterGraceEqualPrincipal = null;
        // Для EQUAL_PRINCIPAL + FIRST_PAYMENT: признак что первый платёж уже увеличен
        // (сбрасывается при каждой новой серии odGrace)
        let firstPaymentAfterOdGraceHandled = false;

        // Последний известный «конец серии» odGrace — для отслеживания новых серий.
        // Хранит СТАРОЕ значение до обновления при isFirstNormalAfterNewOdGrace,
        // чтобы _calculateSkippedPrincipalSince получил правильный fromPeriod.
        let lastKnownOdGraceEndPeriod = -1;

        // АННУИТЕТ: PMT считается до цикла для первой серии grace (или без grace)
        let annuityBasePayment = 0;

        // Построить массив дат один раз
        const allPaymentDates = _buildPaymentDates(loan, this.calendar, totalPeriods);

        if (isAnnuity) {
            const hasOdGrace = loan.gracePeriods &&
                loan.gracePeriods.some(g => g && g.odGrace);

            if (hasOdGrace) {
                annuityBasePayment = PaymentCalculator.calculateAnnuityWithGrace(
                    loan.principal,
                    loan.annualRate,
                    allPaymentDates,
                    loan.gracePeriods
                );
            } else {
                annuityBasePayment = PaymentCalculator.calculateAnnuity(
                    loan.principal,
                    loan.annualRate,
                    totalPeriods,
                    allPaymentDates
                );
            }
        }

        const hasAnyGrace = loan.gracePeriods && loan.gracePeriods.length > 0;

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

            const actDays      = PeriodCalculator.calculate(prevDate, paymentDate).days;
            const annuityDays  = DateUtils.days30_360(prevDate, paymentDate);
            const openingBalance = Money.round(balance);

            // Отсрочка для этого периода
            const grace = loan.gracePeriods
                ? loan.gracePeriods.find(
                    g => g && typeof g.includes === "function" && g.includes(period)
                  )
                : undefined;

            const inGrace      = !!grace;
            const odGrace      = inGrace && grace.odGrace;
            const percentGrace = inGrace && grace.percentGrace;

            let rowType = inGrace ? RowType.GRACE : RowType.NORMAL;

            // ═══════════════════════════════════════════════════════════
            // Обнаружение НАЧАЛА нормального периода после odGrace-серии
            // ═══════════════════════════════════════════════════════════
            const isFirstNormalAfterNewOdGrace = (
                !inGrace &&
                _hadNewOdGraceSince(loan, lastKnownOdGraceEndPeriod + 1, period - 1)
            );

            // Сохраняем СТАРЫЙ конец grace ДО обновления —
            // нужен для _calculateSkippedPrincipalSince
            const prevOdGraceEndPeriod = lastKnownOdGraceEndPeriod;

            if (isFirstNormalAfterNewOdGrace) {
                // Зафиксировать новый конец odGrace-серии
                lastKnownOdGraceEndPeriod = _findOdGraceEndBefore(loan, period);

                // АННУИТЕТ: пересчитать PMT от конца новой серии odGrace
                if (isAnnuity) {
                    annuityBasePayment = PaymentCalculator.calculateAnnuityWithGrace(
                        balance,
                        loan.annualRate,
                        allPaymentDates,
                        loan.gracePeriods,
                        period   // startPeriod: пересчёт начиная с текущего периода
                    );
                }

                // EQUAL_PRINCIPAL + ALL_NEXT: сбросить кэш, чтобы пересчитать долю
                if (!isAnnuity && distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                    afterGraceEqualPrincipal = null;
                }

                // EQUAL_PRINCIPAL + FIRST_PAYMENT: сбросить флаг для новой серии
                if (!isAnnuity && distributionMode === DistributionMode.FIRST_PAYMENT) {
                    firstPaymentAfterOdGraceHandled = false;
                }
            }

            // Дни для процентов: аннуитет → 30/360, равные доли → Act/Act
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
                    // ALL_NEXT: уже пересчитанная доля после grace
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(afterGraceEqualPrincipal);

                } else {
                    // FIRST_PAYMENT или ещё не было grace:
                    // базовая доля = loan.principal / loan.term (стандартная)
                    // накопленный пропущенный ОД добавится в БЛОКЕ 4
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
                    principal = 0;
                }

                if (percentGrace) {
                    deferredInterest = Money.add(deferredInterest, interest);
                    interest = 0;
                }

            // ═══════════════════════════════════════════════════════════
            // БЛОК 4: Период ПОСЛЕ льготы
            // ═══════════════════════════════════════════════════════════
            } else {

                // Распределение deferredInterest
                if (deferredInterest > 0) {

                    if (distributionMode === DistributionMode.FIRST_PAYMENT) {
                        interest = Money.add(interest, deferredInterest);
                        deferredInterest = 0;

                    } else if (distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                        const remainingNormal = _countRemainingNormalPeriods(loan, period);
                        const share = period === totalPeriods
                            ? deferredInterest
                            : Money.round(deferredInterest / remainingNormal);
                        interest = Money.add(interest, share);
                        deferredInterest = Money.subtract(deferredInterest, share);
                    }

                }

                // EQUAL_PRINCIPAL + ALL_NEXT: пересчёт доли ОД при первом нормальном
                // после odGrace (afterGraceEqualPrincipal сброшен выше при новой серии)
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

                // EQUAL_PRINCIPAL + FIRST_PAYMENT: добавить пропущенный ОД
                // Используем prevOdGraceEndPeriod (СТАРЫЙ конец), а не обновлённый,
                // чтобы fromPeriod = prevOdGraceEndPeriod + 1 охватил текущую серию grace.
                if (
                    !isAnnuity &&
                    distributionMode === DistributionMode.FIRST_PAYMENT &&
                    !firstPaymentAfterOdGraceHandled
                ) {
                    const hadOdGrace = loan.gracePeriods.some(
                        g => g && g.odGrace && g.endPeriod < period
                    );
                    if (hadOdGrace) {
                        const skipped = _calculateSkippedPrincipalSince(
                            loan,
                            prevOdGraceEndPeriod,  // ← СТАРЫЙ конец (до обновления)
                            period - 1
                        );
                        if (skipped > 0) {
                            principal = Money.add(principal, skipped);
                        }
                        firstPaymentAfterOdGraceHandled = true;
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
                    annuityBasePayment:   isAnnuity ? annuityBasePayment : null,
                    annuityDays30_360:    isAnnuity ? annuityDays       : null,
                    deferredInterestLeft: deferredInterest
                }
            }));

            balance  = closingBalance;
            prevDate = paymentDate;
        }

        return new Schedule(rows);
    }

}

/**
 * Построить массив дат для расчёта PMT аннуитета.
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
 * Подсчитать пропущенный ОД в odGrace-периодах в диапазоне (lastEndPeriod, toPeriod].
 * Только для EQUAL_PRINCIPAL + FIRST_PAYMENT.
 * lastEndPeriod — СТАРЫЙ конец предыдущей серии (до текущей).
 * fromPeriod = lastEndPeriod + 1 — начало текущей серии grace.
 */
function _calculateSkippedPrincipalSince(loan, lastEndPeriod, toPeriod) {
    if (loan.paymentMethod !== PaymentMethod.EQUAL_PRINCIPAL) return 0;

    const regularPrincipal = Money.round(loan.principal / loan.term);
    let skipped = 0;
    const fromPeriod = lastEndPeriod + 1;

    for (let p = fromPeriod; p <= toPeriod; p++) {
        const grace = loan.gracePeriods.find(
            g => g && typeof g.includes === "function" && g.includes(p)
        );
        if (grace && grace.odGrace) {
            skipped = Money.add(skipped, regularPrincipal);
        }
    }

    return skipped;
}

/**
 * Подсчитать общее кол-во НОРМАЛЬНЫХ (не-odGrace) периодов в графике.
 */
function _countNormalPeriods(loan) {
    let count = 0;
    for (let p = 1; p <= loan.term; p++) {
        const grace = loan.gracePeriods
            ? loan.gracePeriods.find(
                g => g && typeof g.includes === "function" && g.includes(p)
              )
            : undefined;
        const isOdGrace = grace && grace.odGrace;
        if (!isOdGrace) count++;
    }
    return count || loan.term;
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
        const isOdGrace = grace && grace.odGrace;
        if (!isOdGrace) count++;
    }
    return count || 1;
}
