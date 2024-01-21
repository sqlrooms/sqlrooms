import {exec} from 'child_process';
import * as esbuild from 'esbuild';
import path, {dirname} from 'path';
import {fileURLToPath} from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

await run('Cleaning build/ directory...', 'rm -rf build/');
await run('Generating ProjectConfig types...', 'yarn --cwd ../.. run gen:sdk');

// import inlineImportPlugin from './esbuild-inline-css-plugin';
import inlineCssImportPlugin from 'esbuild-plugin-inline-import';

console.log('> Building SDK...');
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: 'es6',
  format: 'esm',
  platform: 'browser',
  outfile: 'build/dist/index.js',
  define: {'process.env.NODE_ENV': '"production"'},
  // external: ['apache-arrow'],
  plugins: [
    // Include this plugin before others
    inlineCssImportPlugin({filter: /\?inline$/}),
  ],
});

await run('Compiling type declarations...', 'tsc --project tsconfig.dist.json');
await run('Copying public/ to build/...', [
  'cp ./public/** ./build/',
  'cp ./public/.npmignore ./build/',
]);

async function run(desc, cmd) {
  console.log(`\n> ${desc}`);
  for (const c of Array.isArray(cmd) ? cmd : [cmd]) {
    await execShellCommand(c);
  }
}

function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, {cwd: path.join(__dirname, '../')}, (error, stdout, stderr) => {
      if (error) {
        console.error(error.message);
        reject(error);
      }
      console.log(stdout);
      console.error(stderr);
      resolve(stdout ? stdout : stderr);
    });
  });
}
