import assert from "node:assert/strict";
import test from "node:test";
import { greetingForHour } from "../app/time-greeting.js";

const cases = [
  [0, "夜猫子还没睡呀？"],
  [4, "夜猫子还没睡呀？"],
  [5, "早呀，今天也元气满满！"],
  [10, "早呀，今天也元气满满！"],
  [11, "午安，先吃饭再记账！"],
  [13, "午安，先吃饭再记账！"],
  [14, "下午好，来收集今天的小日子！"],
  [17, "下午好，来收集今天的小日子！"],
  [18, "晚上好，把今天装进小账本吧！"],
  [23, "晚上好，把今天装进小账本吧！"],
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
