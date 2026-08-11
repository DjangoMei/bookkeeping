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
});

test("uses transparent Cola artwork across every ledger page", async () => {
  const client = await readFile(new URL("app/ledger-app.tsx", projectRoot), "utf8");
  const cutouts = [
    "00-character-base.png",
    "01-playing-blocks.png",
    "02-reading-picture-book.png",
    "03-drawing-playful-v2.png",
    "04-watching-tv-excited-v2.png",
    "05-playing-ball.png",
    "06-bunny-tight-hug-v2.png",
    "07-eating-cake.png",
    "08-crying.png",
    "09-angry.png",
  ];

  await Promise.all(cutouts.map((name) => access(new URL(`public/mascot-cutouts/${name}`, projectRoot))));
  for (const name of cutouts) assert.match(client, new RegExp(name.replaceAll(".", "\\.")));
  assert.doesNotMatch(client, /\/mascot-scenes\//);
});

test("limits the interface to two readable rounded font families", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");

  assert.match(css, /--display:\s*"Arial Rounded MT Bold", "Microsoft YaHei"/);
  assert.match(css, /--round:\s*"Microsoft YaHei", sans-serif/);
  assert.doesNotMatch(css, /Segoe Print|Bradley Hand|Comic Sans/);
});
