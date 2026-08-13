import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("produces a deployable Sites worker build", async () => {
  await Promise.all([
    access(new URL("dist/server/index.js", projectRoot)),
    access(new URL("dist/client/bookkeeping/assets", projectRoot)),
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
  assert.match(client, /正在翻开小账本/);
});

test("renders the overview greeting from the user's local time", async () => {
  const client = await readFile(
    new URL("app/ledger-app.tsx", projectRoot),
    "utf8",
  );

  assert.match(client, /greetingForHour\(new Date\(\)\.getHours\(\)\)/);
  assert.match(client, /activeMeta\?\.title \?\? greeting/);
  assert.doesNotMatch(client, /activeMeta\?\.title \?\? "晚上好/);
});

test("keeps large expenses private to their assigned user", async () => {
  const [client, ledgerRoute, seed] = await Promise.all([
    readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/ledger/route.ts", projectRoot), "utf8"),
    readFile(new URL("db/feishu-seed.ts", projectRoot), "utf8"),
  ]);

  assert.match(
    ledgerRoute,
    /kind === "income" \|\| kind === "large_expense" \? role : "family"/,
  );
  assert.match(ledgerRoute, /export async function PATCH\(request: Request\)/);
  assert.match(ledgerRoute, /eq\(ledgerEntries\.kind, "large_expense"\)/);
  assert.match(client, /pendingLargeEntries/);
  assert.match(client, /entry\.owner === role/);
  assert.match(client, /entry\.owner === "family"/);
  assert.match(client, /entriesVisibleToRole/);
  assert.match(seed, /largeExpense\("zcy", "feishu-large"/);
  assert.match(seed, /largeExpense\("django", "feishu-large-django"/);
  assert.match(seed, /ON CONFLICT\(source_key\) DO UPDATE SET/);
  assert.match(seed, /ledger_entries\.owner = 'family'/);
  assert.match(client, /method: "PATCH"/);
  assert.match(
    client,
    /kindToAdd === "income" \|\| kindToAdd === "large_expense"/,
  );
});

test("keeps saving and mascot loading lightweight", async () => {
  const [client, database, worker] = await Promise.all([
    readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8"),
    readFile(new URL("db/index.ts", projectRoot), "utf8"),
    readFile(new URL("worker/index.ts", projectRoot), "utf8"),
  ]);

  assert.match(client, /setEntries\(\(current\) =>/);
  assert.doesNotMatch(client, /closeModal\(\);\s*await load\(\);/);
  assert.match(client, /mascot-cutouts\/00-character-base\.webp/);
  assert.doesNotMatch(client, /mascot-cutouts\/00-character-base\.png/);
  assert.match(database, /ledgerSchemaPromise \?\?=/);
  assert.match(database, /familyFinanceSchemaPromise \?\?=/);
  assert.match(database, /seedFeishuEntries/);
  const seed = await readFile(new URL("db/feishu-seed.ts", projectRoot), "utf8");
  assert.match(seed, /imported_count/);
  assert.match(seed, /legacy_large_count/);
  assert.match(worker, /stale-while-revalidate=86400/);
});

test("redirects the bare base path to its canonical trailing-slash URL", async () => {
  const [viteConfig, worker] = await Promise.all([
    readFile(new URL("vite.config.ts", projectRoot), "utf8"),
    readFile(new URL("worker/index.ts", projectRoot), "utf8"),
  ]);

  assert.match(viteConfig, /name:\s*"base-path-redirect"/);
  assert.match(viteConfig, /response\.statusCode\s*=\s*308/);
  assert.match(
    viteConfig,
    /response\.setHeader\("Location", `\$\{BASE_PATH\}\/\$\{requestUrl\.search\}`\)/,
  );
  assert.match(worker, /if \(url\.pathname === BASE_PATH\)/);
  assert.match(worker, /Response\.redirect\(url\.toString\(\), 308\)/);
});

test("serves production traffic from the built Worker instead of Vite HMR", async () => {
  const [packageJson, stableServer, hotServer, viteConfig] = await Promise.all([
    readFile(new URL("package.json", projectRoot), "utf8").then(JSON.parse),
    readFile(new URL("scripts/serve-stable.mjs", projectRoot), "utf8"),
    readFile(new URL("scripts/serve-hot.mjs", projectRoot), "utf8"),
    readFile(new URL("vite.config.ts", projectRoot), "utf8"),
  ]);

  assert.equal(packageJson.scripts.dev, "node scripts/serve-stable.mjs");
  assert.equal(packageJson.scripts.start, "node scripts/serve-stable.mjs");
  assert.equal(packageJson.scripts["dev:hot"], "node scripts/serve-hot.mjs");
  assert.match(stableServer, /\[npmCli, "run", "build"\]/);
  assert.match(stableServer, /path\.join\("dist", "server", "wrangler\.json"\)/);
  assert.match(stableServer, /"--persist-to"/);
  assert.doesNotMatch(stableServer, /vinext dev/);
  assert.match(hotServer, /BOOKKEEPING_ENABLE_HMR:\s*"true"/);
  assert.match(viteConfig, /hmr:\s*enableHotReload/);
});

test("packages immutable client assets under the public base path", async () => {
  const [plugin, headers] = await Promise.all([
    readFile(new URL("build/sites-vite-plugin.ts", projectRoot), "utf8"),
    readFile(new URL("dist/client/_headers", projectRoot), "utf8"),
  ]);

  assert.match(plugin, /const basePathSegment = BASE_PATH/);
  assert.match(plugin, /await cp\(/);
  assert.match(headers, /\/bookkeeping\/assets\/\*/);
  assert.match(headers, /\/bookkeeping\/mascot-cutouts\/\*\.webp/);
  assert.match(headers, /stale-while-revalidate=86400/);
});

test("uses transparent Cola artwork across every ledger page", async () => {
  const client = await readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8");
  const cutouts = [
    "00-character-base.webp",
    "01-playing-blocks.webp",
    "02-reading-picture-book.webp",
    "03-drawing-playful-v2.webp",
    "04-watching-tv-excited-v2.webp",
    "05-playing-ball.webp",
    "06-bunny-tight-hug-v2.webp",
    "07-eating-cake.webp",
    "08-crying.webp",
    "09-angry.webp",
  ];

  await Promise.all(cutouts.map((name) => access(new URL(`public/mascot-cutouts/${name}`, projectRoot))));
  for (const name of cutouts) assert.match(client, new RegExp(name.replaceAll(".", "\\.")));
  assert.doesNotMatch(client, /\/mascot-scenes\//);
});

test("uses a clear rounded square system font without decorative webfonts", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");

  assert.match(css, /--round:\s*"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC"/);
  assert.match(css, /--display:\s*var\(--round\)/);
  assert.doesNotMatch(css, /@font-face|ZCOOL|Segoe Print|Bradley Hand|Comic Sans/);
});

test("keeps secondary pages in one explicit column without inherited overview areas", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  const client = await readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8");

  assert.match(css, /\.content-detail\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-areas:\s*\n\s*"detail-top"\s*\n\s*"detail-banner"\s*\n\s*"detail-records"/);
  assert.match(css, /\.content-detail \.topbar\s*\{\s*grid-area:\s*detail-top/);
  assert.match(css, /\.content-detail \.records-panel\s*\{\s*grid-area:\s*detail-records/);
  assert.doesNotMatch(client, /这是同一个可爱的小朋友/);
});

test("maps browser back and forward navigation to ledger page levels", async () => {
  const client = await readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8");

  assert.match(client, /window\.history\.replaceState\(\{ ledgerView: true, active: "overview", modal: null, editId: null \}/);
  assert.match(client, /window\.history\.replaceState\(nextState/);
  assert.match(client, /window\.history\.pushState\(nextState/);
  assert.match(client, /window\.history\.pushState\(\{ ledgerView: true, active, modal: nextKind, editId: null \}/);
  assert.match(client, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(client, /if \(current\?\.modal\) window\.history\.back\(\)/);
});

test("hydrates the authenticated role before client-side history restores the ledger", async () => {
  const [page, client, auth] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8"),
    readFile(new URL("app/auth-session.ts", projectRoot), "utf8"),
  ]);

  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /getSessionRoleFromCookieHeader/);
  assert.match(page, /<LedgerApp initialRole=\{initialRole\} \/>/);
  assert.match(client, /function LedgerApp\(\{ initialRole \}/);
  assert.match(client, /useState<Role>\(initialRole \?\? "zcy"\)/);
  assert.match(client, /useState\(initialRole !== null\)/);
  assert.match(auth, /getSessionRoleFromCookieHeader/);
});

test("allows editing records and tracks mother-paid child expenses", async () => {
  const [client, route, schema, db, seed, migration] = await Promise.all([
    readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/ledger/route.ts", projectRoot), "utf8"),
    readFile(new URL("db/schema.ts", projectRoot), "utf8"),
    readFile(new URL("db/index.ts", projectRoot), "utf8"),
    readFile(new URL("db/feishu-seed.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0002_slippery_random.sql", projectRoot), "utf8"),
  ]);

  assert.match(client, /function openEdit\(entry: Entry\)/);
  assert.match(client, /method: editingId \? "PATCH" : "POST"/);
  assert.match(client, /妈妈支付/);
  assert.match(client, /childMotherThisYear/);
  assert.match(route, /payer: kind === "child_expense"/);
  assert.match(schema, /payer: text\("payer"\)/);
  assert.match(db, /detail LIKE '%妈妈%'/);
  assert.match(migration, /detail` LIKE '%妈妈%'/);
  assert.match(seed, /detail\?\.includes\("妈妈"\) \? "mother" : "family"/);
  assert.match(migration, /ADD `payer` text DEFAULT 'family' NOT NULL/);
});

test("adds shared savings and large project workspaces", async () => {
  const [client, finance, route, schema, db, migration] = await Promise.all([
    readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8"),
    readFile(new URL("app/family-finance.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/family-finance/route.ts", projectRoot), "utf8"),
    readFile(new URL("db/schema.ts", projectRoot), "utf8"),
    readFile(new URL("db/index.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0003_certain_mystique.sql", projectRoot), "utf8"),
  ]);
  assert.match(client, /家庭存款/);
  assert.match(client, /大额专项/);
  assert.match(client, /<FamilyFinance/);
  assert.match(finance, /余额宝/);
  assert.match(finance, /新房装修/);
  assert.match(finance, /记一笔专项支出/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(schema, /savingsAccounts/);
  assert.match(schema, /familyProjects/);
  assert.match(schema, /projectExpenses/);
  assert.match(db, /INSERT INTO family_projects/);
  assert.match(db, /PRAGMA optimize/);
  assert.match(migration, /CREATE TABLE `savings_accounts`/);
  assert.match(migration, /idx_project_expenses_project_date/);
});
