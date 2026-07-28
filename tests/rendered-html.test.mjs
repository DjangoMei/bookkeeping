import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("produces a deployable Sites worker build", async () => {
  await Promise.all([
    access(new URL("dist/server/index.js", projectRoot)),
    access(new URL("dist/.openai/hosting.json", projectRoot)),
    access(new URL("dist/.openai/drizzle/0000_optimal_dust.sql", projectRoot)),
  ]);
});

test("keeps browser API calls and session cookies under /bookkeeping", async () => {
  const [config, client, auth] = await Promise.all([
    readFile(new URL("next.config.ts", projectRoot), "utf8"),
    readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8"),
    readFile(new URL("app/auth-session.ts", projectRoot), "utf8"),
  ]);

  assert.match(config, /basePath:\s*BASE_PATH/);
  assert.match(client, /withBasePath\("\/api\/ledger"\)/);
  assert.match(client, /withBasePath\("\/api\/session"\)/);
  assert.match(auth, /Path=\$\{BASE_PATH\}/);
});

test("initializes authentication and ledger data with one request", async () => {
  const client = await readFile(
    new URL("app/ledger-app.tsx", projectRoot),
    "utf8",
  );

  assert.match(client, /load\(\{ allowUnauthenticated: true \}\)/);
  assert.doesNotMatch(
    client,
    /fetch\(withBasePath\("\/api\/session"\)\);/,
  );
  assert.doesNotMatch(client, /if \(sessionChecking\) \{/);
  assert.match(client, /正在检查已保存的登录状态/);
});
