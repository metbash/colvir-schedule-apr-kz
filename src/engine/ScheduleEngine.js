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

        let balance = Money.round(loan.principal);
        let prevDate = DateUtils.clone(loan.issueDate);
        const totalPeriods = loan.term;
        const distributionMode = loan.distributionMode || DistributionMode.FIRST_PAYMENT;

        let deferredPrincipal = 0;
        let deferredInterest = 0;

        for (let period = 1; period <= totalPeriods; period++) {
            const paymentDate = DateUtils.addMonths(loan.firstPaymentDate, period - 1);
            const days = PeriodCalculator.calculate(prevDate, paymentDate).days;

            const grace = loan.gracePeriods.find(g => g.includes(period));
            const openingBalance = balance;

            let plannedInterest = InterestCalculator.calculate(
                openingBalance,
                loan.annualRate,
                days
            );

            let plannedPrincipal = calculatePrincipalPart(
                loan.paymentMethod,
                openingBalance,
                loan.annualRate,
                totalPeriods - period + 1,
                loan.term
            );

            if (period === totalPeriods) {
                plannedPrincipal = openingBalance;
            }

            plannedPrincipal = Math.min(Money.round(plannedPrincipal), openingBalance);

            let principal = plannedPrincipal;
            let interest = plannedInterest;
            let rowType = RowType.NORMAL;

            if (grace) {
                rowType = RowType.GRACE;

                if (grace.odGrace) {
                    deferredPrincipal = Money.add(deferredPrincipal, plannedPrincipal);
                    principal = 0;
                }

                if (grace.percentGrace) {
                    deferredInterest = Money.add(deferredInterest, plannedInterest);
                    interest = 0;
                }
            } else {
                const remainingPeriods = totalPeriods - period + 1;

                if (distributionMode === DistributionMode.FIRST_PAYMENT) {
                    if (deferredPrincipal > 0 || deferredInterest > 0) {
                        principal = Money.add(principal, deferredPrincipal);
                        interest = Money.add(interest, deferredInterest);
                        deferredPrincipal = 0;
                        deferredInterest = 0;
                    }
                }

                if (distributionMode === DistributionMode.ALL_NEXT_PAYMENTS) {
                    if (remainingPeriods > 0) {
                        if (deferredPrincipal > 0) {
                            let principalShare = Money.round(deferredPrincipal / remainingPeriods);
                            if (period === totalPeriods) principalShare = deferredPrincipal;
                            principal = Money.add(principal, principalShare);
                            deferredPrincipal = Money.subtract(deferredPrincipal, principalShare);
                        }

                        if (deferredInterest > 0) {
                            let interestShare = Money.round(deferredInterest / remainingPeriods);
                            if (period === totalPeriods) interestShare = deferredInterest;
                            interest = Money.add(interest, interestShare);
                            deferredInterest = Money.subtract(deferredInterest, interestShare);
                        }
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
                    deferredPrincipal,
                    deferredInterest,
                    distributionMode
                }
            }));

            balance = closingBalance;
            prevDate = paymentDate;
        }

        return new Schedule(rows);
    }
}

function calculatePrincipalPart(paymentMethod, openingBalance, annualRate, remainingPeriods, totalPeriods) {
    if (paymentMethod === PaymentMethod.ANNUITY) {
        const annuityPayment = PaymentCalculator.calculateAnnuity(
            openingBalance,
            annualRate,
            remainingPeriods
        );
        const monthRate = annualRate / 100 / 12;
        const interest = Money.round(openingBalance * monthRate);
        return Money.round(annuityPayment - interest);
    }

    const equalPrincipal = PaymentCalculator.calculateEqualPrincipal(openingBalance, remainingPeriods);
    return Money.round(equalPrincipal);
}