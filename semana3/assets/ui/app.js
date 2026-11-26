import { toDraft, changedFields, isDirty } from './draft.js';
import { CASES, SCENARIOS, PARAM_DEFS, PRESETS, COVERAGE, simulateCase, nfmt, ENGINE_VERSION } from '../cases/index.js';
import { Database, IndexedDBAdapter, MemoryAdapter, DBError } from '../db/engine.js';
import { TABLES, TABLE_ORDER } from '../db/schema.js';
import { SQL } from '../db/sql.js';
import * as Repo from '../db/repo.js';
import { runSelfChecks } from '../core/selfcheck.js';
import { chartSvg, esc } from './charts.js';
import { icon } from './icons.js';
import { derSvg } from './der.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const state = { view: 'inicio', caseId: 1, scenario: 'NORMAL', params: { ...PRESETS[1].NORMAL }, result: null, tab: 'resumen', savedId: null, recovered: null, verify: null,
  histQuery: '', regQuery: '', regPage: 0, histScenario: 'TODOS', histCase: 'TODOS', dbTab: 'registros', regCase: 'TODOS', regScen: 'TODOS', verifyAll: null, cmp: null, persistTest: null, checks: null, pipeline: null, volatile: false };
let db, sql;

/* ---------- utilidades ---------- */
const fmtShort = (iso) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso) => new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
function toast(msg, kind = '') { const t = $('#toast'); t.textContent = msg; t.className = `toast show ${kind}`; clearTimeout(toast._id); toast._id = setTimeout(() => t.classList.remove('show'), 3600); }
const caseColor = (id) => ['icon-blue', 'icon-teal', 'icon-orange', 'icon-purple'][id - 1];
const cell = (v) => esc(typeof v === 'number' ? nfmt(v) : String(v ?? ''));
function modal(html, { wide = false } = {}) { const m = $('#modal'); m.innerHTML = `<div class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`; m.classList.add('open'); const f = m.querySelector('input,textarea,select,button.primary-btn'); f?.focus(); }
function closeModal() { $('#modal').classList.remove('open'); $('#modal').innerHTML = ''; }
function confirmModal(title, body, okLabel = 'Eliminar', danger = true) {
  return new Promise((res) => {
    modal(`<h3>${esc(title)}</h3><div class="modal-body">${body}</div><div class="modal-actions"><button class="ghost-btn" data-modal="cancel" type="button">Cancelar</button><button class="${danger ? 'danger-solid' : 'primary-btn'}" data-modal="ok" type="button">${esc(okLabel)}</button></div>`);
    $('#modal').onclick = (e) => { const b = e.target.closest('[data-modal]'); if (!b && e.target.id !== 'modal') return; closeModal(); $('#modal').onclick = null; res(b?.dataset.modal === 'ok'); };
  });
}
const dataTable = (t, { compact = false, wrap = false } = {}) => `<section class="table-card"><h3>${esc(t.title)}</h3><div class="table-scroll"><table class="${compact ? 'compact' : ''} ${wrap ? 'wrap' : ''}"><thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${t.note ? `<p class="table-note">${esc(t.note)}</p>` : ''}</section>`;
const alertBox = (txt, kind = 'info') => `<div class="alert ${kind}">${icon('info', 14)} <span>${esc(txt)}</span></div>`;

/* ---------- navegación ---------- */
const NAV = [['inicio', 'Panel general', 'home'], ['proyecto', 'Las 3 fases', 'layers'], ['comparacion', 'Comparación', 'chart'], ['historial', 'Historial', 'history'], ['basedatos', 'Base de datos', 'database'], ['conclusiones', 'Conclusiones', 'check'], ['validacion', 'Validación', 'shield']];
function renderNav() {
  const active = (k) => (state.view === 'caso' ? k === `caso-${state.caseId}` : k === state.view);
  const btn = (label, key, ico, count = '') => `<button class="nav-button ${active(key) ? 'active' : ''}" data-nav="${key}" type="button" ${active(key) ? 'aria-current="page"' : ''}>${icon(ico, 18)}<span>${esc(label)}</span>${count !== '' ? `<span class="nav-number">${esc(count)}</span>` : ''}</button>`;
  $('#sideNav').innerHTML = `<div class="side-label">Plataforma</div>${NAV.map(([k, l, i]) => btn(l, k, i, k === 'historial' ? db?.count('simulacion') ?? 0 : '')).join('')}<div class="side-label sp">Casos de estudio</div>${CASES.map((c) => btn(c.short, `caso-${c.id}`, c.icon, String(c.id))).join('')}`;
  const names = Object.fromEntries(NAV.map(([k, l]) => [k, l]));
  $('#breadcrumb').textContent = `Plataforma / ${state.view === 'caso' ? CASES[state.caseId - 1].short : names[state.view]}`;
}
function navigate(target, { fresh = false } = {}) {
  const id = target.startsWith('caso-') ? Number(target.split('-')[1]) : null;
  if (id && CASES.some((c) => c.id === id)) {
    const same = state.view === 'caso' && state.caseId === id;
    state.view = 'caso'; state.caseId = id;
    if (!same || fresh) { state.scenario = 'NORMAL'; state.params = { ...PRESETS[id].NORMAL }; state.result = simulateCase(id, 'NORMAL', state.params); state.savedId = null; state.recovered = null; state.verify = null; state.tab = 'resumen'; }
  } else if (NAV.some(([k]) => k === target)) state.view = target;
  else { state.view = 'inicio'; target = 'inicio'; }
  if (location.hash.slice(1) !== target) history.replaceState(null, '', `#${target}`);
  render(); window.scrollTo({ top: 0 }); closeMenu();
}
const closeMenu = () => { $('.sidebar').classList.remove('open'); $('#mobileBackdrop').classList.remove('show'); };

