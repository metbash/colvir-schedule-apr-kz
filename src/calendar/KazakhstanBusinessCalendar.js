function pad(n) {
    return String(n).padStart(2, "0");
}

function toIsoLocal(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cloneDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    const d = cloneDate(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Праздники, которые Colvir НЕ переносит на следующий рабочий день
 * даже если они выпали на выходной.
 * Colvir просто учитывает саму дату праздника — платёж в этот день
 * НЕ сдвигается (перенесённый выходной игнорируется).
 */
const NO_OBSERVED_SHIFT_MMDD = new Set([
    "05-09"   // День Победы — Colvir не учитывает перенос
]);

export default class KazakhstanBusinessCalendar {
    constructor(options = {}) {
        this.dynamicHolidayOverrides = {
            2026: ["2026-05-27"],
            2027: ["2027-05-16"],
            ...(options.dynamicHolidayOverrides || {})
        };
    }

    isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    getFixedHolidayDates(year) {
        return [
            `${year}-01-01`,
            `${year}-01-02`,
            `${year}-01-07`,
            `${year}-03-08`,
            `${year}-03-21`,
            `${year}-03-22`,
            `${year}-03-23`,
            `${year}-05-01`,
            `${year}-05-07`,
            `${year}-05-09`,
            `${year}-07-06`,
            `${year}-08-30`,
            `${year}-10-25`,
            `${year}-12-16`
        ];
    }

    getDynamicHolidayDates(year) {
        return this.dynamicHolidayOverrides[year] || [];
    }

    getBaseHolidayDates(year) {
        return [
            ...this.getFixedHolidayDates(year),
            ...this.getDynamicHolidayDates(year)
        ];
    }

    getObservedHolidayDates(year) {
        const baseDates = this.getBaseHolidayDates(year);
        const observed = new Set();

        for (const iso of baseDates) {
            const d = new Date(iso + "T00:00:00");
            const mmdd = iso.slice(5); // "MM-DD"

            // Рождество и динамические праздники не переносим
            if (iso.endsWith("-01-07")) continue;

            const isDynamic = this.getDynamicHolidayDates(year).includes(iso);
            if (isDynamic) continue;

            // Праздники из списка NO_OBSERVED_SHIFT тоже не переносим —
            // Colvir учитывает только саму дату, перенесённый выходной игнорирует
            if (NO_OBSERVED_SHIFT_MMDD.has(mmdd)) continue;

            const day = d.getDay();
            if (day === 6 || day === 0) {
                let next = cloneDate(d);
                do {
                    next = addDays(next, 1);
                } while (
                    this.isWeekend(next) ||
                    baseDates.includes(toIsoLocal(next)) ||
                    observed.has(toIsoLocal(next))
                );

                observed.add(toIsoLocal(next));
            }
        }

        return [...observed];
    }

    getHolidaySet(year) {
        return new Set([
            ...this.getBaseHolidayDates(year),
            ...this.getObservedHolidayDates(year)
        ]);
    }

    isHoliday(date) {
        const iso = toIsoLocal(date);
        return this.getHolidaySet(date.getFullYear()).has(iso);
    }

    isWorkingDay(date) {
        return !this.isWeekend(date) && !this.isHoliday(date);
    }

    moveToNextWorkingDay(date) {
        let d = cloneDate(date);
        while (!this.isWorkingDay(d)) {
            d = addDays(d, 1);
        }
        return d;
    }

    adjustPaymentDate(plannedDate) {
        return this.moveToNextWorkingDay(plannedDate);
    }
}
