/**
 * Return a greeting for the user's local hour.
 *
 * @param {number} hour an integer from 0 through 23
 */
export function greetingForHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("hour must be an integer from 0 through 23");
  }

  if (hour < 5) return "夜深了，账目一切清楚。";
  if (hour < 11) return "早上好，账目一切清楚。";
  if (hour < 14) return "中午好，账目一切清楚。";
  if (hour < 18) return "下午好，账目一切清楚。";
  return "晚上好，账目一切清楚。";
}
