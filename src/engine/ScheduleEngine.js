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

        let balance = Money.round(loan.principal);
        let prevDate = DateUtils.clone(loan.issueDate);

        let deferredInterest = 0;
        let afterGraceEqualPrincipal = null;
        let firstPaymentAfterOdGraceHandled = false;

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

            let principal;
            let interest = Money.round(
                InterestCalculator.calculate(openingBalance, loan.annualRate, days)
            );

            if (loan.paymentMethod === PaymentMethod.EQUAL_PRINCIPAL) {
                if (afterGraceEqualPrincipal !== null) {
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(afterGraceEqualPrincipal);
                } else {
                    principal = period === totalPeriods
                        ? openingBalance
                        : Money.round(loan.principal / totalPeriods);
                }
            } else {
                principal = calculateAnnuityPrincipal(
                    openingBalance,
                    loan.annualRate,
                    remainingPeriods
                );

                if (period === totalPeriods || principal > openingBalance) {
                    principal = openingBalance;
                }
            }

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
                if (
                    distributionMode === DistributionMode.ALL_NEXT_PAYMENTS &&
                    loan.paymentMethod === PaymentMethod.EQUAL_PRINCIPAL &&
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

                if (
                    distributionMode === DistributionMode.FIRST_PAYMENT &&
                    loan.paymentMethod === PaymentMethod.EQUAL_PRINCIPAL &&
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
            }

            if (principal > openingBalance) {
                principal = openingBalance;
            }

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
                    afterGraceEqualPrincipal
                }
            }));

            balance = closingBalance;
            prevDate = paymentDate;
        }

        return new Schedule(rows);
    }
}

function calculateAnnuityPrincipal(openingBalance, annualRate, remainingPeriods) {
    const payment = PaymentCalculator.calculateAnnuity(
        openingBalance,
        annualRate,
        remainingPeriods
    );
    const monthlyRate = annualRate / 100 / 12;
    const interestPart = Money.round(openingBalance * monthlyRate);
    return Money.round(payment - interestPart);
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