const DAY = 86_400_000;

/** Start of a rolling window N days back. Kept out of component bodies on purpose. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

export function isWithinDays(date: Date, days: number): boolean {
  return date > daysAgo(days);
}