/* ---------- vistas: inicio ---------- */
function heroGraphic() { return '<svg viewBox="0 0 300 190" fill="none" aria-hidden="true"><path d="m8 46 280-31M75 38l-12 21m146-31 12 16" stroke="#7194d3" stroke-width="2"/><path d="M150 32v50" stroke="#8eaeeb" stroke-width="4"/><path d="M150 82h-62c-10 0-17 8-17 18v49c0 12 9 21 20 21h119c11 0 20-9 20-21v-49c0-10-8-18-18-18z" fill="#274879" stroke="#7fa9ee" stroke-width="3"/><path d="M84 102c0-5 4-9 9-9h44v40H84zm62-9h55c7 0 12 5 12 12v28h-67z" fill="#88b7f8" fill-opacity=".24" stroke="#77a5ef" stroke-width="1.5"/><path d="M91 148h120" stroke="#85a9e6" stroke-width="3"/><path d="M109 171l-8 10m93-10 9 10" stroke="#8eaeeb" stroke-width="3"/></svg>'; }
function caseCard(c) { return `<article class="case-card"><div class="case-header"><div class="case-icon ${caseColor(c.id)}">${icon(c.icon, 24)}</div><div class="case-title"><h3>${esc(c.name)}</h3><small>Caso ${c.id} · 3 escenarios</small></div></div><p>${esc(c.description)}</p><div class="case-model">${esc(c.model)}</div><div class="case-bottom"><span class="chip">${esc(c.methods.split(' · ').slice(0, 3).join(' · '))}…</span><button class="text-link" data-nav="caso-${c.id}" type="button">Abrir módulo ${icon('arrow', 14)}</button></div></article>`; }
function coverageTable() {
  const rows = COVERAGE.map((m) => `<tr><td>${esc(m.family)}</td><td>${esc(m.method)}</td>${[1, 2, 3, 4].map((i) => `<td class="cov ${m.modules.includes(i) ? 'yes' : ''}">${m.modules.includes(i) ? '●' : ''}</td>`).join('')}</tr>`).join('');
  return `<section class="table-card"><h3>Cobertura de métodos por módulo</h3><div class="table-scroll"><table class="compact"><thead><tr><th>Familia</th><th>Método</th>${CASES.map((c) => `<th title="${esc(c.name)}">M${c.id}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><p class="table-note">Todos los métodos exigidos por la consigna se ejecutan al menos en un módulo; los módulos muestran los métodos pertinentes a su problema.</p></section>`;
}
function renderHome() {
  const n = db.count('simulacion');
  return `<div class="hero"><div class="hero-copy"><h1>Laboratorio numérico para un transporte por cable</h1><p>Cuatro casos hipotéticos, tres escenarios cada uno, todos los métodos de la asignatura y una base de datos relacional que conserva cada experimento.</p><div class="hero-actions"><button class="primary-btn" data-nav="caso-1" type="button">Iniciar simulación ${icon('arrow', 15)}</button></div></div><div class="hero-graphic">${heroGraphic()}</div></div>
  <section class="stats-grid"><div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('layers')}</div></div><strong class="stat-number">4</strong><div class="stat-label">Casos de estudio</div><div class="stat-foot">Detención, deterioro, oscilaciones, sensores</div></div>
  <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('flask')}</div></div><strong class="stat-number">12</strong><div class="stat-label">Experimentos 3 × 4</div><div class="stat-foot">Normal, estrés y mal condicionado</div></div>
  <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('calculator')}</div></div><strong class="stat-number">${COVERAGE.length - 1}</strong><div class="stat-label">Métodos numéricos</div><div class="stat-foot">Raíces, EDO, integración, interpolación, sistemas</div></div>
  <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('database')}</div></div><strong class="stat-number">${n}</strong><div class="stat-label">Simulaciones en la base</div><div class="stat-foot">${db.count('iteracion_resultado').toLocaleString('es-BO')} iteraciones registradas</div></div></section>
  <section class="phase-strip"><div class="section-heading"><div><h2>Las tres fases</h2><p>Cada semana agregó una parte; todo está en esta misma aplicación.</p></div><button class="outline-btn" data-nav="proyecto" type="button">Ver las fases ${icon('arrow', 14)}</button></div><div class="phase-grid">${WEEKS.map((w) => `<button class="phase-card" data-nav="proyecto" type="button"><span class="week-n">Fase ${w.n}</span><strong>${esc(w.title)}</strong><small>${esc(w.dates)}</small></button>`).join('')}</div></section>
  <section><div class="section-heading"><div><h2>Los cuatro módulos</h2><p>Cada módulo reúne modelo, métodos, tablas, gráficos, errores y una conclusión numérica separada de la conclusión del problema.</p></div><button class="outline-btn" data-nav="comparacion" type="button">Comparación general ${icon('arrow', 14)}</button></div><div class="case-grid">${CASES.map(caseCard).join('')}</div></section>
  <section class="below-home">${coverageTable()}<div class="side-stack"><div class="info-panel"><h3>Equipo</h3><p>Yandira Enilse Morales Nina<br/><span class="muted">Mención Ingeniería de Sistemas · módulos 1 y 3, base de datos</span><br/>Mario Fabricio Murillo Peñaranda<br/><span class="muted">Mención Inteligencia Artificial y Ciencia de Datos · módulos 2 y 4, incertidumbre</span><br/><span class="muted">Docente: Brígida Carvajal · Carrera de Informática, UMSA</span></p></div><div class="info-panel"><h3>Simulación sintética</h3><p>Los resultados no proceden de Mi Teleférico, no describen fallas verificadas y no son recomendaciones de seguridad ni mantenimiento. Es una herramienta educativa sin conexión a equipos de control.</p></div></div></section>`;
}

/* ---------- vistas: caso ---------- */
const DEPENDENCIAS = {
  1: 'Qué cambia con cada parámetro: v₀ y a modifican todas las curvas. tᵣ y la distancia disponible no alteran v(t) ni x(t) del tramo de frenado (la reacción ocurre antes de frenar): cambian la distancia total, el margen y el Monte Carlo. h solo afecta a RK2/RK4; c solo a la ampliación con frenado variable.',
  2: 'Qué cambia con cada parámetro: D₀, α, β y el umbral modifican D(t) y las raíces. x₀ solo cambia las iteraciones de Newton y secante; tᵢₙₛₚ solo la tabla de inspección retrasada; σ solo las observaciones y la calibración; el extremo tMax solo el intervalo de D(t) y de la bisección.',
  3: 'Qué cambia con cada parámetro: m, c, k, x₀ y v₀ modifican la trayectoria y sus errores. ω y F₀ intervienen solo con fuerza externa (en NORMAL, F₀ = 0: vibración libre y ω no interviene). h solo afecta a RK2/RK4. La amplitud estacionaria no depende de x₀, v₀ ni h.',
  4: 'Qué cambia con cada parámetro: A, ε y la distribución de nodos modifican la señal reconstruida. Las muestras ocultas solo cambian los errores en esos puntos (el error continuo se evalúa en todo el intervalo). θ solo cambia la raíz de cruce y σ solo el análisis Monte Carlo; la curva de Runge no depende de A, ε ni σ.',
};
function staleBanner() {
  if (!state.result || state.view !== 'caso') return '';
  const ch = changedFields(PARAM_DEFS[state.caseId], state.draft, state.params);
  if (!ch.length) return '';
  return `<div class="stale-banner" role="status">${icon('info', 14)}<span><strong>Resultados desactualizados.</strong> Cambiaste ${ch.map((c) => `${esc(c.label)}: ${esc(c.from)} → ${esc(c.to)}`).join('; ')}. Los gráficos, tablas y métricas de abajo pertenecen a la ejecución anterior. Pulsa <strong>Ejecutar</strong> para recalcular.</span></div>`;
}
function refreshStale() {
  const slot = $('#staleSlot'); if (!slot) return;
  slot.innerHTML = staleBanner(); const dirty = slot.innerHTML !== '';
  $('.model-box')?.setAttribute('data-stale', String(dirty));
  const sv = $('[data-action="save"]'); if (sv) sv.disabled = dirty || !!state.savedId;
}
function paramField(d) {
  const v = state.draft?.[d.key] ?? state.params[d.key];
  if (d.type === 'select') return `<div class="field wide"><label for="param-${d.key}">${esc(d.label)}</label><select id="param-${d.key}" name="${d.key}">${d.options.map(([val, lab]) => `<option value="${val}" ${Number(v) === Number(val) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></div>`;
  return `<div class="field"><label for="param-${d.key}">${esc(d.label)}</label><div class="input-wrap"><input id="param-${d.key}" name="${d.key}" type="number" required min="${d.min}" max="${d.max}" step="any" value="${esc(v)}"/><span class="unit">${esc(d.unit)}</span></div></div>`;
}
function resultTabs(r) {
  const nPlots = r.sections.reduce((n, s) => n + s.plots.length, 0);
  const tabs = [['resumen', 'Resumen y conclusiones'], ['graficos', `Gráficos (${nPlots})`], ...r.sections.map((s) => [s.id, s.title.split(' · ')[0]]), ...(state.savedId ? [['datos', 'Datos guardados']] : [])];
  return `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" type="button" class="tab ${state.tab === id ? 'active' : ''}" data-action="tab" data-value="${id}" aria-selected="${state.tab === id}">${esc(label)}</button>`).join('')}</div>`;
}
function verifyPanel() {
  const v = state.verify; if (!v) return '';
  return `<section class="verify ${v.ok ? 'ok' : 'bad'}"><div class="verify-head">${icon(v.ok ? 'check' : 'x', 18)}<div><strong>${v.ok ? 'Reproducibilidad verificada' : 'Diferencias fuera de tolerancia'}</strong><span>Simulación #${v.id} · tolerancia ${nfmt(v.tol)} · diferencia máxima ${nfmt(v.maxDiff)} · métrica ${nfmt(v.metricDiff)}</span></div></div><div class="table-scroll"><table class="compact"><thead><tr><th>Familia</th><th>Método</th><th>Diferencia relativa</th><th>Iteraciones guardadas / nuevas</th><th>Resultado</th></tr></thead><tbody>${v.rows.map((r) => `<tr><td>${esc(r.familia || '')}</td><td>${esc(r.metodo)}</td><td>${nfmt(r.diff)}</td><td>${r.iter_guardadas ?? ''} / ${r.iter_nuevas ?? ''}</td><td><span class="pill ${r.ok ? '' : 'warn'}">${r.ok ? 'Coincide' : 'Revisar'}</span></td></tr>`).join('')}</tbody></table></div></section>`;
}
function savedData() {
  if (!state.savedId) return '';
  const { runs } = Repo.loadSimulation(db, state.savedId);
  return `<section class="table-card"><h3>Ejecuciones recuperadas desde las tablas relacionales (simulación #${state.savedId})</h3><div class="table-scroll"><table class="compact"><thead><tr><th>ID</th><th>Familia</th><th>Método</th><th>Convergió</th><th>Iteraciones guardadas</th><th>Último error abs.</th><th>Referencia</th><th></th></tr></thead><tbody>${runs.map((m) => { const last = m.iteraciones.at(-1); return `<tr><td>${m.id}</td><td>${esc(m.familia)}</td><td>${esc(m.metodo)}</td><td>${m.convergio ? 'Sí' : 'No'}</td><td>${m.iteraciones.length}</td><td>${last ? cell(last.error_abs) : ''}</td><td class="trunc" title="${esc(m.resumen?.referencia)}">${esc(m.resumen?.referencia ?? '')}</td><td><button class="mini-btn" data-action="db-open-run" data-id="${m.id}" type="button">Ver iteraciones</button></td></tr>`; }).join('')}</tbody></table></div><p class="table-note">Estos datos salen de <code>ejecucion_metodo</code>, <code>iteracion_resultado</code> y <code>resultado_resumen</code>; las gráficas se reconstruyen con la instantánea guardada.</p></section>`;
}
function renderCase() {
  const c = CASES[state.caseId - 1], r = state.result;
  const dirty = !!r && isDirty(PARAM_DEFS[c.id], state.draft, state.params);
  const note = state.scenario === 'MAL CONDICIONADO' ? 'Escenario de sensibilidad matemática; no equivale necesariamente a mayor riesgo físico.' : 'Los valores son sintéticos y pueden editarse antes de calcular.';
  let body = '';
  if (r) {
    if (state.tab === 'resumen') body = `<div class="metrics wide3">${r.summary.map((m) => `<div class="metric"><span class="metric-label">${esc(m.label)}</span><div class="metric-main">${esc(m.value)} <span class="metric-unit">${esc(m.unit)}</span></div></div>`).join('')}</div><div class="double-insight"><article class="insight math"><h3>${icon('calculator', 18)} Conclusión numérica</h3><p>${esc(r.numeric)}</p></article><article class="insight physical"><h3>${icon('activity', 18)} Conclusión del problema</h3><p>${esc(r.physical)}</p></article></div>${alertBox(r.note)}${alertBox(DEPENDENCIAS[state.caseId], 'info')}<div class="chart-grid">${r.sections.slice(0, 2).map((s) => s.plots[0]).filter(Boolean).map((pl) => `<section class="chart-card"><h3>${esc(pl.title)}</h3>${chartSvg(pl)}</section>`).join('')}</div>`;
    else if (state.tab === 'graficos') body = r.sections.filter((s) => s.plots.length).map((s) => `<div class="section-intro"><h3>${esc(s.title)}</h3></div><div class="chart-grid">${s.plots.map((pl) => `<section class="chart-card"><h3>${esc(pl.title)}</h3>${chartSvg(pl)}</section>`).join('')}</div>`).join('');
    else if (state.tab === 'datos') body = savedData();
    else { const s = r.sections.find((x) => x.id === state.tab) || r.sections[0]; body = `<div class="section-intro"><h3>${esc(s.title)}</h3><p>${esc(s.intro)}</p></div>${s.plots.length ? `<div class="chart-grid">${s.plots.map((pl) => `<section class="chart-card"><h3>${esc(pl.title)}</h3>${chartSvg(pl)}</section>`).join('')}</div>` : ''}${s.tables.map((t) => dataTable(t)).join('')}`; }
  }
  const badge = state.recovered ? `<span class="pill neutral">${icon('database', 12)} Recuperado de la BD · simulación #${state.recovered}</span>` : state.savedId ? `<span class="pill">${icon('check', 12)} Guardado · simulación #${state.savedId}</span>` : '<span class="pill neutral">Sin guardar</span>';
  return `<div class="case-page-heading"><div><button data-nav="inicio" class="back-link" type="button">${icon('chevron', 13)} Panel general</button><h1>${esc(c.name)}</h1><p class="lead">${esc(c.description)}</p></div></div>
  <div class="case-layout"><section class="panel panel-pad"><div class="panel-title">${icon('calculator', 18)} <span class="grow">Configurar experimento</span></div><p class="section-sub">Elige el escenario y ajusta los parámetros.</p>
  <div class="select-label">Escenario</div><div class="scenario-selector" role="group" aria-label="Escenario">${SCENARIOS.map((s) => `<button type="button" class="scenario-option ${state.scenario === s ? 'selected' : ''}" data-action="scenario" data-value="${esc(s)}" aria-pressed="${state.scenario === s}">${esc(s)}</button>`).join('')}</div>
  <form id="parametersForm"><div class="form-grid">${PARAM_DEFS[c.id].map(paramField).join('')}</div><div class="form-actions"><button type="submit" class="primary-btn">${icon('play', 14)} Ejecutar</button><button type="button" class="ghost-btn" data-action="reset">${icon('reset', 14)} Restablecer</button></div></form><div id="formError"></div>${alertBox(note, 'warn')}</section>
  <section class="panel model-box" data-stale="${dirty}"><div id="staleSlot">${staleBanner()}</div><div class="simulation-status">${badge}<div class="results-actions"><button class="outline-btn" data-action="save" type="button" ${state.savedId || dirty ? 'disabled' : ''}>${icon('save', 14)} ${state.savedId ? 'Guardada' : 'Guardar en la base'}</button><button class="ghost-btn" data-action="verify" type="button" ${state.savedId ? '' : 'disabled'} title="Repite el cálculo con los parámetros guardados y compara">${icon('shield', 14)} Verificar</button></div></div><div class="model-banner"><span class="eyebrow-blue">Modelo de referencia</span><div class="formula">${esc(c.model)}</div></div>${r ? `<div class="metric hero-metric"><span class="metric-label">${esc(r.metric.label)}</span><div class="metric-main big">${esc(nfmt(r.metric.value, 7))} <span class="metric-unit">${esc(r.metric.unit)}</span></div></div>` : ''}<div class="method-list"><strong>Métodos:</strong> ${esc(c.methods)}</div></section></div>
  ${verifyPanel()}${r ? `<div class="results-wrap">${resultTabs(r)}<div class="tab-body">${body}</div></div>` : ''}`;
}

