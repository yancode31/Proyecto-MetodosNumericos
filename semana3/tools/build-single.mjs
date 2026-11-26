// Empaqueta TODO (HTML + CSS + JavaScript) en un único archivo que funciona con doble clic (file://), sin servidor.
// Uso: node tools/build-single.mjs [salida.html]   (por defecto escribe index.html en la raíz del repositorio)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require('/opt/npm-tools/node_modules/esbuild'); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || `${root}/../index.html`);
const js = esbuild.buildSync({ entryPoints: [`${root}/assets/ui/app.js`], bundle: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' }).outputFiles[0].text;
const css = readFileSync(`${root}/assets/styles.css`, 'utf8');
let html = readFileSync(`${root}/index.html`, 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script>\n${js.replaceAll('</script', '<\\/script')}\n</script>`);
if (/(src|href)="\.\/assets/.test(html)) throw new Error('Quedaron referencias externas en el HTML.');
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html);
console.log(`OK → ${out} (${(html.length / 1024).toFixed(0)} KB)`);
