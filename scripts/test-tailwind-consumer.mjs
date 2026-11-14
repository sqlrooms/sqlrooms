import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  access,
} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'sqlrooms-tailwind-'));
const consumer = path.join(temporary, 'consumer');
const env = {...process.env, pnpm_config_verify_deps_before_run: 'false'};
function pnpm(args, cwd = consumer) {
  return execFileSync('pnpm', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
}
async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

try {
  execFileSync(
    process.execPath,
    ['scripts/generate-tailwind-sources.mjs', '--check'],
    {cwd: root, stdio: 'inherit'},
  );
  await cp(path.join(root, 'tests/tailwind-consumer'), consumer, {
    recursive: true,
  });
  await writeFile(
    path.join(consumer, '.gitignore'),
    'node_modules\ndist\ndist-ssr\n',
  );
  const manifest = await json(path.join(consumer, 'package.json'));
  const packages = new Map();
  for (const directory of await readdir(path.join(root, 'packages'))) {
    const base = path.join(root, 'packages', directory);
    try {
      const pkg = await json(path.join(base, 'package.json'));
      packages.set(pkg.name, {base, pkg});
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  // Pack the actual dependency graph; overrides replace registry versions with
  // these tarballs without exposing transitive packages as direct dependencies.
  const graph = new Map();
  function visit(name) {
    if (graph.has(name) || !packages.has(name)) return;
    const entry = packages.get(name);
    graph.set(name, entry);
    for (const dependency of Object.keys(entry.pkg.dependencies ?? {}))
      visit(dependency);
  }
  Object.keys(manifest.dependencies).forEach(visit);
  const tarballs = path.join(temporary, 'tarballs');
  await mkdir(tarballs);
  const overrides = {};
  for (const [name, {base, pkg}] of graph) {
    await access(path.join(base, pkg.main)); // Packages must have been built first.
    pnpm(['pack', '--pack-destination', tarballs], base);
    overrides[name] =
      `file:${path.join(tarballs, `${name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`)}`;
  }
  async function writeOverrides() {
    await writeFile(
      path.join(consumer, 'pnpm-workspace.yaml'),
      JSON.stringify({
        packages: [],
        overrides,
        nodeLinker: 'isolated',
        autoInstallPeers: true,
      }),
    );
  }
  await writeOverrides();
  await writeFile(
    path.join(consumer, 'package.json'),
    JSON.stringify(manifest, null, 2),
  );
  await writeFile(
    path.join(consumer, '.npmrc'),
    'node-linker=isolated\nauto-install-peers=true\n',
  );
  console.log(
    `Installing consumer with ${graph.size} locally packed packages: ${consumer}`,
  );
  pnpm(['install', '--ignore-scripts', '--no-frozen-lockfile']);
  await assert.rejects(
    access(path.join(consumer, 'node_modules/@sqlrooms/schema-tree')),
  );

  const require = createRequire(path.join(consumer, 'package.json'));
  const {chromium} = require('playwright');
  const {preview} = await import(require.resolve('vite'));
  const browser = await chromium.launch({headless: true});
  const stylesheet = path.join(consumer, 'src/index.css');
  const inputCss = await readFile(stylesheet, 'utf8');
  async function build() {
    pnpm(['exec', 'vite', 'build', '--logLevel', 'error']);
    const assets = path.join(consumer, 'dist/assets');
    const files = (await readdir(assets)).filter((file) =>
      file.endsWith('.css'),
    );
    return (
      await Promise.all(
        files.map((file) => readFile(path.join(assets, file), 'utf8')),
      )
    ).join('\n');
  }
  async function checkRows(mode) {
    const server = await preview({root: consumer, preview: {port: 0}});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(server.resolvedUrls.local[0]);
      const label = page.locator('[title="trips"]');
      await label.waitFor({state: 'visible'});
      const row = page.locator('.min-h-5\\.5');
      const measure = () =>
        row.evaluate((element) => {
          const label = element.querySelector('[title="trips"]');
          const bounds = element.getBoundingClientRect();
          const text = label.getBoundingClientRect();
          return {
            height: bounds.height,
            visible:
              text.height > 0 &&
              text.top >= bounds.top &&
              text.bottom <= bounds.bottom,
          };
        });
      const normal = await measure();
      if (process.env.KEEP_TAILWIND_CONSUMER)
        await page.screenshot({
          path: path.join(temporary, `${mode.replaceAll(' ', '-')}.png`),
        });
      assert.equal(normal.height, 22, `${mode}: default row height`);
      assert(normal.visible, `${mode}: table name is not clipped`);
      const menu = row.locator('[aria-haspopup="menu"]');
      // The actions wrapper must hide at rest and reveal on group hover.
      const actions = row.locator('.opacity-0');
      assert.equal(
        await actions.evaluate((el) => getComputedStyle(el).opacity),
        '0',
      );
      await row.hover();
      assert.equal(
        await actions.evaluate((el) => getComputedStyle(el).opacity),
        '1',
      );
      assert.equal(
        await menu.evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(51, 102, 153)',
      );
      await menu.click();
      await page
        .getByRole('menuitem', {name: 'Copy table name', exact: true})
        .waitFor({state: 'visible'});
      await page.keyboard.press('Escape');
      await row.evaluate((el) => {
        el.style.fontSize = '20px';
        el.style.lineHeight = '30px';
      });
      const large = await measure();
      assert(
        large.height >= 32 && large.visible,
        `${mode}: row grows with larger text`,
      );
      await row.evaluate((el) => {
        el.removeAttribute('style');
        el.classList.add('h-10');
      });
      assert.equal(
        (await measure()).height,
        40,
        `${mode}: consumer height utility wins`,
      );
      assert.deepEqual(errors, [], `${mode}: no runtime errors`);
      console.log(
        `${mode}: visible 22px rows, adaptive text, themed hover actions, utility override verified.`,
      );
    } finally {
      await page.close();
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
  try {
    // Negative control: scanning only public, directly linked packages misses
    // schema-tree. HTML/JS fixtures never repeat its utility class strings.
    await writeFile(
      stylesheet,
      inputCss.replace(
        /@import '@sqlrooms\/(sql-editor|room-shell)\/tailwind.css';\n/g,
        '',
      ) + '\n@source "../node_modules/@sqlrooms/*/dist/**/*.{js,mjs,cjs}";\n',
    );
    const missing = await build();
    assert(
      !missing.includes('.min-h-5\\.5'),
      'negative control must miss row height',
    );
    assert(
      !missing.includes('group-hover\\/treenode'),
      'negative control must miss transitive actions',
    );
    await writeFile(stylesheet, inputCss);
    const published = await build();
    assert(
      published.includes('.min-h-5\\.5'),
      'published row minimum-height utility',
    );
    assert(
      published.includes('group-hover\\/treenode'),
      'published actions hover utility',
    );
    assert(
      !published.includes('.bg-fuchsia-950'),
      'unused utilities are not emitted',
    );
    await checkRows('published');
    pnpm([
      'exec',
      'vite',
      'build',
      '--ssr',
      'src/App.jsx',
      '--outDir',
      'dist-ssr',
      '--logLevel',
      'error',
    ]);
    const {default: App} = await import(
      pathToFileURL(path.join(consumer, 'dist-ssr/App.js')).href
    );
    const {renderToStaticMarkup} = require('react-dom/server');
    const React = require('react');
    const html = renderToStaticMarkup(React.createElement(App));
    assert(html.includes('trips'), 'SSR renders the transitive schema tree');
    console.log('SSR schema tree rendering verified.');

    // Workspace CSS resolves through normal package links. Exclude compiled
    // output explicitly to prove changes to src alone are discovered.
    for (const [name, {base}] of graph) overrides[name] = `link:${base}`;
    await writeOverrides();
    pnpm(['install', '--ignore-scripts', '--no-frozen-lockfile']);
    const exclusions = [...graph.values()]
      .map(({base}) => `@source not "${base}/dist/**";`)
      .join('\n');
    await writeFile(stylesheet, `${inputCss}\n${exclusions}\n`);
    const workspace = await build();
    assert(
      workspace.includes('.min-h-5\\.5') &&
        workspace.includes('group-hover\\/treenode'),
    );
    await checkRows('workspace sources');

    // Compile every generated entry, including packages with export maps that
    // are outside the SQL editor graph. This does not import their JavaScript.
    const allEntries = [];
    for (const {base} of packages.values()) {
      try {
        await access(path.join(base, 'tailwind.css'));
        allEntries.push(`@import "${base}/tailwind.css";`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    await writeFile(stylesheet, `${allEntries.join('\n')}\n${inputCss}`);
    await build();
    console.log(`Compiled all ${allEntries.length} package CSS entries.`);
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error.stdout ?? '', error.stderr ?? '');
  throw error;
} finally {
  if (process.env.KEEP_TAILWIND_CONSUMER) console.log(`Retained ${temporary}`);
  else await rm(temporary, {recursive: true, force: true});
}
