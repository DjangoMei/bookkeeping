import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.LEDGER_TEST_URL;

test("mutual gifts are shared, recipient-maintained, and separate from private large expenses", { skip: !base }, async () => {
  const url = new URL(base);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Run these write checks only against a local test database.");
  const passphrase = process.env.LEDGER_TEST_PASSPHRASE;
  assert.ok(passphrase, "Supply the local test passphrase through the environment.");
  const cookies = {};
  const created = [];
  const request = (role, path, method = "GET", payload) => fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(15_000), headers: { Cookie: cookies[role] ?? "", "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const payload = { kind: "partner_gift", title: `API test fixture ${Date.now()}`, amount: "123.45", category: "日常惊喜", entryDate: "2026-10-27", detail: "Disposable local API test" };
  try {
    for (const role of ["zcy", "django"]) {
      const login = await request(role, "/api/session", "POST", { role, passphrase });
      assert.equal(login.status, 200);
      cookies[role] = login.headers.get("set-cookie").split(";")[0];
    }
    const add = await request("zcy", "/api/ledger", "POST", { ...payload, owner: "django", createdByRole: "django" });
    assert.equal(add.status, 201);
    const { entry } = await add.json();
    created.push({ role: "zcy", id: entry.id });
    assert.equal(entry.owner, "zcy", "The authenticated recipient determines ownership, never client input.");
    assert.equal(entry.createdByRole, "zcy");
    for (const role of ["zcy", "django"]) {
      const response = await request(role, "/api/ledger");
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.ok(response.headers.get("vary").split(/,\s*/).includes("Cookie"));
      assert.ok((await response.json()).entries.some(item => item.id === entry.id));
    }
    assert.equal((await request("django", `/api/ledger?id=${entry.id}`, "PATCH", { ...payload, amount: "999" })).status, 404);
    assert.equal((await request("django", `/api/ledger?id=${entry.id}`, "DELETE")).status, 404);
    assert.equal((await request("zcy", `/api/ledger?id=${entry.id}`, "PATCH", { owner: "django" })).status, 404);
    const edit = await request("zcy", `/api/ledger?id=${entry.id}`, "PATCH", { ...payload, amount: "200.01" });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).entry.amountCents, 20001);
    assert.equal((await request("zcy", "/api/ledger", "POST", { ...payload, amount: "-1" })).status, 400);
    const privateAdd = await request("zcy", "/api/ledger", "POST", { ...payload, kind: "large_expense" });
    assert.equal(privateAdd.status, 201);
    const privateEntry = (await privateAdd.json()).entry;
    created.push({ role: "zcy", id: privateEntry.id });
    const otherView = await request("django", "/api/ledger");
    assert.ok(!(await otherView.json()).entries.some(item => item.id === privateEntry.id));
    assert.equal((await request("zcy", `/api/ledger?id=${entry.id}`, "DELETE")).status, 200);
    const after = await request("django", "/api/ledger");
    assert.ok(!(await after.json()).entries.some(item => item.id === entry.id));
  } finally {
    for (const { role, id } of created) await request(role, `/api/ledger?id=${id}`, "DELETE");
  }
});
