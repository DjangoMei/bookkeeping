import assert from "node:assert/strict";
import test from "node:test";
import { greetingForHour } from "../app/time-greeting.js";

const cases = [
  [0, "夜深了，账目一切清楚。"],
  [4, "夜深了，账目一切清楚。"],
  [5, "早上好，账目一切清楚。"],
  [10, "早上好，账目一切清楚。"],
  [11, "中午好，账目一切清楚。"],
  [13, "中午好，账目一切清楚。"],
  [14, "下午好，账目一切清楚。"],
  [17, "下午好，账目一切清楚。"],
  [18, "晚上好，账目一切清楚。"],
  [23, "晚上好，账目一切清楚。"],
];

test("chooses a greeting for each local-time boundary", () => {
  for (const [hour, expected] of cases) {
    assert.equal(greetingForHour(hour), expected);
  }
});

test("rejects invalid hours", () => {
  for (const hour of [-1, 24, 12.5, Number.NaN]) {
    assert.throws(() => greetingForHour(hour), RangeError);
  }
});
