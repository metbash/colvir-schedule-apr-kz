/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev5
 *
 * ScheduleEngine.js
 *
 * Матрица поведения при отсрочке:
 *
 * 1. odGrace=true (отсрочка ОД):
 *    Льготный период: principal=0, interest начисляется и платится.
 *    После:
 *      FIRST_PAYMENT     — весь пропущенный ОД добавляется к первому
 *                          нормальному платежу одной суммой поверх PMT/доли.
 *      ALL_NEXT_PAYMENTS — аннуитет: PMT пересчитывается от текущего баланса
 *                          (пропущенный ОД размазывается по оставшимся периодам).
 *                          Равные доли: доля пересчитывается от текущего баланса.
 *
 * 2. percentGrace=true (отсрочка процентов):
 *    Льготный период: PMT целиком идёт в ОД, interest=0 (накапливается).
 *    Накопленные проценты распределяются по distributionMode.
 *
 * 3. odGrace + percentGrace (полная отсрочка):
 *    Льготный период: principal=0, interest=0, payment=0.
 *    Накопленные проценты распределяются по distributionMode.
 *
 * distributionMode:
 *   FIRST_PAYMENT     — накопленные % / пропущенный ОД добавляются к первому
 *                       платежу после льготы.
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

            const actDays        = PeriodCalculator.calculate(prevDate, paymentDate).days;
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
                        deferredPrincipal = Money.add(deferredPrincipal, contrib);
                    }
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

                // Распределение deferredPrincipal (FIRST_PAYMENT, оба метода)
                if (deferredPrincipal > 0 && distributionMode === DistributionMode.FIRST_PAYMENT) {
                    principal = Money.add(principal, deferredPrincipal);
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
