/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev4
 *
 * ScheduleEngine.js
 *
 * Матрица поведения при отсрочке (аннуитет):
 *
 * 1. odGrace=true  (отсрочка ОД):
 *    Льготный период: principal=0, interest начисляется и платится.
 *    После: PMT не пересчитывается — используется PMT, рассчитанный
 *    ОДИН РАЗ через calculateAnnuityWithGrace() до начала цикла.
 *
 *    Алгоритм Colvir для PMT с odGrace:
 *      PMT = (PV − PV_grace_discounted) / Σ(df⁻¹ для нельготных периодов)
 *    где PV_grace = Σ(interest_i / cumFactor_i) по льготным периодам.
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
 *   ALL_NEXT_PAYMENTS — равномерно по всем оставшимся периодам.
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
        let firstPaymentAfterOdGraceHandled = false;

        // АННУИТЕТ: PMT считается ОДИН РАЗ до цикла
        let annuityBasePayment = 0;

        if (isAnnuity) {
            const paymentDates = _buildPaymentDates(
                loan, this.calendar, totalPeriods
            );

            const hasOdGrace = loan.gracePeriods &&
                loan.gracePeriods.some(g => g && g.odGrace);

            if (hasOdGrace) {
                // Алгоритм Colvir: PMT с учётом льготных периодов через дисконтирование
                annuityBasePayment = PaymentCalculator.calculateAnnuityWithGrace(
                    loan.principal,
                    loan.annualRate,
                    paymentDates,
                    loan.gracePeriods
                );
            } else {
                annuityBasePayment = PaymentCalculator.calculateAnnuity(
                    loan.principal,
                    loan.annualRate,
                    totalPeriods,
                    paymentDates
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

            const remainingPeriods = totalPeriods - period + 1;

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
                    // Последний период: закрываем весь остаток.
                    principal = openingBalance;

                } else if (odGrace) {
                    // Отсрочка ОД: ОД не платим.
                    principal = 0;

                } else if (percentGrace) {
                    // Отсрочка процентов: весь PMT идёт в ОД.
                    principal = Math.min(
                        Money.round(annuityBasePayment),
                        openingBalance
                    );

                } else {
                    // Обычный период (в т.ч. первый после льготы)
                    // PMT уже рассчитан правильно через calculateAnnuityWithGrace
                    principal = Money.round(annuityBasePayment - interest);
                    if (principal < 0) principal = 0;
                    if (principal > openingBalance) principal = openingBalance;
                }

            // ═══════════════════════════════════════════════════════════
            // БЛОК 2: РАВНЫЕ ДОЛИ
            // ═══════════════════════════════════════════════════════════
            } else {

                if (afterGraceEqualPrincipal !== null) {
                    // afterGraceEqualPrincipal уже учитывает только нормальные периоды.
                    // Последний период закрывает копеечный остаток.
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(afterGraceEqualPrincipal);

                } else if (hasAnyGrace) {
                    // Есть grace-периоды, но afterGrace ещё не инициализирован —
                    // значит мы ещё в начале графика (возможно, сам grace или до него).
                    // Считаем нормальных периодов во всём loan и делим на них.
                    // БЛОК 3 ниже обнулит principal если это odGrace-период.
                    const normalCount = _countNormalPeriods(loan);
                    principal = period === totalPeriods
                        ? openingBalance
                        : (normalCount > 0
                            ? Money.round(loan.principal / normalCount)
                            : openingBalance);

                } else {
                    // Нет grace: просто делим на totalPeriods
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
                        const share = period === totalPeriods
                            ? deferredInterest
                            : Money.round(deferredInterest / remainingPeriods);
                        interest = Money.add(interest, share);
                        deferredInterest = Money.subtract(
                            deferredInterest, share
                        );
                    }

                }

                // Равные доли + ALL_NEXT_PAYMENTS:
                // При первом нормальном периоде после odGrace пересчитываем базовую
                // долю ОД, деля остаток только на НОРМАЛЬНЫЕ (не-grace) периоды.
                if (
                    !isAnnuity &&
                    distributionMode === DistributionMode.ALL_NEXT_PAYMENTS &&
                    afterGraceEqualPrincipal === null
                ) {
                    const hadOdGrace = loan.gracePeriods.some(
                        g => g && g.odGrace && g.endPeriod < period
                    );
                    if (hadOdGrace) {
                        // Считаем только нормальные периоды начиная с текущего
                        const remainingNormal = _countRemainingNormalPeriods(loan, period);
                        afterGraceEqualPrincipal = remainingNormal > 0
                            ? Money.round(openingBalance / remainingNormal)
                            : openingBalance;
                        principal = period === totalPeriods
                            ? openingBalance
                            : Money.round(afterGraceEqualPrincipal);
                    }
                }

                if (
                    !isAnnuity &&
                    distributionMode === DistributionMode.FIRST_PAYMENT &&
                    !firstPaymentAfterOdGraceHandled
                ) {
                    const hadOdGrace = loan.gracePeriods.some(
                        g => g && g.odGrace && g.endPeriod < period
                    );
                    if (hadOdGrace) {
                        const skipped = _calculateSkippedPrincipal(
                            loan, period - 1
                        );
                        if (skipped > 0) {
                            principal = Money.add(principal, skipped);
                        }
                        firstPaymentAfterOdGraceHandled = true;
                    }
                }

            }

            // Гарантируем: principal в допустимых пределах
            if (principal < 0) principal = 0;
            if (principal > openingBalance) principal = openingBalance;

            // Последний период: закрываем весь остаток
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
 * Всегда строит ПОЛНЫЙ массив от issueDate до последнего платежа (N+1 дат).
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
 * Подсчитать пропущенный (непогашенный) основной долг
 * в периодах odGrace до untilPeriod (включительно).
 * Используется только для EQUAL_PRINCIPAL + FIRST_PAYMENT.
 */
function _calculateSkippedPrincipal(loan, untilPeriod) {

    if (loan.paymentMethod !== PaymentMethod.EQUAL_PRINCIPAL) {
        return 0;
    }

    const regularPrincipal = Money.round(loan.principal / loan.term);
    let skipped = 0;

    for (let p = 1; p <= untilPeriod; p++) {
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
 * Используется для EQUAL_PRINCIPAL когда есть grace-периоды:
 * базовая доля ОД = principal / normalCount.
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
 * Подсчитать кол-во НОРМАЛЬНЫХ (не-odGrace) периодов начиная с fromPeriod
 * до конца графика (включительно).
 * Используется в ALL_NEXT_PAYMENTS для пересчёта доли ОД после льготы.
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
