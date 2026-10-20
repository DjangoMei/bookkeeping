import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import test from "node:test";
import { verifyPassphrase } from "../app/passphrase-verifier.js";

const password = "fixture-only-private-passphrase";
const salt = "00112233445566778899aabbccddeeff";
const verifier = {
  algorithm: "PBKDF2-SHA256", iterations: 100000, salt,
  hash: pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex"),
};

test("accepts only the configured primary passphrase, exactly as entered", async () => {
  assert.equal(await verifyPassphrase(password, verifier), true);
  for (const candidate of [password.toUpperCase(), `${password} `, "old-passphrase", "", null, {}, "x".repeat(513)]) {
    assert.equal(await verifyPassphrase(candidate, verifier), false);
  }
});

test("fails closed when the verifier is changed or malformed", async () => {
  for (const change of [{ algorithm: "SHA-256" }, { iterations: 1 }, { salt: "" }, { hash: "00".repeat(32) }, { hash: "invalid" }]) {
    assert.equal(await verifyPassphrase(password, { ...verifier, ...change }), false);
  }
});