/* ---------- vistas: comparación ---------- */
let cmpCache = null;
function computeComparison() { if (cmpCache) return cmpCache; cmpCache = CASES.flatMap((c) => SCENARIOS.map((s) => { const r = simulateCase(c.id, s, PRESETS[c.id][s]); const finals = r.runs.map((x) => x.iterations.at(-1)?.error_abs).filter((v) => typeof v === 'number'); return { c, s, r, conv: r.runs.filter((x) => x.converged).length, total: r.runs.length, maxErr: finals.length ? Math.max(...finals) : null }; })); return cmpCache; }
function renderComparison() {
  const rows = computeComparison();
  const lin = rows.filter((x) => x.c.id === 2).map((x) => x.r.extra.linear);
  const methods = ['Jacobi', 'Gauss-Seidel', 'LU', 'Gradiente conjugado'];
  const linTable = { title: 'Sistemas lineales 4×4: pasos de cada método por escenario', headers: ['Método', ...SCENARIOS.map((s) => `${s} (pasos)`), ...SCENARIOS.map((s) => `${s} (error ∞)`)], rows: methods.map((m) => [m, ...lin.map((l) => l.runs.find((r) => r.method === m).iterations), ...lin.map((l) => { const r = l.runs.find((q) => q.method === m); return nfmt(r.trace.at(-1).error); })]), note: `κ₂: ${lin.map((l, i) => `${SCENARIOS[i]} = ${nfmt(l.info.cond2, 6)}`).join(' · ')}. Que un método converja en pocos pasos no significa que el problema esté bien condicionado.` };
  const rootRows = rows.filter((x) => x.c.id === 2).map((x) => ['Caso 2 · ' + x.s, ...['Bisección', 'Newton-Raphson', 'Secante'].map((m) => x.r.runs.find((q) => q.family === 'Raíces' && q.method === m).iterations.length - 0)]);
  const rootTable = { title: 'Raíces del caso 2: iteraciones registradas', headers: ['Escenario', 'Bisección', 'Newton-Raphson', 'Secante'], rows: rootRows };
  const iters = rows.filter((x) => x.c.id === 2 && x.s === 'NORMAL')[0].r.runs.filter((q) => q.family === 'Raíces');
  const plot = { title: 'Residual de los métodos de raíces (caso 2 NORMAL)', xLabel: 'Iteración', yLabel: 'Residual |g(t)|', logY: true, series: iters.map((q) => ({ name: q.method, points: q.iterations.filter((i) => i.residual > 0).map((i) => [i.k, i.residual]), markers: q.iterations.length < 10 })) };
  return `<div class="main-heading"><div><h1>Comparación general</h1><p class="lead">Los 12 experimentos de referencia (4 casos × 3 escenarios) con métricas, convergencia de los métodos y error máximo final. Las magnitudes tienen unidades distintas y no se suman ni forman una puntuación de riesgo.</p></div></div>
  <section class="table-card"><h3>Matriz 3 × 4 de experimentos</h3><div class="table-scroll"><table><thead><tr><th>Caso</th><th>Escenario</th><th>Métrica principal</th><th>Valor</th><th>Métodos convergidos</th><th>Error abs. máx. final</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td><strong>${esc(x.c.short)}</strong></td><td>${esc(x.s)}</td><td>${esc(x.r.metric.label)}</td><td>${esc(nfmt(x.r.metric.value, 6))} ${esc(x.r.metric.unit)}</td><td>${x.conv} / ${x.total}</td><td>${x.maxErr === null ? '—' : esc(nfmt(x.maxErr))}</td><td><button class="mini-btn" data-nav="caso-${x.c.id}" type="button">Abrir</button></td></tr>`).join('')}</tbody></table></div><p class="table-note">En MAL CONDICIONADO la métrica física puede coincidir con NORMAL: la prueba numérica (raíz triple, κ elevado, nodos próximos) es independiente de la magnitud del fenómeno.</p></section>
  ${dataTable(linTable)}<div class="chart-grid"><section class="chart-card"><h3>${esc(plot.title)}</h3>${chartSvg(plot)}</section>${dataTable(rootTable)}</div>
  <div class="info-columns"><div class="info-panel"><h3>NORMAL</h3><p>Parámetros nominales sintéticos y referencia analítica o numérica de alta precisión.</p></div><div class="info-panel"><h3>ESTRÉS</h3><p>Condiciones más exigentes: pasos mayores, ruido, otra rigidez o tasas de deterioro mayores.</p></div><div class="info-panel"><h3>MAL CONDICIONADO</h3><p>Raíz múltiple, κ = 10⁶, nodos próximos: sensibilidad demostrable, no un incidente físico.</p></div></div>`;
}

/* ---------- vistas: historial ---------- */
function historyList() {
  const q = state.histQuery.trim().toLowerCase();
  const sims = Repo.listSimulations(db).filter((s) => (state.histScenario === 'TODOS' || s.tipo === state.histScenario) && (state.histCase === 'TODOS' || String(s.caso_id) === state.histCase) && `${CASES[s.caso_id - 1].name} ${s.tipo} ${s.etiqueta ?? ''} ${s.notas ?? ''} ${fmtDate(s.fecha)} #${s.id}`.toLowerCase().includes(q));
  if (!sims.length) return `<div class="empty-state">${icon('history', 45)}<h3>${db.count('simulacion') ? 'Sin resultados para el filtro' : 'Todavía no hay simulaciones guardadas'}</h3><p>Ejecuta un módulo y pulsa «Guardar en la base», o carga los 12 experimentos de referencia.</p><div class="empty-actions"><button class="primary-btn" data-action="seed-ref" type="button">${icon('database', 14)} Cargar los 12 experimentos de referencia</button></div></div>`;
  return `<div class="history-list">${sims.map((s) => { const c = CASES[s.caso_id - 1]; return `<article class="history-item"><div class="history-left"><div class="case-icon ${caseColor(c.id)}">${icon(c.icon, 20)}</div><div><h3>#${s.id} · ${esc(c.name)} <span class="small-badge">${esc(s.tipo)}</span>${s.verificacion ? `<span class="pill ${s.verificacion.aprobada ? '' : 'warn'}">${s.verificacion.aprobada ? 'Reproducida' : 'Con diferencias'}</span>` : ''}</h3><p>${esc(fmtDate(s.fecha))} · ${s.metodos} métodos${s.etiqueta ? ` · <em>${esc(s.etiqueta)}</em>` : ''}</p></div></div><div class="history-right"><div class="history-val"><strong>${esc(nfmt(s.metrica_valor, 6))} ${esc(s.metrica_unidad ?? '')}</strong><span>${esc(s.metrica_nombre ?? '')}</span></div><button class="mini-btn" data-action="open-saved" data-id="${s.id}" type="button">${icon('eye', 12)} Abrir</button><button class="mini-btn" data-action="rerun" data-id="${s.id}" type="button">${icon('reset', 12)} Relanzar</button><button class="mini-btn" data-action="edit-sim" data-id="${s.id}" type="button">${icon('edit', 12)} Editar</button><button class="danger-btn" data-action="del-sim" data-id="${s.id}" type="button" title="Eliminar simulación">${icon('trash', 13)}</button></div></article>`; }).join('')}</div>`;
}
function renderHistory() {
  return `<div class="main-heading"><div><h1>Historial de experimentos</h1><p class="lead">Cada simulación vive en la base de datos relacional: escenario, métodos, iteraciones, errores y resumen. Puedes abrirla, relanzarla para comprobar que el resultado coincide, editar su etiqueta o eliminarla.</p></div></div>
  <div class="hist-controls"><label class="search-box">${icon('search', 17)}<input id="historySearch" type="search" placeholder="Buscar por caso, escenario, etiqueta, nota o fecha…" value="${esc(state.histQuery)}" autocomplete="off" aria-label="Buscar"/></label><select id="historyCase" class="outline-btn" aria-label="Filtrar por caso"><option value="TODOS">Todos los casos</option>${CASES.map((c) => `<option value="${c.id}" ${state.histCase === String(c.id) ? 'selected' : ''}>${esc(c.short)}</option>`).join('')}</select><select id="historyScenario" class="outline-btn" aria-label="Filtrar por escenario"><option value="TODOS">Todos los escenarios</option>${SCENARIOS.map((s) => `<option ${state.histScenario === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><button class="outline-btn" data-nav="basedatos" type="button">${icon('database', 14)} Abrir base de datos</button></div>
  <div id="historyResults">${historyList()}</div>${state.volatile ? alertBox('Este navegador no permite IndexedDB: los datos se pierden al cerrar la pestaña. Usa Exportar SQL en la sección Base de datos.', 'warn') : ''}`;
}

/* ---------- vistas: base de datos ---------- */
const regFilterOk = (s) => (state.regCase === 'TODOS' || String(s.caso_id) === state.regCase) && (state.regScen === 'TODOS' || s.tipo === state.regScen);
function regRows() { const q = state.regQuery.trim().toLowerCase(); return Repo.listSimulations(db).filter((s) => regFilterOk(s) && `${CASES[s.caso_id - 1].name} ${s.tipo} ${fmtDate(s.fecha)} #${s.id}`.toLowerCase().includes(q)); }
function regTable() {
  const rows = regRows(), pages = Math.max(1, Math.ceil(rows.length / 10)); state.regPage = Math.min(state.regPage, pages - 1);
  if (!rows.length) return `<div class="empty-state">${icon('database', 45)}<h3>${db.count('simulacion') ? 'Sin resultados para el filtro' : 'Todavía no hay registros guardados'}</h3><p>Ejecuta un módulo y pulsa «Guardar en la base», o carga los 12 experimentos de demostración.</p><div class="empty-actions"><button class="primary-btn" data-action="seed-ref" type="button">${icon('database', 14)} Cargar demostraciones</button></div></div>`;
  const sl = rows.slice(state.regPage * 10, state.regPage * 10 + 10);
  return `<div class="table-card flat"><div class="table-scroll"><table class="db-grid"><thead><tr><th>N.º</th><th>Fecha</th><th>Módulo</th><th>Escenario</th><th>Resultado principal</th><th>Verificación</th><th class="actions-col">Acciones</th></tr></thead><tbody>${sl.map((s) => `<tr><td>#${s.id}</td><td>${esc(fmtShort(s.fecha))}</td><td>${esc(CASES[s.caso_id - 1].short)}</td><td><span class="small-badge">${esc(s.tipo)}</span></td><td><strong>${esc(nfmt(s.metrica_valor, 6))}</strong> ${esc(s.metrica_unidad ?? '')}</td><td>${s.verificacion ? (s.verificacion.aprobada ? 'Reproducida' : 'Con diferencias') : 'Sin verificar'}</td><td class="row-actions"><button class="mini-btn" data-action="open-saved" data-id="${s.id}" title="Ver el resultado guardado, recuperado desde la base" type="button">Recuperar</button> <button class="mini-btn" data-action="rerun" data-id="${s.id}" title="Volver a calcular con los parámetros guardados" type="button">Relanzar</button> <button class="mini-btn danger" data-action="del-sim" data-id="${s.id}" title="Eliminar esta simulación" type="button">Eliminar</button></td></tr>`).join('')}</tbody></table></div></div>
  <div class="pager"><button class="mini-btn" data-action="reg-page" data-value="-1" ${state.regPage === 0 ? 'disabled' : ''} type="button">Anterior</button><span>Página ${state.regPage + 1} de ${pages} · ${rows.length} registro(s)</span><button class="mini-btn" data-action="reg-page" data-value="1" ${state.regPage >= pages - 1 ? 'disabled' : ''} type="button">Siguiente</button></div>`;
}
function regStats() {
  const sims = Repo.listSimulations(db), total = sims.length;
  const row = (label, n) => `<div class="dist-row"><span>${esc(label)}</span><div class="dist-bar"><i style="width:${total ? Math.round(100 * n / total) : 0}%"></i></div><strong>${n}</strong></div>`;
  return `<div class="reg-stats"><div class="stat-card"><strong class="stat-number">${total}</strong><div class="stat-label">Simulaciones guardadas</div></div><div class="stat-card"><div class="stat-label">Por módulo</div>${CASES.map((c) => row(c.short, sims.filter((s) => s.caso_id === c.id).length)).join('')}</div><div class="stat-card"><div class="stat-label">Por escenario</div>${SCENARIOS.map((sc) => row(sc, sims.filter((s) => s.tipo === sc).length)).join('')}</div></div>`;
}
function dbRegistrosView() {
  const sel = (id, val, opts) => `<select id="${id}" class="outline-btn" aria-label="${id === 'regCase' ? 'Filtrar por módulo' : 'Filtrar por escenario'}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `${regStats()}<div class="grid-tools reg-filters"><label class="search-box small">${icon('search', 15)}<input id="regSearch" type="search" placeholder="Buscar por módulo, escenario o fecha…" value="${esc(state.regQuery)}" autocomplete="off" aria-label="Buscar registros"/></label>${sel('regCase', state.regCase, [['TODOS', 'Todos los módulos'], ...CASES.map((c) => [String(c.id), c.short])])}${sel('regScen', state.regScen, [['TODOS', 'Todos los escenarios'], ...SCENARIOS.map((s) => [s, s])])}</div><div id="regResults">${regTable()}</div>`;
}
const DB_TABS = [['registros', 'Registros'], ['esquema', 'Esquema y DER'], ['integridad', 'Integridad'], ['respaldo', 'Respaldo']];
function dbTabs() { return `<div class="tabs" role="tablist">${DB_TABS.map(([id, l]) => `<button type="button" class="tab ${state.dbTab === id ? 'active' : ''}" data-action="db-tab" data-value="${id}" role="tab" aria-selected="${state.dbTab === id}">${l}</button>`).join('')}</div>`; }
const ENTIDADES = [
  ['caso_estudio', 'Casos de estudio', 'Los cuatro módulos: detención, deterioro, oscilaciones y sensores.'],
  ['escenario', 'Escenarios', 'NORMAL, ESTRÉS o MAL CONDICIONADO, con los parámetros de cada experimento.'],
  ['simulacion', 'Simulaciones', 'Cada experimento guardado: fecha, estado y copia del resultado para recuperarlo.'],
  ['ejecucion_metodo', 'Ejecuciones por método', 'Qué método se corrió, con qué paso y tolerancia, y si convergió.'],
  ['iteracion_resultado', 'Iteraciones', 'Aproximación, residual y errores en cada iteración de cada método.'],
  ['resultado_resumen', 'Resumen de resultados', 'Valor final frente a la referencia y sus métricas de error.'],
  ['verificacion', 'Verificaciones', 'Comparaciones de reproducibilidad: diferencia máxima y tolerancia.'],
  ['auditoria', 'Auditoría', 'Registro de altas, cambios y eliminaciones.'],
];
function dbEsquemaView() {
  const counts = Object.fromEntries(TABLE_ORDER.map((t) => [t, `${db.count(t)} filas`]));
  return `<section class="panel panel-pad"><div class="panel-title"><span class="grow">¿Cómo se guarda un experimento?</span></div><p class="section-sub">Cada simulación se descompone en entidades relacionadas. Así se puede recuperar completa (parámetros, iteraciones y resultados) y repetir el cálculo para comprobarlo.</p><div class="flow">${['Caso de estudio', 'Escenario', 'Simulación', 'Ejecución por método', 'Iteraciones y resumen'].map((t, i, a) => `<span class="flow-step">${t}</span>${i < a.length - 1 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div></section>
  <section class="panel panel-pad mt"><div class="panel-title"><span class="grow">Diagrama entidad–relación</span><small>${TABLE_ORDER.length} entidades</small></div><p class="section-sub">Cada línea une una entidad con aquella de la que depende (PK = identificador, FK = referencia).</p>${derSvg(counts, { simple: true })}</section>
  <div class="entity-grid">${ENTIDADES.map(([t, name, desc]) => `<article class="entity-card"><div class="entity-top"><strong>${name}</strong><span class="small-badge">${db.count(t)} registros</span></div><p>${desc}</p></article>`).join('')}</div>`;
}
function dbIntegridadView() {
  const st = db.stats(), issues = db.integrityCheck(), va = state.verifyAll, pt = state.persistTest;
  const badge = (ok, txt) => `<span class="pill ${ok ? '' : 'warn'}">${txt}</span>`;
  const card = (ico, title, status, body, action = '') => `<article class="integrity-card"><div class="integrity-head">${icon(ico, 18)}<h3>${title}</h3>${status}</div><p>${body}</p>${action}</article>`;
  const vaText = !va ? 'Repite el cálculo de cada registro guardado con sus parámetros y lo compara con lo almacenado.' : va.n === 0 ? 'Aún no hay registros para verificar.' : `${va.good} de ${va.n} registros se recalcularon con el mismo resultado (diferencia máxima ${nfmt(va.maxDiff)}, tolerancia 1e-9).`;
  return `<p class="section-sub">Cuatro comprobaciones sencillas que muestran que la información guardada es confiable.</p><div class="integrity-grid">
  ${card('database', 'Los registros se conservan', badge(true, 'Correcto'), `${st.tables.simulacion.rows} simulaciones, ${st.tables.ejecucion_metodo.rows} ejecuciones de métodos y ${st.tables.iteracion_resultado.rows} iteraciones guardadas. Siguen ahí al cerrar o actualizar la página.`)}
  ${card('reset', 'Se pueden recuperar', pt ? badge(pt.ok, pt.ok ? 'Confirmado' : 'Revisar') : badge(true, 'Sin ejecutar'), pt ? esc(pt.msg) : 'Cierra la conexión, la reabre y comprueba que todas las tablas conservan el mismo número de filas.', `<button class="outline-btn" data-action="persist-test" type="button">${icon('reset', 14)} Cerrar y reabrir la base</button>`)}
  ${card('shield', 'La verificación funciona', va ? (va.n === 0 ? badge(false, 'Sin registros') : badge(va.ok, va.ok ? 'Reproducibilidad confirmada' : 'Revisar')) : badge(true, 'Sin ejecutar'), vaText, `<button class="outline-btn" data-action="verify-all" type="button">${icon('play', 14)} Verificar registros</button>`)}
  ${card('check', 'La información es coherente', badge(!issues.length, issues.length ? `${issues.length} problema(s)` : 'Correcto'), issues.length ? 'Se detectaron inconsistencias; revisa la tabla inferior.' : 'No hay referencias huérfanas, datos faltantes ni valores fuera de rango.')}
  </div>${issues.length ? `<section class="table-card"><h3>Inconsistencias detectadas</h3><div class="table-scroll"><table class="compact"><thead><tr><th>Entidad</th><th>ID</th><th>Problema</th></tr></thead><tbody>${issues.map((i) => `<tr><td>${esc(i.tabla)}</td><td>${i.id}</td><td>${esc(i.problema)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}
function dbRespaldoView() {
  const card = (ico, t, d, a) => `<article class="backup-card"><div class="backup-ico">${icon(ico, 20)}</div><h3>${t}</h3><p>${d}</p>${a}</article>`;
  return `<p class="section-sub">Guarda una copia de los experimentos, restáuralos o carga ejemplos para la demostración.</p><div class="backup-grid">
  ${card('download', 'Exportar JSON', 'Copia completa de la base (casos, escenarios, simulaciones, iteraciones y resultados). Sirve para restaurarla después.', `<button class="outline-btn" data-action="db-export-json" type="button">${icon('download', 14)} Descargar JSON</button>`)}
  ${card('download', 'Exportar CSV', 'Tabla de simulaciones guardadas, lista para abrir en una hoja de cálculo.', `<button class="outline-btn" data-action="db-export-csv" type="button">${icon('download', 14)} Descargar CSV</button>`)}
  ${card('upload', 'Importar registros', 'Restaura un respaldo JSON exportado desde esta aplicación. Reemplaza los datos actuales.', `<label class="outline-btn file-btn">${icon('upload', 14)} Elegir archivo<input id="importFile" type="file" accept=".json" hidden/></label>`)}
  ${card('database', 'Cargar demostraciones', 'Ejecuta y guarda los 12 experimentos de referencia (4 módulos × 3 escenarios).', `<button class="primary-btn" data-action="seed-ref" type="button">${icon('database', 14)} Cargar 12 experimentos</button>`)}
  </div><p class="backup-reset"><button class="mini-btn danger" data-action="db-reset" type="button">${icon('trash', 14)} Reiniciar la base</button><span>Elimina todas las simulaciones guardadas y deja los casos y escenarios iniciales.</span></p>`;
}
function renderDb() {
  if (!DB_TABS.some(([id]) => id === state.dbTab)) state.dbTab = 'registros';
  const body = { registros: dbRegistrosView, esquema: dbEsquemaView, integridad: dbIntegridadView, respaldo: dbRespaldoView }[state.dbTab]();
  return `<div class="main-heading"><div><h1>Base de datos</h1><p class="lead">Aquí se conservan las simulaciones guardadas: consúltalas, recupéralas, relánzalas o respáldalas.</p></div></div>${dbTabs()}<div class="tab-body">${body}</div>`;
}

/* ---------- vistas: validación ---------- */
function renderValidation() {
  const p = state.pipeline, ch = state.checks, cmp = p?.cmp, good = ch ? ch.filter((x) => x.ok).length : 0;
  const banner = (ok, title, sub) => `<div class="status-banner ${ok ? 'ok' : 'bad'}">${icon(ok ? 'check' : 'x', 22)}<div><strong>${title}</strong><span>${sub}</span></div></div>`;
  const nOk = cmp ? cmp.rows.filter((r) => r.ok).length : 0;
  const repro = cmp ? `${banner(cmp.ok, cmp.ok ? 'Validación correcta' : 'Hay diferencias fuera de la tolerancia', cmp.ok ? 'Resultados consistentes · Diferencias dentro de la tolerancia · Reproducibilidad confirmada' : 'Revisa los métodos marcados en la tabla.')}
    <div class="stats-grid"><div class="stat-card"><strong class="stat-number">${cmp.rows.length}</strong><div class="stat-label">Métodos comparados</div></div><div class="stat-card"><strong class="stat-number">${nOk} de ${cmp.rows.length}</strong><div class="stat-label">Coinciden</div></div><div class="stat-card"><strong class="stat-number">${nfmt(cmp.maxDiff)}</strong><div class="stat-label">Diferencia máxima</div></div><div class="stat-card"><strong class="stat-number">${nfmt(cmp.tol)}</strong><div class="stat-label">Tolerancia</div></div></div>
    <div class="table-card flat"><div class="table-scroll"><table class="compact"><thead><tr><th>Método</th><th>Diferencia relativa</th><th>Tolerancia</th><th>Iteraciones (guardadas / nuevas)</th><th>Estado</th></tr></thead><tbody>${cmp.rows.map((r) => `<tr><td>${esc(r.metodo)}</td><td>${nfmt(r.diff)}</td><td>${nfmt(cmp.tol)}</td><td>${r.iter_guardadas} / ${r.iter_nuevas}</td><td><span class="pill ${r.ok ? '' : 'warn'}">${r.ok ? 'Coincide' : 'Revisar'}</span></td></tr>`).join('')}</tbody></table></div></div>
    <p class="val-why"><strong>¿Por qué demuestra que el sistema funciona?</strong> Se guardó una simulación, se cerró y reabrió la base, se recuperó y se volvió a calcular con los mismos parámetros. Cada método dio el mismo resultado dentro de la tolerancia: lo guardado es fiel y el cálculo es reproducible.</p>` : '';
  const exact = ch ? `${banner(good === ch.length, good === ch.length ? 'Validación correcta' : 'Hay verificaciones fuera de tolerancia', `${good} de ${ch.length} verificaciones coinciden con su valor de referencia`)}
    <details class="val-details"><summary>Ver el detalle de las verificaciones</summary><div class="table-scroll"><table class="compact"><thead><tr><th>Familia</th><th>Verificación</th><th>Esperado</th><th>Obtenido</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>${ch.map((c) => `<tr><td>${esc(c.family)}</td><td>${esc(c.name)}</td><td>${nfmt(c.expected, 10)}</td><td>${nfmt(c.got, 10)}</td><td>${nfmt(c.diff)}</td><td><span class="pill ${c.ok ? '' : 'warn'}">${c.ok ? 'Correcto' : 'Revisar'}</span></td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<div class="main-heading"><div><h1>Validación</h1><p class="lead">Comprueba que el sistema es confiable: lo que se guarda se puede recuperar y repetir con el mismo resultado, y los métodos coinciden con valores de referencia.</p></div></div>
  <div class="info-columns val-intro"><div class="info-panel"><h3>Qué se valida</h3><p>Que una simulación guardada se recupera y se repite igual, y que los métodos dan resultados correctos.</p></div><div class="info-panel"><h3>Contra qué se compara</h3><p>Lo guardado en la base frente a un nuevo cálculo, y el motor frente a soluciones analíticas conocidas.</p></div><div class="info-panel"><h3>Qué demuestra</h3><p>Que los resultados son reproducibles y numéricamente correctos.</p></div></div>
  <section class="panel panel-pad mt"><div class="panel-title"><span class="grow">1 · Reproducibilidad de una simulación</span></div><p class="section-sub">Elige un módulo y un escenario. Se guarda la simulación, se recupera de la base y se calcula de nuevo (tolerancia 1e-9).</p>
  <div class="hist-controls"><select id="pipeCase" class="outline-btn" aria-label="Módulo">${CASES.map((c) => `<option value="${c.id}" ${p?.caseId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><select id="pipeScenario" class="outline-btn" aria-label="Escenario">${SCENARIOS.map((s) => `<option ${p?.scenario === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><button class="primary-btn" data-action="run-pipeline" type="button">${icon('play', 14)} Validar</button></div>${repro}</section>
  <section class="panel panel-pad mt"><div class="panel-title"><span class="grow">2 · Exactitud frente a valores de referencia</span><button class="outline-btn" data-action="run-checks" type="button">${icon('play', 14)} Validar métodos</button></div><p class="section-sub">Compara los resultados del motor con valores analíticos conocidos: raíces, integrales, ecuaciones diferenciales, interpolación y sistemas lineales.</p>${exact}</section>`;
}

/* ---------- vistas: proyecto (3 semanas), conclusiones ---------- */
const weekOf = (d) => (d <= '2026-11-18' ? 1 : d <= '2026-11-25' ? 2 : 3);
const WEEKS = [
  { n: 1, title: 'Modelos y primeros algoritmos', dates: 'Semana 1 · 12 – 18 nov', items: [
    ['Los cuatro casos: modelo, variables, unidades y supuestos', 'inicio', 'Panel general'],
    ['Teoría de errores: absoluto, relativo, porcentual, residual y sensibilidad', 'caso-1', 'Caso 1 → Errores'],
    ['Sistemas lineales: Jacobi, Gauss-Seidel, LU, gradiente conjugado y solución directa', 'caso-2', 'Caso 2 → Sistemas'],
    ['Los tres escenarios: NORMAL, ESTRÉS y MAL CONDICIONADO', 'caso-2', 'Botones de escenario'],
    ['Diseño de la base de datos (DER y esquema SQL)', 'basedatos', 'Base de datos → Esquema y DER']] },
  { n: 2, title: 'Métodos completos y base de datos', dates: 'Semana 2 · 19 – 25 nov', items: [
    ['Interpolación: Lagrange, Newton (diferencias divididas) y spline cúbico', 'caso-4', 'Caso 4 → Interpolación'],
    ['Raíces: bisección, Newton-Raphson y secante', 'caso-2', 'Caso 2 → Raíces'],
    ['Integración: trapecio, Simpson 1/3 y Romberg', 'caso-3', 'Caso 3 → Integración'],
    ['Ecuaciones diferenciales: Runge-Kutta de 2.º y 4.º orden', 'caso-3', 'Caso 3 → EDO'],
    ['Comparación de los escenarios ESTRÉS y MAL CONDICIONADO', 'comparacion', 'Comparación'],
    ['Base de datos funcional: guardar, recuperar y repetir un experimento', 'validacion', 'Validación']] },
  { n: 3, title: 'Validación y conclusiones', dates: 'Semana 3 · 26 nov – 2 dic', items: [
    ['Los 12 experimentos con referencia verificada', 'validacion', 'Validación → verificaciones'],
    ['Tablas de iteraciones y gráficos de error y convergencia', 'caso-1', 'Cada caso → pestaña Gráficos'],
    ['Conclusión numérica y conclusión del problema por caso, e integradora', 'conclusiones', 'Conclusiones'],
    ['Base de datos con ver, editar y eliminar, y consola SQL', 'basedatos', 'Base de datos']] },
];
const FAILS = [
  ['El avance de la Semana 1 modelaba el deterioro con una EDO exponencial, distinta de la ley cuadrática de la consigna.', 'Comparación con la consigna', 'Se unificó en D(t) = D₀ + αt + βt² con fórmula cerrada y comprobación de t*.'],
  ['Newton y la secante parecían converger con raíz triple, pero con error 10⁻⁴ y residual 10⁻¹³.', 'Escenario MAL CONDICIONADO del caso 1', 'Se añadieron el orden observado, el Newton modificado y la tabla de sensibilidad.'],
  ['Gauss-Seidel necesitaba más de 8 000 iteraciones en las ecuaciones normales sin escalar.', 'Calibración del caso 2', 'Se documentó como efecto de κ₂(XᵀX) ≈ κ₂(X)² y se ofreció el escalamiento.'],
  ['La instantánea de cada simulación pesaba ≈ 560 KB.', 'Medición del tamaño de la base', 'Se excluyeron las ejecuciones (ya están en tablas) y se redujeron las series: ≈ 60 KB.'],
  ['Una vista SQL usaba una subconsulta correlacionada no soportada por el intérprete.', 'Prueba de consultas', 'Se reescribió con LEFT JOIN + GROUP BY y se validó contra SQLite 3.'],
  ['El formulario de edición no guardaba: el campo id ocultaba la propiedad form.id.', 'Prueba de interfaz en navegador', 'Se lee el atributo con getAttribute.'],
  ['El botón Guardar del formulario quedaba fuera de pantalla en ventanas bajas.', 'Prueba de interfaz', 'Diálogo con zona desplazable y botones fijos.'],
  ['Con nodos uniformes pares el fenómeno de Runge era poco visible.', 'Gráfico de nodos', 'Se usaron n = 5, 9, 13, 17, 21 y se comparó con Chebyshev.'],
];
function renderProject() {
  const sims = db.count('simulacion');
  const card = (w) => `<article class="week-card"><header><span class="week-n">Fase ${w.n}</span></header><h3>${esc(w.title)}</h3><p class="muted">${esc(w.dates)}</p><ul class="check-list">${w.items.map(([t, go, where]) => `<li><span class="pill">${icon('check', 12)}</span><div><strong>${esc(t)}</strong><small>${esc(where)}</small></div><button class="mini-btn" data-nav="${go}" type="button">Abrir</button></li>`).join('')}</ul></article>`;
  return `<div class="main-heading"><div><h1>Las tres fases del proyecto</h1><p class="lead">Lo que se construyó en cada semana, con un acceso directo a cada parte.</p></div></div>
  <div class="stats-grid three"><div class="stat-card"><strong class="stat-number">4</strong><div class="stat-label">Casos de estudio</div></div><div class="stat-card"><strong class="stat-number">12</strong><div class="stat-label">Experimentos (4 × 3 escenarios)</div></div><div class="stat-card"><strong class="stat-number">16</strong><div class="stat-label">Métodos numéricos</div></div><div class="stat-card"><strong class="stat-number">${sims}</strong><div class="stat-label">Simulaciones guardadas</div></div></div>
  <div class="week-grid">${WEEKS.map(card).join('')}</div>
  ${dataTable({ title: 'Semana 2 · Experimentos y fallos detectados', headers: ['Fallo detectado', 'Cómo se detectó', 'Corrección'], rows: FAILS, note: 'Todos están corregidos y cubiertos por alguna de las pruebas automáticas o por la pantalla Validación.' }, { wrap: true })}`;
}

function renderConclusions() {
  const rows = computeComparison();
  const caseBlock = (c) => { const n = rows.find((x) => x.c.id === c.id && x.s === 'NORMAL'); return `<section class="concl-case"><div class="case-header"><div class="case-icon ${caseColor(c.id)}">${icon(c.icon, 22)}</div><div class="case-title"><h3>Caso ${c.id} · ${esc(c.name)}</h3><small>${esc(c.methods)}</small></div></div><div class="double-insight"><article class="insight math"><h3>${icon('calculator', 18)} Conclusión numérica</h3><p>${esc(n.r.numeric)}</p></article><article class="insight physical"><h3>${icon('activity', 18)} Conclusión del problema</h3><p>${esc(n.r.physical)}</p></article></div>${dataTable({ title: 'Los tres escenarios', headers: ['Escenario', 'Métrica principal', 'Valor', 'Métodos convergidos'], rows: SCENARIOS.map((s) => { const x = rows.find((y) => y.c.id === c.id && y.s === s); return [s, x.r.metric.label, `${nfmt(x.r.metric.value, 6)} ${x.r.metric.unit}`, `${x.conv} / ${x.total}`]; }), note: rows.find((y) => y.c.id === c.id && y.s === 'MAL CONDICIONADO').r.note }, { compact: true })}<div class="form-actions row"><button class="outline-btn" data-nav="caso-${c.id}" type="button">Abrir el caso ${c.id} ${icon('arrow', 14)}</button></div></section>`; };
  return `<div class="main-heading"><div><h1>Conclusiones</h1><p class="lead">Para cada caso, una conclusión sobre los métodos numéricos y otra sobre el problema, claramente separadas, calculadas con los parámetros del escenario NORMAL. Al final, la conclusión integradora y las limitaciones.</p></div></div>
  ${CASES.map(caseBlock).join('')}
  <section class="panel panel-pad"><div class="panel-title"><span class="grow">Conclusión integradora</span></div><p class="concl-text">Los cinco bloques de la asignatura (errores, sistemas lineales, interpolación, raíces, integración y EDO) se aplicaron a problemas con significado y se verificaron contra soluciones analíticas. Tres ideas atraviesan los doce experimentos. <strong>La referencia importa:</strong> sin una solución exacta o una cuadratura justificada no se distingue un buen algoritmo de uno que solo parece converger. <strong>Error, residual, sensibilidad y condicionamiento son cosas distintas:</strong> confundirlos lleva a conclusiones falsas (un residual de 10⁻¹³ con un error de 10⁻⁴ en la raíz triple; una matriz con κ₂ = 10⁶ que se resuelve en una iteración y aun así amplifica las perturbaciones un millón de veces). <strong>La incertidumbre del modelo suele dominar al error numérico:</strong> en el caso 2 la dispersión de t* por la incertidumbre de α y β (≈ 9 %) es mayor que el error de cualquier método de raíces (&lt; 10⁻⁸). La base de datos relacional convierte cada experimento en evidencia que se recupera y se repite dentro de la tolerancia.</p></section>
  <section class="panel panel-pad mt"><div class="panel-title"><span class="grow">Limitaciones</span></div><ul class="plain-list"><li>Los cuatro casos son ilustraciones matemáticas con datos sintéticos; no incluyen parámetros operativos reales, dinámica no lineal completa, interacción cabina–cable–torre ni turbulencia.</li><li>El índice D(t) no es un calendario de mantenimiento, la integral de x² no es energía mecánica y la reconstrucción no sustituye a un dato registrado.</li><li>Las probabilidades de Monte Carlo ilustran la propagación de incertidumbre; no son probabilidades de falla.</li><li>La base de datos vive en este navegador: respáldala con Exportar SQL o JSON en la sección Base de datos.</li></ul></section>`;
}

/* ---------- render ---------- */
function render() {
  if (state.draftBase !== state.params) { state.draft = toDraft(state.params); state.draftBase = state.params; }
  renderNav();
  app.innerHTML = { inicio: renderHome, caso: renderCase, comparacion: renderComparison, historial: renderHistory, basedatos: renderDb, validacion: renderValidation, proyecto: renderProject, conclusiones: renderConclusions }[state.view]();
}

/* ---------- acciones ---------- */
function readParams() { const o = {}; for (const d of PARAM_DEFS[state.caseId]) { const el = $(`#param-${d.key}`); if (!el || el.value.trim() === '') throw Error(`Completa el campo «${d.label}».`); o[d.key] = Number(el.value); } return o; }
function runCurrent() {
  try { const params = readParams(); state.result = simulateCase(state.caseId, state.scenario, params); state.params = params; state.savedId = null; state.recovered = null; state.verify = null; state.tab = 'resumen'; render(); toast('Simulación completada.'); }
  catch (err) { const e = $('#formError'); if (e) e.innerHTML = `<div class="alert error">${icon('info', 14)} <span>${esc(err.message)}</span></div>`; toast('Revisa los parámetros.', 'bad'); }
}
function loadSaved(id, rerun = false) {
  const { sim, result } = Repo.loadSimulation(db, id), esc_ = db.get('escenario', sim.escenario_id);
  state.view = 'caso'; state.caseId = esc_.caso_id; state.scenario = esc_.tipo; state.params = JSON.parse(esc_.parametros_json); state.tab = 'resumen';
  if (rerun) { state.result = simulateCase(state.caseId, state.scenario, state.params); state.savedId = id; state.recovered = null; }
  else { state.result = result; state.savedId = id; state.recovered = id; }
  state.verify = null; history.replaceState(null, '', `#caso-${state.caseId}`); render(); window.scrollTo({ top: 0 });
}
async function verifyId(id) {
  const v = await Repo.verifySimulation(db, id, 1e-9);
  state.verify = { id, ok: v.ok, rows: v.rows, maxDiff: v.maxDiff, metricDiff: v.metricDiff, tol: v.tol }; render(); toast(v.ok ? 'Reproducibilidad verificada: resultados dentro de tolerancia.' : 'Hay diferencias fuera de tolerancia.', v.ok ? '' : 'bad');
}
function download(name, text, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
function formFor(table, row = null, defaults = {}) {
  const cols = TABLES[table].columns;
  return cols.map((c) => {
    const v = row ? row[c.name] : (defaults[c.name] ?? c.default ?? ''); const ro = c.pk && (row || c.auto);
    const hint = c.fk ? ` <small>→ ${c.fk.table}.${c.fk.column}</small>` : c.check ? ` <small>${c.check.join(' | ')}</small>` : '';
    let input;
    if (c.check && !c.fk) input = `<select name="${c.name}" ${ro ? 'disabled' : ''}>${c.notNull ? '' : '<option value=""></option>'}${c.check.map((o) => `<option value="${esc(o)}" ${String(v) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (c.json || (c.type === 'TEXT' && String(v ?? '').length > 70)) input = `<textarea name="${c.name}" rows="${c.json ? 5 : 3}" spellcheck="false">${esc(v ?? '')}</textarea>`;
    else input = `<input name="${c.name}" ${c.type === 'INTEGER' || c.type === 'REAL' ? 'type="number" step="any"' : 'type="text"'} value="${esc(v ?? '')}" ${ro ? 'readonly' : ''} ${c.pk && !row && c.auto ? 'placeholder="(automático)"' : ''}/>`;
    return `<div class="field wide"><label>${c.pk ? '🔑 ' : ''}${c.name} <small>${c.type}${c.notNull && !c.pk ? ' · obligatorio' : ''}</small>${hint}</label>${input}</div>`;
  }).join('');
}
function openRecordForm(table, id = null, defaults = {}) {
  const row = id === null ? null : db.get(table, id);
  modal(`<h3>${row ? 'Editar' : 'Nuevo'} registro en ${table}${row ? ` · #${id}` : ''}</h3><form id="recordForm" data-table="${table}" data-id="${id ?? ''}"><div class="modal-body scroll">${formFor(table, row, defaults)}</div><div id="recErr"></div><div class="modal-actions"><button class="ghost-btn" type="button" data-modal="cancel">Cancelar</button><button class="primary-btn" type="submit">${icon('save', 14)} Guardar</button></div></form>`, { wide: true });
  $('#modal').onclick = (e) => { if (e.target.id === 'modal' || e.target.closest('[data-modal="cancel"]')) { closeModal(); $('#modal').onclick = null; } };
}
async function runPipeline() {
  const caseId = Number($('#pipeCase').value), scenario = $('#pipeScenario').value, tol = Number($('#pipeTol')?.value || 1e-9), steps = [];
  const push = (title, detail, ok = true) => steps.push({ title, detail, ok });
  state.pipeline = { caseId, scenario, steps, cmp: null }; const t0 = performance.now();
  try {
    const result = simulateCase(caseId, scenario, PRESETS[caseId][scenario]); push('1 · Ejecutar', `${CASES[caseId - 1].name} · ${scenario}: ${result.runs.length} ejecuciones de métodos, métrica ${nfmt(result.metric.value, 8)} ${result.metric.unit}.`);
    const id = await Repo.saveSimulation(db, result, { etiqueta: `Prueba de persistencia · ${CASES[caseId - 1].short} · ${scenario}`, notas: 'Generada por la prueba obligatoria.' });
    const iters = db.find('ejecucion_metodo', (m) => m.simulacion_id === id).reduce((n, m) => n + db.find('iteracion_resultado', (i) => i.ejecucion_id === m.id).length, 0);
    push('2 · Guardar', `Simulación #${id} escrita en 6 tablas: ${result.runs.length} ejecuciones, ${iters} iteraciones.`);
    const before = Object.fromEntries(TABLE_ORDER.map((t) => [t, db.count(t)]));
    db = await openDb(true); sql = new SQL(db); window.simtele = { db, sql, Repo }; const after = Object.fromEntries(TABLE_ORDER.map((t) => [t, db.count(t)]));
    const same = TABLE_ORDER.every((t) => before[t] === after[t]);
    push('3 · Cerrar y reabrir', `Conexión nueva a IndexedDB. Conteos iguales en las ${TABLE_ORDER.length} tablas: ${same ? 'sí' : 'NO'}.`, same);
    const rec = Repo.loadSimulation(db, id); const esc_ = db.get('escenario', rec.sim.escenario_id);
    push('4 · Recuperar', `Parámetros: ${esc_.parametros_json.slice(0, 90)}…; ${rec.runs.length} ejecuciones y ${rec.runs.reduce((n, m) => n + m.iteraciones.length, 0)} iteraciones; ${rec.result.plots.length} gráficos reconstruibles.`);
    const cmp = await Repo.verifySimulation(db, id, tol);
    push('5 · Repetir el cálculo', `Se resolvió de nuevo con los parámetros recuperados (${cmp.fresh.runs.length} ejecuciones).`);
    push('6 · Comparar', `Diferencia relativa máxima ${nfmt(cmp.maxDiff)}; métrica ${nfmt(cmp.metricDiff)}; tolerancia ${nfmt(tol)} → ${cmp.ok ? 'COINCIDEN' : 'NO COINCIDEN'} (${((performance.now() - t0) / 1000).toFixed(2)} s).`, cmp.ok);
    state.pipeline.cmp = { ok: cmp.ok, rows: cmp.rows, maxDiff: cmp.maxDiff, tol };
  } catch (e) { push('Error', e.message, false); }
  render();
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action],[data-nav]'); if (!b) return;
  if (b.dataset.nav) { navigate(b.dataset.nav); return; }
  const a = b.dataset.action, id = b.dataset.id ? Number(b.dataset.id) : null;
  try {
    switch (a) {
      case 'scenario': state.scenario = b.dataset.value; state.params = { ...PRESETS[state.caseId][state.scenario] }; state.result = simulateCase(state.caseId, state.scenario, state.params); state.savedId = null; state.recovered = null; state.verify = null; state.tab = 'resumen'; render(); break;
      case 'reset': state.params = { ...PRESETS[state.caseId][state.scenario] }; state.result = simulateCase(state.caseId, state.scenario, state.params); state.savedId = null; state.recovered = null; state.verify = null; render(); toast('Parámetros restablecidos.'); break;
      case 'tab': state.tab = b.dataset.value; render(); break;
      case 'save': { if (!state.result || state.savedId) break; if (isDirty(PARAM_DEFS[state.caseId], state.draft, state.params)) { toast('Hay parámetros sin ejecutar. Pulsa Ejecutar antes de guardar.', 'bad'); break; } const sid = await Repo.saveSimulation(db, state.result); state.savedId = sid; render(); toast(`Guardada como simulación #${sid}. Ya está en el historial.`); break; }
      case 'verify': await verifyId(state.savedId); break;
      case 'open-saved': loadSaved(id); toast('Simulación recuperada desde la base de datos.'); break;
      case 'rerun': loadSaved(id, true); await verifyId(id); break;
      case 'edit-sim': { const s = db.get('simulacion', id); modal(`<h3>Editar simulación #${id}</h3><form id="simMetaForm" data-id="${id}"><div class="modal-body"><div class="field wide"><label>Etiqueta</label><input name="etiqueta" value="${esc(s.etiqueta ?? '')}" maxlength="120"/></div><div class="field wide"><label>Notas</label><textarea name="notas" rows="4">${esc(s.notas ?? '')}</textarea></div></div><div class="modal-actions"><button class="ghost-btn" type="button" data-modal="cancel">Cancelar</button><button class="primary-btn" type="submit">Guardar cambios</button></div></form>`); $('#modal').onclick = (ev) => { if (ev.target.id === 'modal' || ev.target.closest('[data-modal="cancel"]')) { closeModal(); $('#modal').onclick = null; } }; break; }
      case 'del-sim': { const c = db.cascadeCount('simulacion', id); const ok = await confirmModal(`Eliminar simulación #${id}`, `<p>Se eliminarán también ${c.ejecucion_metodo || 0} ejecuciones, ${c.iteracion_resultado || 0} iteraciones, ${c.resultado_resumen || 0} resúmenes y ${c.verificacion || 0} verificaciones (ON DELETE CASCADE). Esta acción no se puede deshacer.</p>`); if (ok) { await Repo.deleteSimulation(db, id); if (state.savedId === id) { state.savedId = null; state.recovered = null; } render(); toast('Simulación eliminada con sus datos dependientes.'); } break; }
      case 'seed-ref': { toast('Ejecutando y guardando los 12 experimentos…'); await new Promise((r) => setTimeout(r, 30)); const n = (await Repo.seedReference(db)).length; render(); toast(n ? `Se guardaron ${n} experimentos de referencia.` : 'Los 12 experimentos ya estaban guardados.'); break; }
      case 'db-tab': state.dbTab = b.dataset.value; render(); break;
      case 'reg-page': state.regPage = Math.max(0, state.regPage + Number(b.dataset.value)); render(); break;
      case 'db-export-csv': exportCsv(); break;
      case 'verify-all': await verifyAll(); break;
      case 'db-export-json': download('simtele_risk.json', JSON.stringify(db.exportJSON(), null, 1), 'application/json'); toast('Respaldo JSON exportado.'); break;
      case 'persist-test': { const before = Object.fromEntries(TABLE_ORDER.map((t) => [t, db.count(t)])); db = await openDb(true); sql = new SQL(db); const same = TABLE_ORDER.every((t) => before[t] === db.count(t)); state.persistTest = { ok: same, msg: same ? `Base reabierta: ${TABLE_ORDER.map((t) => `${t}=${db.count(t)}`).join(', ')}.` : 'Los conteos no coinciden.' }; render(); break; }
      case 'db-reset': { if (await confirmModal('Reiniciar la base de datos', '<p>Se eliminarán todas las simulaciones, ejecuciones e iteraciones. Quedarán los 4 casos y los 12 escenarios iniciales.</p>', 'Reiniciar')) { await db.clearAll(); await Repo.seedBase(db); state.savedId = null; state.recovered = null; render(); toast('Base reiniciada.'); } break; }
      case 'run-pipeline': await runPipeline(); break;
      case 'run-checks': state.checks = runSelfChecks(); render(); toast(`${state.checks.filter((c) => c.ok).length} de ${state.checks.length} verificaciones correctas.`); break;
      case 'close-menu': closeMenu(); break;
    }
  } catch (err) { toast(err.message || String(err), 'bad'); console.error(err); render(); }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fid = e.target.getAttribute('id');
  if (fid === 'parametersForm') return runCurrent();
  if (fid === 'simMetaForm') { const f = new FormData(e.target); try { await Repo.updateSimulationMeta(db, Number(e.target.dataset.id), { etiqueta: f.get('etiqueta') || null, notas: f.get('notas') || null }); closeModal(); render(); toast('Simulación actualizada.'); } catch (err) { toast(err.message, 'bad'); } return; }
  if (fid === 'recordForm') {
    const table = e.target.dataset.table, idv = e.target.dataset.id, f = new FormData(e.target), data = {};
    for (const c of TABLES[table].columns) { if (c.pk && (idv || c.auto)) continue; if (f.has(c.name)) { const v = f.get(c.name); data[c.name] = v === '' ? null : v; } }
    try {
      if (idv) await db.update(table, Number(idv), data, { audit: true }); else await db.transaction(async () => db.insert(table, data), { audit: true });
      closeModal(); state.dbMsg = idv ? `Registro ${table} #${idv} actualizado.` : `Nuevo registro insertado en ${table}.`; render(); toast('Cambios guardados en la base.');
    } catch (err) { const el = $('#recErr'); if (el) el.innerHTML = `<div class="alert error">${icon('info', 14)} <span>${esc(err.message)}</span></div>`; }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.closest?.('#parametersForm') && e.target.name) { state.draft[e.target.name] = e.target.value; refreshStale(); return; }
  if (e.target.id === 'regCase' || e.target.id === 'regScen') { state[e.target.id] = e.target.value; state.regPage = 0; $('#regResults').innerHTML = regTable(); return; }
  if (e.target.id === 'regSearch') { state.regQuery = e.target.value; state.regPage = 0; $('#regResults').innerHTML = regTable(); }
  if (e.target.id === 'historySearch') { state.histQuery = e.target.value; $('#historyResults').innerHTML = historyList(); }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'historyScenario') { state.histScenario = e.target.value; $('#historyResults').innerHTML = historyList(); }
  if (e.target.id === 'historyCase') { state.histCase = e.target.value; $('#historyResults').innerHTML = historyList(); }
  if (e.target.id === 'importFile') importFile(e.target.files[0]);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
async function importFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    if (file.name.endsWith('.json')) await db.importJSON(JSON.parse(text)); else await sql.importDump(text);
    state.savedId = null; state.recovered = null; toast('Respaldo importado.'); render();
  } catch (err) { toast('No se pudo importar: ' + err.message, 'bad'); }
}
$('#menuToggle').addEventListener('click', () => { $('.sidebar').classList.toggle('open'); $('#mobileBackdrop').classList.toggle('show'); });
window.addEventListener('hashchange', () => { const t = decodeURIComponent(location.hash.slice(1)) || 'inicio'; const cur = state.view === 'caso' ? `caso-${state.caseId}` : state.view; if (t !== cur) navigate(t); });

async function openDb(forceNew = false) {
  let adapter; state.volatile = false;
  try { if (!('indexedDB' in window)) throw 0; adapter = new IndexedDBAdapter(); await adapter.open(); } catch { adapter = window.__memAdapter ||= new MemoryAdapter(); state.volatile = true; }
  if (forceNew && db?.adapter instanceof IndexedDBAdapter) { try { db.adapter._db?.then((x) => x.close()); } catch { /* cerrar */ } adapter = new IndexedDBAdapter(); }
  const d = await new Database(adapter).open(); await Repo.seedBase(d); d.onChange(() => renderNav()); return d;
}
(async () => {
  try { db = await openDb(); sql = new SQL(db); }
  catch (e) { app.innerHTML = `<div class="alert error">No se pudo abrir la base de datos: ${esc(e.message)}</div>`; return; }
  window.simtele = { db, sql, Repo }; // útil para la defensa desde la consola del navegador
  navigate(decodeURIComponent(location.hash.slice(1)) || 'inicio');
})();

function exportCsv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = Repo.listSimulations(db).map((s) => [s.id, s.fecha, CASES[s.caso_id - 1].name, s.tipo, s.metodos, s.metrica_valor, s.metrica_unidad ?? '', s.verificacion ? (s.verificacion.aprobada ? 'Reproducida' : 'Con diferencias') : 'Sin verificar']);
  download('simtele_risk_registros.csv', '\ufeff' + [['N.º', 'Fecha', 'Módulo', 'Escenario', 'Métodos', 'Resultado', 'Unidad', 'Verificación'], ...rows].map((r) => r.map(q).join(',')).join('\n'), 'text/csv'); toast('Registros exportados a CSV.');
}
async function verifyAll() {
  const ids = db.all('simulacion').map((s) => s.id); toast(`Verificando ${ids.length} registro(s)…`); await new Promise((r) => setTimeout(r, 30));
  let good = 0, maxDiff = 0; for (const id of ids) { const v = await Repo.verifySimulation(db, id, 1e-9); if (v.ok) good++; maxDiff = Math.max(maxDiff, v.maxDiff || 0); }
  state.verifyAll = { n: ids.length, good, ok: ids.length > 0 && good === ids.length, maxDiff }; render();
}
