/**
 * Month arithmetic for the monthly timesheet.
 *
 * Pure and in `lib/` rather than in the service, so it can be unit-tested
 * without a database connection — the same reason `mentions.ts` lives here.
 *
 * Everything is computed in UTC and rendered with `toISOString`. `time_log.spent_on`
 * is a DATE column, so a local-time calculation on a machine in a negative-offset
 * timezone would shift every day label by one — which is exactly the kind of bug
 * that only shows up for some users.
 */

export type MonthRange = {
  month: string;
  /** Inclusive start, 00:00:00.000 UTC on the 1st. */
  from: Date;
  /** Inclusive end, 23:59:59.999 UTC on the last day. */
  to: Date;
  /** Every day in the month as YYYY-MM-DD. */
  days: string[];
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: string): boolean {
  return typeof month === "string" && MONTH_PATTERN.test(month);
}

/** Current month as YYYY-MM. */
export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Expand `YYYY-MM` into its inclusive range and day list.
 * Throws on a malformed month rather than guessing.
 */
export function resolveMonth(month: string): MonthRange {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new Error(`Invalid month "${month}" — expected YYYY-MM.`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  // Day 0 of the NEXT month is the last day of this one — handles 28/29/30/31
  // without a lookup table or a leap-year special case.
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const days: string[] = [];
  for (let day = 1; day <= dayCount; day += 1) {
    days.push(`${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`);
  }

  return {
    month,
    from: new Date(`${days[0]}T00:00:00.000Z`),
    to: new Date(`${days[days.length - 1]}T23:59:59.999Z`),
    days,
  };
}

/**
 * Shift a month by N months, forwards or backwards, crossing year boundaries.
 * Never lands on an invalid date because it always builds from day 1.
 */
export function shiftMonth(month: string, delta: number): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new Error(`Invalid month "${month}" — expected YYYY-MM.`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  return new Date(Date.UTC(year, monthIndex + delta, 1))
    .toISOString()
    .slice(0, 7);
}
