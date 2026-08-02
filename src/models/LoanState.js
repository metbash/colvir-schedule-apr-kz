import Money from "../core/Money.js";
import DateUtils from "../core/DateUtils.js";

export default class LoanState {
    constructor(loan) {
        if (!loan) {
            throw new Error("Loan is required.");
        }

        this.loan = loan;
        this.balance = Money.round(loan.principal);
        this.period = 0;
        this.currentDate = DateUtils.clone(loan.issueDate);
        this.rows = [];
    }

    addRow(row) {
        this.rows.push(row);
        this.period = row.period;
        this.balance = Money.round(row.closingBalance);
        this.currentDate = DateUtils.clone(row.paymentDate);
    }
}