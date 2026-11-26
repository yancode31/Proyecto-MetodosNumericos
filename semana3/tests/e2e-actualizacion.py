"""Prueba de extremo a extremo (navegador real) de la actualización dinámica.
Requiere:  pip install playwright && playwright install chromium     Ejecutar:  python tests/e2e-actualizacion.py
Comprueba, en los 4 módulos, que cada gráfico y métrica visibles coinciden con el cálculo del motor para
los parámetros que hay en el formulario, que los cambios sin ejecutar se marcan como desactualizados y que
guardar / recuperar / relanzar no mezcla datos de otra ejecución."""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('E2E_ROOT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
handler = functools.partial(Quiet, directory=ROOT)
httpd = socketserver.TCPServer(('127.0.0.1', 0), handler); threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{httpd.server_address[1]}/index.html'

CHECK_JS = """async () => {
  const { simulateCase, nfmt } = await import('/assets/cases/index.js'); const { chartSvg } = await import('/assets/ui/charts.js');
  const caseId = Number(location.hash.split('-')[1]); const scenario = document.querySelector('.scenario-option.selected').dataset.value;
  const params = {}; document.querySelectorAll('#parametersForm [name]').forEach((el) => { params[el.name] = Number(el.value); });
  const r = simulateCase(caseId, scenario, params); const out = { problems: [], plots: 0 };
  const hero = document.querySelector('.hero-metric .metric-main').textContent.trim();
  if (!hero.startsWith(nfmt(r.metric.value, 7))) out.problems.push(`métrica ${hero} ≠ ${nfmt(r.metric.value, 7)}`);
  const cards = [...document.querySelectorAll('.tab-body .chart-card')], expected = r.sections.flatMap((s) => s.plots);
  if (cards.length !== expected.length) out.problems.push(`gráficos ${cards.length} ≠ ${expected.length}`);
  cards.forEach((card, i) => { const tmp = document.createElement('div'); tmp.innerHTML = chartSvg(expected[i]); if (!expected[i] || card.querySelector('svg').outerHTML !== tmp.firstElementChild.outerHTML) out.problems.push(`gráfico «${expected[i]?.title}» no coincide con el cálculo actual`); });
  const h = (t) => { let x = 0; for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) | 0; return x; }; out.sig = h(cards.map((c) => c.querySelector('svg').outerHTML).join('')); out.plots = cards.length; out.metric = hero; out.params = params; out.scenario = scenario; return out; }"""

PLAN = {  # módulo: (nombre, [(parámetro, valor)] a modificar en NORMAL)
    1: ('Detención', [('v0', '14'), ('a', '3')]),
    2: ('Deterioro', [('alpha', '0.03'), ('threshold', '0.5')]),
    3: ('Oscilaciones', [('m', '400'), ('k', '2500')]),
    4: ('Sensores', [('amp', '1.5'), ('noiseScale', '1.5')]),
}
fails = []; total = 0
def check(cond, msg):
    global total; total += 1
    print(('  ✔ ' if cond else '  ✘ ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1366, 'height': 900})
    errors = []; pg.on('pageerror', lambda e: errors.append(str(e))); pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(800)
    def shown(label=''):
        pg.get_by_role('tab', name='Gráficos').click(); pg.wait_for_timeout(250); return pg.evaluate(CHECK_JS)
    def run(): pg.get_by_role('button', name='Ejecutar').click(); pg.wait_for_timeout(700)
    for cid, (name, edits) in PLAN.items():
        print(f'\n=== Módulo {cid} · {name}')
        pg.locator('.sidebar').get_by_text(name, exact=False).first.click(); pg.wait_for_timeout(500)
        run(); base = shown(); check(not base['problems'], f'1) NORMAL por defecto: {base["plots"]} gráficos y métrica coinciden con el cálculo ({base["metric"]}) {base["problems"]}')
        for k, v in edits: pg.fill(f'#param-{k}', v)
        check(pg.locator('.stale-banner').count() == 1 and pg.locator('.model-box[data-stale="true"]').count() == 1, '2) al editar parámetros sin ejecutar se muestra «Resultados desactualizados»')
        check(pg.get_by_role('button', name='Guardar en la base').is_disabled(), '   y no se puede guardar un resultado desactualizado')
        pg.get_by_role('tab', name='Resumen y conclusiones').click(); pg.wait_for_timeout(200)
        check(all(pg.input_value(f'#param-{k}') == v for k, v in edits), '   y los valores tecleados se conservan al cambiar de pestaña')
        run(); after = shown()
        check(pg.locator('.stale-banner').count() == 0, '3) tras Ejecutar desaparece el aviso de desactualizado')
        check(not after['problems'], f'4) con los parámetros modificados, gráficos y métrica coinciden con el cálculo ({after["metric"]}) {after["problems"]}')
        check(after['sig'] != base['sig'], f'   y los gráficos cambiaron respecto de la ejecución anterior (métrica: {base["metric"]} → {after["metric"]})')
        if cid == 3: check(after['metric'] == base['metric'], '   (en vibración libre la amplitud máxima es x₀, por eso la métrica no varía con m y k aunque la trayectoria sí)')
        else: check(after['metric'] != base['metric'], f'   y la métrica cambió: {base["metric"]} → {after["metric"]}')
        mod_params = after['params']
        for esc in ['ESTRÉS', 'MAL CONDICIONADO']:
            pg.get_by_role('button', name=esc, exact=True).click(); pg.wait_for_timeout(700); s = shown()
            check(not s['problems'] and s['scenario'] == esc, f'5) {esc}: se recalcula y todo coincide con el cálculo ({s["metric"]}) {s["problems"]}')
        pg.get_by_role('button', name='ESTRÉS', exact=True).click(); pg.wait_for_timeout(500)
        key, val = edits[0][0], edits[0][1]; pg.fill(f'#param-{key}', val); run()
        pg.get_by_role('button', name='Guardar en la base').click(); pg.wait_for_timeout(500)
        saved = shown(); saved_params = saved['params']
        run_other = pg.get_by_role('button', name='NORMAL', exact=True); run_other.click(); pg.wait_for_timeout(600)           # otra ejecución distinta
        pg.locator('.sidebar').get_by_text('Historial', exact=False).first.click(); pg.wait_for_timeout(500)
        pg.locator('#historyResults [data-action="open-saved"]').first.click(); pg.wait_for_timeout(700)
        form = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('#parametersForm [name]')].map(e => [e.name, Number(e.value)]))")
        check(all(abs(form[k] - saved_params[k]) <= 1e-9 * max(1, abs(saved_params[k])) for k in saved_params), '6) al recuperar del historial se muestran los parámetros guardados (no los de otra ejecución)')
        pg.get_by_role('tab', name='Resumen y conclusiones').click(); pg.wait_for_timeout(200)
        check(abs(float(pg.inner_text('.hero-metric .metric-main').split()[0]) - float(saved['metric'].split()[0])) <= 1e-6 * max(1, abs(float(saved['metric'].split()[0]))), '7) la métrica recuperada es la de la simulación guardada')
        pg.locator('.sidebar').get_by_text('Historial', exact=False).first.click(); pg.wait_for_timeout(400)
        pg.locator('#historyResults [data-action="rerun"]').first.click(); pg.wait_for_timeout(1200); rr = shown()
        check(not rr['problems'] and all(abs(rr['params'][k] - saved_params[k]) <= 1e-9 * max(1, abs(saved_params[k])) for k in saved_params), f'   al relanzar se recalcula con los parámetros guardados y todo coincide {rr["problems"]}')
    check(not errors, f'sin errores de consola ni excepciones {errors[:2]}')
    b.close(); httpd.shutdown()
print(f'\n{"OK" if not fails else "FALLÓ"} · {total - len(fails)}/{total} comprobaciones de interfaz'); sys.exit(1 if fails else 0)
