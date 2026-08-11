/**
 * Return a greeting for the user's local hour.
 *
 * @param {number} hour an integer from 0 through 23
 */
export function greetingForHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("hour must be an integer from 0 through 23");
  }

  if (hour < 5) return "夜猫子还没睡呀？";
  if (hour < 11) return "早呀，今天也元气满满！";
  if (hour < 14) return "午安，先吃饭再记账！";
  if (hour < 18) return "下午好，来收集今天的小日子！";
  return "晚上好，把今天装进小账本吧！";
}
