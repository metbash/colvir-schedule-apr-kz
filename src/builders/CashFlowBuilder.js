/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * CashFlowBuilder.js
 * ==========================================================
 */

import CashFlow from "../models/CashFlow.js";
import CashFlowSet from "../models/CashFlowSet.js";
import Validation from "../core/Validation.js";

export default class CashFlowBuilder {

    /**
     * Построить cash-flow набор из loan, schedule и fees.
     *
     * fees:
     * [
     *   { date: Date, amount: number, description?: string, metadata?: object }
     * ]
     */
    static fromLoanAndSchedule(
        loan,
        schedule,
        options = {}
    ) {

        if (!loan) {
            throw new Error(
                "loan is required."
            );
        }

        if (!schedule) {
            throw new Error(
                "schedule is required."
            );
        }

        const fees = Array.isArray(options.fees)
            ? options.fees
            : [];

        const flows = [];

        flows.push(
            new CashFlow({
                date: loan.issueDate,
                amount: loan.principal,
                type: "DISBURSEMENT",
                metadata: {
                    source: "loan"
                }
            })
        );

        for (const row of schedule.rows) {

            const isIssueRow =
                row.metadata &&
                row.metadata.kind === "ISSUE";

            if (isIssueRow) {
                continue;
            }

            if (row.payment <= 0) {
                continue;
            }

            flows.push(
                new CashFlow({
                    date: row.paymentDate,
                    amount: -row.payment,
                    type: "SCHEDULE_PAYMENT",
                    metadata: {
                        period: row.period,
                        rowType: row.rowType
                    }
                })
            );

        }

        for (const fee of fees) {

            if (!fee) {
                continue;
            }

            Validation.requireDate(
                "fee.date",
                fee.date
            );

            Validation.requirePositiveOrZero(
                "fee.amount",
                fee.amount
            );

            if (fee.amount === 0) {
                continue;
            }

            flows.push(
                new CashFlow({
                    date: fee.date,
                    amount: -fee.amount,
                    type: "FEE",
                    metadata: {
                        description:
                            fee.description || null,
                        ...(fee.metadata || {})
                    }
                })
            );

        }

        return new CashFlowSet(
            flows
        ).sorted();

    }

}