export default class GracePeriod {
    constructor({
        startPeriod,
        endPeriod,
        odGrace = false,
        percentGrace = false
    }) {
        this.startPeriod = Number(startPeriod);
        this.endPeriod = Number(endPeriod);
        this.odGrace = Boolean(odGrace);
        this.percentGrace = Boolean(percentGrace);

        if (!Number.isInteger(this.startPeriod) || this.startPeriod < 1) {
            throw new Error("startPeriod must be integer >= 1.");
        }

        if (!Number.isInteger(this.endPeriod) || this.endPeriod < this.startPeriod) {
            throw new Error("endPeriod must be integer and >= startPeriod.");
        }

        if (!this.odGrace && !this.percentGrace) {
            throw new Error("At least one of odGrace or percentGrace must be true.");
        }

        Object.freeze(this);
    }

    includes(period) {
        return period >= this.startPeriod && period <= this.endPeriod;
    }
}