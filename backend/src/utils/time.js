export function getCurrentSeason(date = new Date()) {
  const month = date.getUTCMonth() + 1;

  if ([3, 4, 5, 6].includes(month)) {
    return "SUMMER";
  }
  if ([7, 8, 9].includes(month)) {
    return "MONSOON";
  }
  return "WINTER";
}

export function hoursBetween(start, end) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60));
}

export function sameWeeklySlot(date, targetDate) {
  const source = new Date(date);
  const target = new Date(targetDate);
  return source.getUTCDay() === target.getUTCDay() && source.getUTCHours() === target.getUTCHours();
}

