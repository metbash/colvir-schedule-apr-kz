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

        rows.push(new PaymentRow({
            period: 0,
            paymentDate: DateUtils.clone(loan.issueDate),
            days: 0,
            openingBalance: loan.principal,
            principal: 0,
            interest: 0,
            payment: 0,
            closingBalance: loan.principal,
            rowType: RowType.NORMAL,
            metadata: { technical: true, kind: "ISSUE" }
        }));

        const totalPeriods = loan.term;
        const distributionMode = loan.distributionMode || DistributionMode.FIRST_PAYMENT;
        const isAnnuity = loan.paymentMethod === PaymentMethod.ANNUITY;

        let balance = Money.round(loan.principal);
        let prevDate = DateUtils.clone(loan.issueDate);

        let deferredInterest = 0;
        let afterGraceEqualPrincipal = null;
        let firstPaymentAfterOdGraceHandled = false;

        // Для аннуитета: базовый платёж считается ОДИН РАЗ и больше НЕ МЕНЯЕТСЯ
        // payment = annuityBasePayment = константа во всех периодах кроме последнего
        // Проценты: Act/360 по фактическим дням — совпадает с Colvir
        // principal = annuityBasePayment - interest — может немного гулять в каждом периоде
        let annuityBasePayment = isAnnuity
            ? PaymentCalculator.calculateAnnuity(loan.principal, loan.annualRate, totalPeriods)
            : 0;

        // Флаг пересчёта аннуитетного платежа после льготы по ОД (ALL_NEXT_PAYMENTS)
        let annuityRecalculated = false;

        for (let period = 1; period <= totalPeriods; period++) {
            let plannedDate;

            if (period === totalPeriods && loan.lastPaymentDate) {
                plannedDate = DateUtils.clone(loan.lastPaymentDate);
            } else {
                plannedDate = DateUtils.addMonths(loan.firstPaymentDate, period - 1);
            }

            const paymentDate = this.calendar
                ? this.calendar.adjustPaymentDate(plannedDate)
                : plannedDate;

            const days = PeriodCalculator.calculate(prevDate, paymentDate).days;
            const openingBalance = Money.round(balance);

            const grace = loan.gracePeriods.find(g =>
                g && typeof g.includes === "function" && g.includes(period)
            );

            const remainingPeriods = totalPeriods - period + 1;
            let rowType = RowType.NORMAL;

            // ────────────────────────────────────────────────────────────
            // ПРОЦЕНТЫ: одинаково для аннуитета и равных долей — Act/360
            // ────────────────────────────────────────────────────────────
            let interest = Money.round(
                InterestCalculator.calculate(openingBalance, loan.annualRate, days)
            );

            let principal;

            if (isAnnuity) {
                // ─── АННУИТЕТ ─────────────────────────────────────────
                if (period === totalPeriods) {
                    // Последний период: закрываем остаток полностью
                    principal = openingBalance;
                } else if (grace && grace.odGrace) {
                    // Льготный период по ОД — тело не погашаем
                    principal = 0;
                } else {
                    // Пересчёт annuityBasePayment после льготы по ОД (ALL_NEXT_PAYMENTS)
                    if (
                        !annuityRecalculated &&
                        distributionMode === DistributionMode.ALL_NEXT_PAYMENTS
                    ) {
                        const hadOdGraceBefore = loan.gracePeriods.some(g =>
                            g.odGrace && g.endPeriod < period
                        );
                        if (hadOdGraceBefore) {
                            annuityBasePayment = PaymentCalculator.calculateAnnuity(
                                openingBalance,
                                loan.annualRate,
                                remainingPeriods
                            );
                            annuityRecalculated = true;
                        }
                    }

                    // payment = annuityBasePayment (константа)
                    // principal = payment - interest (немного гуляет из-за Act/360)
                    principal = Money.round(annuityBasePayment - interest);
                    if (principal < 0) principal = 0;
                    if (principal > openingBalance) principal = openingBalance;
                }

            } else {
                // ─── РАВНЫЕ ДОЛИ — без изменений ────────────────
                if (afterGraceEqualPrincipal !== null) {
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(afterGraceEqualPrincipal);
                } else {
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(loan.principal / totalPeriods);
                }
            }

            // ────────────────────────────────────────────────────────────
            // ЛЬГОТНЫЕ ПЕРИОДЫ
            // ────────────────────────────────────────────────────────────
            if (grace) {
                rowType = RowType.GRACE;

                if (grace.odGrace) {
                    principal = 0;
                }

                if (grace.percentGrace) {
                    deferredInterest = Money.add(deferredInterest, interest);
                    interest = 0;
                }

            } else {
                // Первый платёж после льготы по ОД — равные доли, ALL_NEXT_PAYMENTS
                if (
                    distributionMode === DistributionMode.ALL_NEXT_PAYMENTS &&
                    !isAnnuity &&
                    afterGraceEqualPrincipal === null
                ) {
                    const hadOdGraceBefore = loan.gracePeriods.some(g =>
                        g.odGrace && g.endPeriod < period
                    );

                    if (hadOdGraceBefore) {
                        afterGraceEqualPrincipal = remainingPeriods > 0
                            ? Money.round(openingBalance / remainingPeriods)
                            : openingBalance;

                        principal = period === totalPeriods
                            ? openingBalance
                            : Money.round(afterGraceEqualPrincipal);
                    }
                }

                // Первый платёж после льготы по ОД — равные доли, FIRST_PAYMENT
                if (
                    distributionMode === DistributionMode.FIRST_PAYMENT &&
                    !isAnnuity &&
                    !firstPaymentAfterOdGraceHandled
                ) {
                    const hadOdGraceBefore = loan.gracePeriods.some(g =>
                        g.odGrace && g.endPeriod < period
                    );

                    if (hadOdGraceBefore) {
                        const skippedPrincipal = calculateSkippedPrincipalUntil(loan, period - 1);
                        if (skippedPrincipal > 0) {
                            principal = Money.add(principal, skippedPrincipal);
                        }
                        firstPaymentAfterOdGraceHandled = true;
                    }
                }

                // Распределение отложенных процентов
                if (deferredInterest > 0) {
                    if (distributionMode === DistributionMode.FIRST_PAYMENT) {
                        interest = Money.add(interest, deferredInterest);
                        deferredInterest = 0;
                    } else if (distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                        const share = period === totalPeriods
                            ? deferredInterest
                            : Money.round(deferredInterest / remainingPeriods);
                        interest = Money.add(interest, share);
                        deferredInterest = Money.subtract(deferredInterest, share);
                    }
                }

                // Аннуитет + FIRST_PAYMENT после льготы: отмечаем что уже обработали
                if (
                    isAnnuity &&
                    distributionMode === DistributionMode.FIRST_PAYMENT &&
                    !annuityRecalculated
                ) {
                    const hadOdGraceBefore = loan.gracePeriods.some(g =>
                        g.odGrace && g.endPeriod < period
                    );
                    if (hadOdGraceBefore) {
                        annuityRecalculated = true;
                    }
                }
            }

            // Финальные защиты
            if (principal < 0) principal = 0;
            if (principal > openingBalance) principal = openingBalance;

            let closingBalance = Money.round(openingBalance - principal);

            if (period === totalPeriods) {
                principal = openingBalance;
                closingBalance = 0;
            }

            const payment = Money.round(principal + interest);

            rows.push(new PaymentRow({
                period,
                paymentDate,
                days,
                openingBalance,
                principal: Money.round(principal),
                interest: Money.round(interest),
                payment,
                closingBalance,
                rowType,
                metadata: {
                    grace: !!grace,
                    distributionMode,
                    plannedDate,
                    adjustedDate: paymentDate,
                    annuityBasePayment: isAnnuity ? annuityBasePayment : null
                }
            }));

            balance = closingBalance;
            prevDate = paymentDate;
        }

        return new Schedule(rows);
    }
}

function calculateSkippedPrincipalUntil(loan, untilPeriod) {
    if (loan.paymentMethod !== PaymentMethod.EQUAL_PRINCIPAL) {
        return 0;
    }

    const regularPrincipal = Money.round(loan.principal / loan.term);
    let skipped = 0;

    for (let p = 1; p <= untilPeriod; p++) {
        const grace = loan.gracePeriods.find(g =>
            g && typeof g.includes === "function" && g.includes(p)
        );

        if (grace && grace.odGrace) {
            skipped = Money.add(skipped, regularPrincipal);
        }
    }

    return skipped;
}
