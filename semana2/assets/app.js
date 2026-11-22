import {CASES,SCENARIOS,PARAM_DEFS,PRESETS,simulateCase,nfmt,evaluateSensorIA} from './math.js';
import {initStorage,getStorageMode,listExperiments,saveExperiment,removeExperiment,databasePreview,importWeek1} from './storage.js';
import {monteCarloSensor,suggestedSigma} from './analisis-ia.js';
import {verifyExperiment} from './verificacion.js';

const $=s=>document.querySelector(s);
const app=$('#app'), sideNav=$('#sideNav');
const state={view:'inicio',caseId:1,scenario:'NORMAL',params:{...PRESETS[1].NORMAL},result:null,savedId:null,history:[],query:'',historyScenario:'TODOS',dbTable:'simulacion',dbPreview:null,dbQuery:'',aiScenario:'NORMAL',mcRuns:200,mcSeed:20261121,mcSigma:suggestedSigma('NORMAL'),verification:null};
const COLORS=['#396fe5','#10a68e','#ea9850','#8e74da','#e15c76'];
const icons={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 brake:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 8h8M8 13h8M9 21l-2 2m10-2 2 2"/>',
 tool:'<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 17.7 6.3 21l5.4-5.3a5 5 0 0 0 6.4-6.4L15 12l-3-3z"/>',
 wind:'<path d="M3 8h11c4 0 4-5 1-5-2 0-3 1-3 2M2 12h16c4 0 4 6 0 6-2 0-3-1-3-2M3 16h7c4 0 4 5 1 5-2 0-3-1-3-2"/>',
 activity:'<path d="M2 12h4l3-7 4 14 3-7h6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 chart:'<path d="M3 3v18h18M7 16l4-5 3 2 6-7"/>',
 history:'<path d="M3 12a9 9 0 1 0 2-6M3 4v5h5M12 7v5l3 2"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 chevron:'<path d="m15 18-6-6 6-6"/>',
 calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2"/>',
 play:'<path d="m8 5 12 7-12 7z"/>',
 save:'<path d="M4 3h14l3 3v15H3V3zm2 0v7h11V3M7 21v-8h10v8"/>',
 reset:'<path d="M3 11a9 9 0 1 1 3 7M3 4v7h7"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 flask:'<path d="M9 3h6m-5 0v7l-6 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-9V3M8 15h8"/>',
 shield:'<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6zM9 12l2 2 4-4"/>',
 database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v7m4-7v7"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 spark:'<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 file:'<path d="M6 2h8l5 5v15H6zM14 2v5h5M9 12h7m-7 4h7"/>'
};
function icon(name,size=19){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.info}</svg>`;}
function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function number(v){return typeof v==='number'?nfmt(v):String(v);}
function metric(v){return typeof v==='number'?nfmt(v):v;}
const simpleDate=iso=>new Date(iso).toLocaleString('es-BO',{dateStyle:'medium',timeStyle:'short'});
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');window.clearTimeout(toast._id);toast._id=setTimeout(()=>t.classList.remove('show'),3000);}
function navButton(label,key,ico,count='') {const active=state.view==='caso'?key===`caso-${state.caseId}`:key===state.view;return `<button class="nav-button ${active?'active':''}" data-nav="${key}" type="button">${icon(ico,18)}<span>${esc(label)}</span>${count?`<span class="nav-number">${esc(count)}</span>`:''}</button>`;}
function renderNav(){
  sideNav.innerHTML=`<div class="side-label">PLATAFORMA</div>${navButton('Panel general','inicio','home')}${navButton('Comparación','comparacion','chart')}${navButton('Historial','historial','history',String(state.history.length))}${navButton('Base de datos','base-datos','database')}${navButton('Laboratorio IA','laboratorio-ia','spark')}<div class="side-label" style="margin-top:26px">CASOS DE ESTUDIO</div>${CASES.map(c=>navButton(c.short,`caso-${c.id}`,c.icon,`0${c.id}`)).join('')}`;
  $('#historyCount').textContent=String(state.history.length);
  const bc=state.view==='inicio'?'Inicio':state.view==='caso'?CASES[state.caseId-1].short:state.view==='historial'?'Historial':state.view==='base-datos'?'Base de datos':state.view==='laboratorio-ia'?'Laboratorio IA':'Comparación';
  $('#breadcrumb').textContent=`Plataforma / ${bc}`;
}
function sectionTitle(tag,title,description){return `<div class="main-heading"><div><div class="eyebrow-blue">${esc(tag)}</div><h1>${esc(title)}</h1>${description?`<p class="lead">${esc(description)}</p>`:''}</div></div>`;}
function caseColor(id){return ['icon-blue','icon-teal','icon-orange','icon-purple'][id-1];}
function caseCard(c){return `<article class="case-card"><div class="case-header"><div class="case-icon ${caseColor(c.id)}">${icon(c.icon,24)}</div><div class="case-title"><h3>${esc(c.name)}</h3><small>CASO 0${c.id} · Módulo obligatorio</small></div></div><p>${esc(c.description)}</p><div class="case-model">${esc(c.model)}</div><div class="case-bottom"><span class="chip">${esc(c.methods)}</span><button class="text-link" data-nav="caso-${c.id}" type="button">Explorar ${icon('arrow',14)}</button></div></article>`;}
function heroGraphic(){return `<svg viewBox="0 0 300 190" fill="none" aria-hidden="true"><path d="m8 46 280-31M75 38l-12 21m146-31 12 16" stroke="#7194d3" stroke-width="2"/><path d="M150 32v50" stroke="#8eaeeb" stroke-width="4"/><path d="M150 82h-62c-10 0-17 8-17 18v49c0 12 9 21 20 21h119c11 0 20-9 20-21v-49c0-10-8-18-18-18z" fill="#274879" stroke="#7fa9ee" stroke-width="3"/><path d="M84 102c0-5 4-9 9-9h44v40H84zm62-9h55c7 0 12 5 12 12v28h-67z" fill="#88b7f8" fill-opacity=".24" stroke="#77a5ef" stroke-width="1.5"/><path d="M91 148h120" stroke="#85a9e6" stroke-width="3"/><path d="M109 171l-8 10m93-10 9 10" stroke="#8eaeeb" stroke-width="3"/><circle cx="260" cy="104" r="16" stroke="#74d9c1" stroke-opacity=".65"/><path d="m252 104 6 6 10-11" stroke="#74d9c1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function databaseModeLabel(){return getStorageMode()==='sqlite'?'SQLite · servidor local':'IndexedDB · este navegador';}
function dashboardExcerpt(){
 const recent=state.history.slice(0,5);
 return `<section class="dashboard-data"><div class="section-heading"><div><div class="eyebrow-blue">CORRECCIÓN DEL DOCENTE · SEMANA 2</div><h2>Datos realmente guardados</h2><p>Tabla del historial persistente · ${esc(databaseModeLabel())} · ${state.history.length} registros.</p></div><button data-nav="base-datos" class="outline-btn" type="button">Ver base de datos ${icon('arrow',14)}</button></div>
 <div class="comparison-card"><div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Caso</th><th>Escenario</th><th>Parámetros</th><th>Resultado</th><th>Acción</th></tr></thead><tbody>${recent.length?recent.map(r=>`<tr><td>${esc(simpleDate(r.createdAt))}</td><td>${esc(CASES[r.result.caseId-1]?.short||'—')}</td><td>${esc(r.result.scenario)}</td><td class="cell-clip">${esc(JSON.stringify(r.result.params))}</td><td>${esc(nfmt(r.result.metric?.value))} ${esc(r.result.metric?.unit)}</td><td><button class="mini-btn" data-action="open-saved" data-id="${esc(r.id)}">Abrir</button></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty-hint">No hay registros guardados. Ejecuta un caso y pulsa «Guardar ejecución» o utiliza «Cargar 4 demostraciones» en Base de datos.</div></td></tr>`}</tbody></table></div></div></section>`;
}
function filteredDbRows(){const q=state.dbQuery.trim().toLowerCase();return state.history.filter(h=>`${h.createdAt} ${h.id} ${CASES[h.result.caseId-1]?.short} ${h.result.scenario} ${JSON.stringify(h.result.params)}`.toLowerCase().includes(q));}
function renderDbRecords(){
 const rows=filteredDbRows();
 return rows.length?`<div class="comparison-card"><div class="table-scroll"><table><thead><tr><th>Fecha</th><th>ID</th><th>Módulo</th><th>Escenario</th><th>Parámetros JSON</th><th>Resultado</th><th>Ver/Relanzar</th></tr></thead><tbody>${rows.map(h=>`<tr><td>${esc(simpleDate(h.createdAt))}</td><td title="${esc(h.id)}"><code>${esc(h.id.slice(0,9))}…</code></td><td>${esc(CASES[h.result.caseId-1]?.short)}</td><td>${esc(h.result.scenario)}</td><td class="cell-clip"><code>${esc(JSON.stringify(h.result.params))}</code></td><td>${esc(nfmt(h.result.metric?.value))} ${esc(h.result.metric?.unit)}</td><td><div class="inline-actions"><button type="button" class="mini-btn" data-action="open-saved" data-id="${esc(h.id)}">Abrir</button><button type="button" class="mini-btn" data-action="rerun" data-id="${esc(h.id)}">Relanzar</button><button type="button" class="mini-btn" data-action="verify-saved" data-id="${esc(h.id)}">Verificar</button><button type="button" class="danger-btn" data-action="delete" data-id="${esc(h.id)}" title="Eliminar">${icon('trash',13)}</button></div></td></tr><tr class="details-row"><td colspan="7"><details><summary>Ver registro completo · ${esc(h.id.slice(0,12))}</summary><pre class="json-panel">${esc(JSON.stringify({id:h.id,fecha:h.createdAt,version:h.modelVersion,origen:h.importedFrom||'semana2',parametros:h.result.params,resultado:h.result.metric,tablas:h.result.tables,graficos:h.result.plots,conclusionNumerica:h.result.numeric,conclusionProblema:h.result.physical},null,2))}</pre></details></td></tr>`).join('')}</tbody></table></div></div>`:`<div class="empty-state"><h3>No hay registros que coincidan</h3><p>Guarda un experimento, importa la Semana 1 o crea cuatro demostraciones sintéticas.</p></div>`;
}
const SQL_TABLES=['caso_estudio','escenario','simulacion','ejecucion_metodo','iteracion_resultado','resultado_resumen'];
function renderSqlPreview(){
 const info=state.dbPreview;
 if(!info)return '<div class="empty-hint">Leyendo datos guardados...</div>';
 const cols=info.columns||[];
 const rows=info.rows||[];
 return `<div class="table-scroll"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${cols.map(c=>`<td class="cell-clip">${esc(r[c]??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${Math.max(1,cols.length)}">Sin registros en esta tabla.</td></tr>`}</tbody></table></div><p class="small-muted">Tabla: ${esc(info.table)} · Filas totales: ${info.total} · Vista preliminar (máx. 40 en SQLite).</p>`;
}
function renderDatabase(){
 const sqlite=getStorageMode()==='sqlite';
 return `${sectionTitle('DASHBOARD · CORRECCIÓN DEL DOCENTE','Base de datos y simulaciones','Consulta qué se está guardando, revisa parámetros y resultados, y comprueba la recuperación después de actualizar la página.')}
 <div class="data-overview"><div class="info-panel"><div class="eyebrow-blue">MOTOR DE DATOS</div><h3>${esc(databaseModeLabel())}</h3><p>${sqlite?'Los experimentos se almacenan en SQLite mediante el servidor Python local. Las seis tablas relacionales pueden inspeccionarse aquí.':'GitHub Pages es estático: aquí se guardan los registros en IndexedDB dentro de este navegador. No se comparten automáticamente con tu compañero.'}</p></div><div class="info-panel"><div class="eyebrow-blue">REGISTROS PERSISTIDOS</div><h3 class="big-count">${state.history.length}</h3><p>Experimentación sintética guardada. No son datos operativos reales.</p></div></div>
 <div class="db-actions"><button class="outline-btn" data-action="demo" type="button">${icon('flask',15)} Cargar 4 demostraciones</button><button class="outline-btn" data-action="import-s1" type="button">${icon('database',15)} Importar Semana 1</button><button class="outline-btn" data-action="export" type="button" ${state.history.length?'':'disabled'}>${icon('download',15)} Exportar JSON</button><button class="outline-btn" data-action="csv" type="button" ${state.history.length?'':'disabled'}>${icon('download',15)} Exportar CSV</button></div>
 <div class="section-heading mini-section"><div><h2>Registros guardados</h2><p>Consulta la información persistida, no una tabla de resultados simulados en memoria.</p></div><label class="search-box db-search">${icon('search',16)}<input id="dbSearch" type="search" placeholder="Filtrar por módulo, escenario o fecha" value="${esc(state.dbQuery)}"/></label></div><div id="dbRecords">${renderDbRecords()}</div>
 ${state.verification?`<div class="alert ${state.verification.ok?'info':'error'}" role="status">${icon(state.verification.ok?'check':'info',16)} ${esc(state.verification.message)}</div>`:''}
 <div class="section-heading mini-section"><div><h2>Explorador de tablas de datos</h2><p>${sqlite?'Lectura directa de las tablas reales de SQLite.':'Vista real de la colección «experimentos» de IndexedDB.'}</p></div>${sqlite?`<select class="outline-btn" id="dbTableSelect" aria-label="Tabla SQL">${SQL_TABLES.map(t=>`<option value="${t}" ${state.dbTable===t?'selected':''}>${t}</option>`).join('')}</select>`:''}</div><div class="comparison-card" id="sqlPreview">${renderSqlPreview()}</div>
 <div class="alert info">${icon('info',14)} ${sqlite?'Para trabajar con la misma base de datos en dos equipos necesitarían desplegar un backend remoto con autenticación; este servidor es local.':'Para demostrar persistencia: guarda una simulación, actualiza la página y abre el registro desde aquí. El historial de Semana 1 puede importarse en el mismo navegador y origen.'}</div>`;
}
function renderIALab(){
 const s=state.aiScenario,p=PRESETS[4][s],ai=evaluateSensorIA(s,p);
 const min=Math.min(...ai.metrics.map(r=>r.mae));
 const chart={title:'Error por punto de prueba (evaluación sintética)',xLabel:'Tiempo (s)',yLabel:'Error absoluto (u.)',series:ai.metrics.map(z=>({name:z.method,points:z.errors}))};
 return `${sectionTitle('ENFOQUE DE LA MENCIÓN INTELIGENCIA ARTIFICIAL','Laboratorio de predicción IA','La IA complementa las familias obligatorias de Métodos Numéricos, sin reemplazarlas ni crear un quinto módulo de estudio.')}
 <div class="info-panel lab-banner"><div class="eyebrow-blue">EXPERIMENTO · MÓDULO 4</div><h3>Regresión k-NN (k=2) frente a tres interpolaciones</h3><p>Se entrena k-NN con cuatro muestras observadas de la señal sintética s(t) = A·sen(t). Se evalúa sobre ${ai.testCount} puntos no empleados en el entrenamiento. Las interpolaciones usan los mismos nodos. Las métricas son MAE y RMSE; un menor valor implica mejor ajuste a esta referencia sintética.</p><div class="scenario-selector ia-picker">${SCENARIOS.map(x=>`<button class="scenario-option ${s===x?'selected':''}" type="button" data-action="ai-scenario" data-value="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
 <div class="comparison-card"><h3>Validación con datos separados</h3><div class="table-scroll"><table><thead><tr><th>Algoritmo</th><th>Entrenamiento</th><th>Prueba</th><th>MAE</th><th>RMSE</th><th>Mejor MAE</th></tr></thead><tbody>${ai.metrics.map(z=>`<tr><td>${esc(z.method)}</td><td>4 nodos observados</td><td>${z.samples} puntos</td><td>${esc(nfmt(z.mae))}</td><td>${esc(nfmt(z.rmse))}</td><td>${Math.abs(z.mae-min)<1e-14?'Sí':'—'}</td></tr>`).join('')}</tbody></table></div></div>
 <section class="chart-card lab-chart"><h3>${esc(chart.title)}</h3>${chartSvg(chart)}</section>
 ${(()=>{const mc=monteCarloSensor(s,p,{runs:state.mcRuns,seed:state.mcSeed,sigma:state.mcSigma});const mcchart={title:'Monte Carlo · error absoluto promedio por punto',xLabel:'Tiempo (s)',yLabel:'Error medio absoluto (u.)',series:mc.metrics.map(m=>({name:m.method,points:m.errors}))};return `<section class="info-panel mc-analysis"><div class="eyebrow-blue">MEJORA INTEGRADA DEL TRABAJO EN EQUIPO · IA Y MÉTODOS NUMÉRICOS</div><h3>Monte Carlo: incertidumbre en señales sintéticas</h3><p>Ruido independiente gaussiano N(0, σ²), semilla reproducible y los mismos nodos de ajuste para Lagrange, Newton, spline y k-NN. El resumen calcula el MAE de cada ensayo y su percentil 95 (no es probabilidad de avería).</p><div class="mc-toolbar"><label>Ensayos <input id="mcRuns" type="number" min="20" max="2000" step="20" value="${state.mcRuns}" /></label><label>Ruido σ <input id="mcSigma" type="number" min="0" max="0.5" step="0.001" value="${state.mcSigma}" /></label><label>Semilla <input id="mcSeed" type="number" min="0" max="4294967295" step="1" value="${state.mcSeed}" /></label><button class="outline-btn" data-action="mc-run" type="button">Actualizar estudio</button></div><p class="small-muted">${mc.runs} ensayos · ${mc.testCount} puntos ocultos de evaluación · semilla ${mc.seed}</p><div class="table-scroll"><table><thead><tr><th>Método</th><th>MAE promedio</th><th>MAE percentil 95</th><th>Desv. est. MAE</th></tr></thead><tbody>${mc.metrics.map(m=>`<tr><td>${esc(m.method)}</td><td>${nfmt(m.meanMAE)}</td><td>${nfmt(m.p95MAE)}</td><td>${nfmt(m.sdMAE)}</td></tr>`).join('')}</tbody></table></div><div class="mc-chart">${chartSvg(mcchart)}</div><div class="alert info">${icon('info',14)} ${esc(mc.note)}</div></section>`;})()}
 <div class="double-insight"><article class="insight math"><h3>${icon('spark',18)} Aporte de Inteligencia Artificial</h3><p>Modelo k-NN de regresión no paramétrica, selección de k=2, conjunto de evaluación independiente, métricas MAE y RMSE. Con solo cuatro muestras sintéticas, no se puede afirmar generalización a sensores reales ni capacidad de detectar fallas reales.</p></article><article class="insight physical"><h3>${icon('database',18)} Aporte de Ingeniería de Sistemas</h3><p>Arquitectura de cuatro casos, validaciones, módulos ES, reproducibilidad, seis tablas SQL normalizadas, persistencia recuperable, historial y pruebas. La solución distingue navegador local y backend SQLite, sin presentar a GitHub Pages como una base de datos compartida.</p></article></div>
 <div class="alert">${icon('info',14)} El escenario MAL CONDICIONADO evalúa principalmente el escalamiento matemático de los nodos de interpolación; no implica que k-NN esté mal condicionado ni demuestra un riesgo físico.</div>`;
}
function renderHome(){
 const n=state.history.length;
 return `<div class="hero"><div class="hero-copy"><span class="tag">SEMANA 2 · INTEGRACIÓN MATEMÁTICA + DATOS + IA</span><h1>Simulaciones que convierten <em>números en decisiones.</em></h1><p>Explora cuatro casos hipotéticos de un transporte por cable. Cambia parámetros, compara métodos y conserva tus experimentos.</p><button class="primary-btn" data-nav="caso-1" type="button">Iniciar simulación ${icon('arrow',15)}</button></div><div class="hero-graphic">${heroGraphic()}</div></div>
 <section class="stats-grid"><div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('layers')}</div><span class="small-badge">OBLIGATORIOS</span></div><strong class="stat-number">04</strong><div class="stat-label">Casos de estudio</div><div class="stat-foot">Modelos numéricos integrados</div></div>
 <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('flask')}</div><span class="small-badge">POR MÓDULO</span></div><strong class="stat-number">03</strong><div class="stat-label">Escenarios reproducibles</div><div class="stat-foot">Normal, estrés y mal condicionado</div></div>
 <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('calculator')}</div><span class="small-badge">SPD 4×4</span></div><strong class="stat-number">04</strong><div class="stat-label">Métodos de sistemas lineales</div><div class="stat-foot">Jacobi, GS, LU y CG</div></div>
 <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('database')}</div><span class="small-badge">EN ESTE EQUIPO</span></div><strong class="stat-number">${n.toString().padStart(2,'0')}</strong><div class="stat-label">Experimentos guardados</div><div class="stat-foot">${esc(databaseModeLabel())}</div></div></section>
 <section><div class="section-heading"><div><div class="eyebrow-blue">EXPLORA EL LABORATORIO</div><h2>Cuatro casos. Un solo sistema.</h2><p>Elige un módulo para modificar sus entradas y ver resultados matemáticos reproducibles.</p></div><button class="outline-btn" data-nav="comparacion" type="button">Ver comparación general ${icon('arrow',14)}</button></div><div class="case-grid">${CASES.map(caseCard).join('')}</div></section>
 ${dashboardExcerpt()}<section class="below-home"><div class="info-panel"><div class="eyebrow-blue">ALCANCE DE LA ENTREGA</div><h3>¿Qué incorpora la segunda semana?</h3><ul><li>Modelos, fórmulas, parámetros validados y tres escenarios.</li><li>Tablas, gráficas, errores y conclusiones separadas.</li><li>Sistemas lineales SPD con cuatro métodos y residuales.</li><li>Dashboard con registros guardados y vista de las tablas de almacenamiento.</li><li>Laboratorio de IA: regresión k-NN para datos sintéticos de sensores.</li><li>Guardar, reabrir y relanzar experimentos persistentes.</li></ul></div><div class="info-panel"><div class="eyebrow-blue">IMPORTANTE</div><h3>Simulación sintética, no sistema real</h3><p>Los resultados no proceden de Mi Teleférico, no implican fallas verificadas y no son recomendaciones de seguridad ni mantenimiento. La opción local Python + SQLite permite persistencia SQL real; en GitHub Pages se utiliza IndexedDB del navegador, sin sincronización entre equipos.</p></div></section>`;
}
function chartSvg(config){
  const series=(config.series||[]).filter(s=>s.points?.length);
  if(!series.length)return '<div class="empty-state">Sin datos para graficar.</div>';
  const all=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(!all.length)return '<div class="empty-state">Valores no finitos.</div>';
  let xmin=Math.min(...all.map(p=>p[0])),xmax=Math.max(...all.map(p=>p[0]));
  let ymin=Math.min(...all.map(p=>p[1])),ymax=Math.max(...all.map(p=>p[1]));
  if(xmin===xmax){xmin-=1;xmax+=1;}
  if(ymin===ymax){const extra=Math.max(Math.abs(ymin)*.2,1e-5);ymin-=extra;ymax+=extra;}
  else{const pad=(ymax-ymin)*.12;ymin-=pad;ymax+=pad;}
  if(config.yLabel?.toLowerCase().startsWith('error absoluto') && ymin<0)ymin=0;
  const W=640,H=284,L=67,R=19,T=21,B=49,pw=W-L-R,ph=H-T-B;
  const sx=x=>L+(x-xmin)/(xmax-xmin)*pw;
  const sy=y=>T+(ymax-y)/(ymax-ymin)*ph;
  const fmtTick=x=>Math.abs(x)>=100?Math.round(x).toString():Math.abs(x)>=1?Number(x.toFixed(2)).toString():Math.abs(x)>=.01?Number(x.toFixed(3)).toString():Number(x.toPrecision(2)).toString();
  const grid=Array.from({length:5},(_,i)=>{
    const x=xmin+(xmax-xmin)*i/4,y=ymin+(ymax-ymin)*i/4;
    return `<line x1="${sx(x)}" y1="${T}" x2="${sx(x)}" y2="${T+ph}" stroke="#edf1f8"/><line x1="${L}" y1="${sy(y)}" x2="${W-R}" y2="${sy(y)}" stroke="#edf1f8"/><text x="${sx(x)}" y="${H-B+20}" fill="#94a1b4" text-anchor="middle" font-size="10">${fmtTick(x)}</text><text x="${L-10}" y="${sy(y)+3}" fill="#94a1b4" text-anchor="end" font-size="10">${fmtTick(y)}</text>`;
  }).join('');
  const lines=series.map((s,i)=>{
    const color=COLORS[i%COLORS.length];
    const points=s.points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
    const skip=Math.max(1,Math.ceil(points.length/300));
    const plotPoints=points.filter((_,idx)=>idx%skip===0||idx===points.length-1);
    const coords=plotPoints.map(p=>[sx(p[0]),sy(p[1])]);
    const line=coords.map((p,idx)=>`${idx?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    const dots=points.length<=6?points.map(p=>`<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`).join(''):'';
    return `<path d="${line}" stroke="${color}" fill="none" stroke-width="${i===0?2.7:2.2}" stroke-linecap="round" stroke-linejoin="round" ${i===1?'stroke-dasharray="7 4"':''}/>${dots}`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(config.title)}"><rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="#fcfdff"/>${grid}<line x1="${L}" y1="${T+ph}" x2="${W-R}" y2="${T+ph}" stroke="#b5c1d3"/><line x1="${L}" y1="${T}" x2="${L}" y2="${T+ph}" stroke="#b5c1d3"/>${lines}<text x="${L+pw/2}" y="${H-5}" text-anchor="middle" fill="#71819a" font-size="11">${esc(config.xLabel)}</text><text x="15" y="${T+ph/2}" transform="rotate(-90 15 ${T+ph/2})" text-anchor="middle" fill="#71819a" font-size="11">${esc(config.yLabel)}</text></svg><div class="chart-legend">${series.map((s,i)=>`<span class="legend-item"><i class="legend-marker" style="background:${COLORS[i%COLORS.length]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}
function dataTable(table){return `<section class="table-card"><h3>${esc(table.title)}</h3><div class="table-scroll"><table><thead><tr>${table.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(number(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;}
function renderCase(){
 const c=CASES[state.caseId-1], r=state.result;
 const presetNote=state.scenario==='MAL CONDICIONADO'?'Escenario de sensibilidad matemática; no equivale necesariamente a mayor riesgo físico.':'Los valores son sintéticos y pueden editarse antes de calcular.';
 return `<div class="case-page-heading"><div><button data-nav="inicio" class="back-link" type="button">${icon('chevron',13)} Volver al panel general</button><div class="eyebrow-blue">MÓDULO 0${c.id} · CASO DE ESTUDIO</div><h1>${esc(c.name)}</h1><p class="lead" style="margin:0">${esc(c.description)}</p></div><span class="small-badge">SEMANA 2</span></div>
 <div class="case-layout"><section class="panel panel-pad"><div class="panel-title">${icon('calculator',18)} <span style="flex:1;margin-left:9px">Configurar experimento</span><small>Editable</small></div><p class="section-sub">Define el escenario y ajusta parámetros.</p>
 <div class="select-label">ESCENARIO DE PRUEBA</div><div class="scenario-selector" role="group" aria-label="Escenario">${SCENARIOS.map(s=>`<button type="button" class="scenario-option ${state.scenario===s?'selected':''}" data-action="scenario" data-value="${esc(s)}" aria-pressed="${state.scenario===s}">${esc(s)}</button>`).join('')}</div>
 <form id="parametersForm"><div class="form-grid">${PARAM_DEFS[c.id].map(d=>`<div class="field"><label for="param-${d.key}">${esc(d.label)}</label><div class="input-wrap"><input id="param-${d.key}" name="${d.key}" type="number" required min="${d.min}" max="${d.max}" step="any" value="${esc(state.params[d.key])}" aria-label="${esc(d.label)} en ${esc(d.unit)}"/><span class="unit">${esc(d.unit)}</span></div></div>`).join('')}</div><p class="form-help">Todos los parámetros se validan antes de calcular. Los escenarios restablecen valores de referencia.</p><div class="form-actions"><button type="submit" class="primary-btn">${icon('play',14)} Ejecutar</button><button type="button" class="ghost-btn" data-action="reset">${icon('reset',14)} Restablecer</button></div></form><div id="formError"></div><div class="alert">${icon('info',14)} ${esc(presetNote)}</div></section>
 <section class="panel model-box"><div class="simulation-status"><span class="pill">${icon('check',12)} ${r?'Modelo calculado':'Modelo disponible'}</span>${state.savedId?'<span class="saved-tag">Recuperado / guardado</span>':'<span class="muted-line">Experimentación académica</span>'}</div><div class="model-banner"><div class="eyebrow-blue">MODELO DE REFERENCIA</div><div class="formula">${esc(c.model)}</div><p>Resultados contrastados con referencia analítica o numérica explícita.</p></div><div class="panel-title" style="margin-bottom:13px">Resultados principales</div>${r?`<div class="metrics">${r.summary.map(m=>`<div class="metric"><span class="metric-label">${esc(m.label)}</span><div class="metric-main">${esc(m.value)} <span class="metric-unit">${esc(m.unit)}</span></div></div>`).join('')}</div>`:'<div class="empty-state">Ejecuta el modelo para ver las métricas.</div>'}</section></div>
 ${r?`<div class="results-wrap"><div class="results-head"><div><div class="eyebrow-blue">ANÁLISIS CUANTITATIVO</div><h2>Resultados del experimento</h2><p class="tiny-note">${esc(state.scenario)} · ${esc(c.methods)} · Entradas reproducibles</p></div><div class="results-actions"><button class="outline-btn" data-action="save" type="button" ${state.savedId?'disabled':''}>${icon('save',14)} ${state.savedId?'Guardado':'Guardar ejecución'}</button><button class="ghost-btn" data-nav="comparacion" type="button">Comparar casos ${icon('arrow',14)}</button></div></div><div class="chart-grid">${r.plots.map(pl=>`<section class="chart-card"><h3>${esc(pl.title)}</h3><div class="chart-desc">Resultados calculados en este navegador</div>${chartSvg(pl)}</section>`).join('')}</div>${r.tables.map(dataTable).join('')}<div class="double-insight"><article class="insight math"><h3>${icon('calculator',18)} Conclusión numérica</h3><p>${esc(r.numeric)}</p></article><article class="insight physical"><h3>${icon('activity',18)} Conclusión del problema</h3><p>${esc(r.physical)}</p></article></div><div class="alert info">${icon('info',14)} ${esc(r.note)}</div></div>`:''}`;
}
function renderComparison(){
 const rows=CASES.flatMap(c=>SCENARIOS.map(s=>{try{const r=simulateCase(c.id,s,PRESETS[c.id][s]);return [c.short,s,nfmt(r.metric.value),r.metric.unit,c.id];}catch(e){return [c.short,s,'Error',e.message,c.id];}}));
 const titles=['Caso','Escenario','Métrica principal','Unidad',''];
 return `${sectionTitle('ANÁLISIS INTEGRADOR','Comparación general','Contrasta los resultados de referencia sintéticos de cada módulo y los tres escenarios definidos para la Semana 1.')}
 <div class="comparison-card"><h3>Matriz de los 12 experimentos predefinidos</h3><div class="table-scroll"><table><thead><tr>${titles.map(t=>`<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td><button type="button" class="mini-btn" data-nav="caso-${r[4]}">Abrir caso</button></td></tr>`).join('')}</tbody></table></div></div>
 <p class="compare-note">Las métricas corresponden a magnitudes distintas (metros, meses, etc.). No deben sumarse ni interpretarse como una puntuación unificada de riesgo. En MAL CONDICIONADO pueden coincidir magnitudes físicas con NORMAL porque la prueba numérica es independiente.</p>
 <div class="info-columns"><div class="info-panel"><div class="eyebrow-blue">NORMAL</div><h3>Referencia del modelo</h3><p>Parámetros nominales sintéticos y cálculo verificable mediante solución analítica o método de mayor precisión.</p></div><div class="info-panel"><div class="eyebrow-blue">ESTRÉS</div><h3>Variación de condiciones</h3><p>Parámetros o perturbaciones más exigentes; comparar efectos en el fenómeno y en el algoritmo.</p></div><div class="info-panel"><div class="eyebrow-blue">MAL CONDICIONADO</div><h3>Sensibilidad numérica</h3><p>Raíz múltiple, matriz SPD con condición elevada o nodos mal escalados; no equivale automáticamente a un incidente físico.</p></div></div>`;
}
function historyList(){
 const q=state.query.trim().toLowerCase();
 const filtered=state.history.filter(h=>(state.historyScenario==='TODOS'||h.result.scenario===state.historyScenario)&&(`${CASES[h.result.caseId-1].name} ${h.result.scenario} ${simpleDate(h.createdAt)}`.toLowerCase().includes(q)));
 if(!filtered.length)return `<div class="empty-state">${icon('history',45)}<h3>${state.history.length?'Sin resultados para la búsqueda':'Todavía no hay simulaciones guardadas'}</h3><p>Abre un módulo, pulsa «Ejecutar» y luego «Guardar ejecución». Las recuperaciones funcionan incluso después de recargar la página.</p><button class="primary-btn" type="button" data-nav="caso-1">${icon('play',14)} Ejecutar primer caso</button></div>`;
 return `<div class="history-list">${filtered.map(h=>{const r=h.result,c=CASES[r.caseId-1];return `<article class="history-item"><div class="history-left"><div class="case-icon ${caseColor(c.id)}">${icon(c.icon,20)}</div><div><h3>${esc(c.name)} <span class="small-badge">${esc(r.scenario)}</span></h3><p>${esc(simpleDate(h.createdAt))} · ${esc(r.model)}</p></div></div><div class="history-right"><div class="history-val"><strong>${esc(nfmt(r.metric.value))} ${esc(r.metric.unit)}</strong><span>${esc(r.metric.label)}</span></div><button class="mini-btn" data-action="open-saved" data-id="${esc(h.id)}" type="button">Abrir</button><button class="mini-btn" data-action="rerun" data-id="${esc(h.id)}" type="button">Relanzar</button><button class="danger-btn" data-action="delete" data-id="${esc(h.id)}" type="button" title="Eliminar experimento">${icon('trash',13)}</button></div></article>`;}).join('')}</div>`;
}
function renderHistory(){
 return `${sectionTitle('PERSISTENCIA DE SIMULACIONES','Historial de experimentos','Busca, recupera y relanza una simulación completa con sus entradas, gráficos y tablas, aunque hayas actualizado la página.')}
 <div class="hist-controls"><label class="search-box">${icon('search',17)}<input id="historySearch" type="search" placeholder="Buscar caso, escenario o fecha..." value="${esc(state.query)}" autocomplete="off" /></label><select id="historyScenario" class="outline-btn" aria-label="Filtrar escenarios"><option value="TODOS" ${state.historyScenario==='TODOS'?'selected':''}>Todos los escenarios</option>${SCENARIOS.map(s=>`<option ${state.historyScenario===s?'selected':''} value="${esc(s)}">${esc(s)}</option>`).join('')}</select><button class="outline-btn" data-action="export" type="button" ${state.history.length?'':'disabled'}>${icon('download',14)} Exportar JSON</button></div>
 <div id="historyResults">${historyList()}</div><div class="alert info" style="margin-top:20px">${icon('database',15)} Almacenamiento activo: ${esc(databaseModeLabel())}. En GitHub Pages los datos son locales al navegador; para SQLite ejecuta python server.py y abre http://127.0.0.1:8000/. La vista Base de datos muestra los registros realmente guardados.</div>`;
}
function render(){renderNav();if(state.view==='caso')app.innerHTML=renderCase();else if(state.view==='historial')app.innerHTML=renderHistory();else if(state.view==='comparacion')app.innerHTML=renderComparison();else if(state.view==='base-datos')app.innerHTML=renderDatabase();else if(state.view==='laboratorio-ia')app.innerHTML=renderIALab();else app.innerHTML=renderHome();}
function navigate(target,mode='default'){
 const id=target.startsWith('caso-')?Number(target.split('-')[1]):null;
 if(id&&CASES.some(c=>c.id===id)){
   const same=state.view==='caso'&&state.caseId===id;
   state.view='caso';state.caseId=id;
   if(!same||mode==='fresh'){
     state.scenario='NORMAL';state.params={...PRESETS[id].NORMAL};state.result=simulateCase(id,'NORMAL',state.params);state.savedId=null;
   }
 }else if(['inicio','comparacion','historial','base-datos','laboratorio-ia'].includes(target))state.view=target;
 else target='inicio',state.view='inicio';
 window.location.hash=target;render();if(target==='base-datos')refreshPreview();window.scrollTo({top:0,behavior:'instant'});closeMenu();
}
function closeMenu(){$('.sidebar').classList.remove('open');$('#mobileBackdrop').classList.remove('show');}
function getInputs(){const out={};for(const d of PARAM_DEFS[state.caseId]){
 const el=$(`#param-${d.key}`);if(!el||el.value.trim()==='')throw Error(`Completa el campo «${d.label}».`);
 out[d.key]=Number(el.value);
 }return out;}
function runCurrent(){
 try{
   const params=getInputs(),result=simulateCase(state.caseId,state.scenario,params);
   state.params=params;state.result=result;state.savedId=null;render();toast('Simulación completada. Revisa los resultados.');
 }catch(err){const e=$('#formError');if(e)e.innerHTML=`<div class="alert error">${icon('info',14)} ${esc(err.message)}</div>`;toast('Revisa los parámetros del formulario.');}
}
// Persistencia híbrida: SQLite local con server.py, IndexedDB al publicar en GitHub Pages.
async function refreshRuns(){state.history=await listExperiments();renderNav();}
async function refreshPreview(){
 try{state.dbPreview=await databasePreview(state.dbTable);const el=$('#sqlPreview');if(el)el.innerHTML=renderSqlPreview();}
 catch(err){const el=$('#sqlPreview');if(el)el.innerHTML=`<div class="alert error">${esc(err.message)}</div>`;}
}
async function save(){
 if(!state.result || state.savedId)return;
 const record={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),createdAt:new Date().toISOString(),result:JSON.parse(JSON.stringify(state.result)),modelVersion:'semana2-integrada-v2.1'};
 try{await saveExperiment(record);state.savedId=record.id;await refreshRuns();render();toast('Experimento guardado. Puedes recuperarlo desde Historial.');}
 catch(err){toast('No se pudo guardar: comprueba el almacenamiento del navegador.');console.error(err);}
}
function openSaved(rec,rerun=false){
 state.view='caso';state.caseId=rec.result.caseId;state.scenario=rec.result.scenario;state.params={...rec.result.params};
 if(rerun){
   try{state.result=simulateCase(state.caseId,state.scenario,state.params);state.savedId=null;
    const check=verifyExperiment(rec);
    state.verification={...check,message:`${rec.id.slice(0,12)}: ${check.reason}; ${check.compared} valores comparados.`};
    toast(check.ok?'Reejecución verificada: métricas, tablas y gráficos coinciden.':`Atención: ${check.reason}`);
   }catch(e){toast('No se pudo relanzar: '+e.message);return;}
 }else{state.result=rec.result;state.savedId=rec.id;toast('Simulación recuperada: parámetros, tablas y gráficos.');}
 window.location.hash=`caso-${state.caseId}`;render();window.scrollTo({top:0,behavior:'instant'});
}
function downloadCsv(){
 const headers=['ID','Fecha','Caso','Escenario','Parámetros JSON','Métrica','Valor','Unidad'];
 const content=[headers,...state.history.map(h=>[h.id,h.createdAt,CASES[h.result.caseId-1]?.name,h.result.scenario,JSON.stringify(h.result.params),h.result.metric?.label,h.result.metric?.value,h.result.metric?.unit])];
 const csv=content.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
 const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='SIMTELE_RISK_Registros_S2.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Tabla exportada a CSV.');
}
function exportRuns(){if(!state.history.length)return;const blob=new Blob([JSON.stringify({app:'SIMTELE-RISK Semana 2 · Integrada',exportedAt:new Date().toISOString(),experimentos:state.history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='SIMTELE-RISK_historial_S2.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Historial exportado como JSON.');}

document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action],[data-nav]');if(!b)return;
 if(b.hasAttribute('data-nav')){navigate(b.dataset.nav);return;}
 switch(b.dataset.action){
 case 'scenario':state.scenario=b.dataset.value;state.params={...PRESETS[state.caseId][state.scenario]};state.result=simulateCase(state.caseId,state.scenario,state.params);state.savedId=null;render();break;
 case 'reset':state.params={...PRESETS[state.caseId][state.scenario]};state.result=simulateCase(state.caseId,state.scenario,state.params);state.savedId=null;render();toast('Parámetros restablecidos.');break;
 case 'save':await save();break;
 case 'export':exportRuns();break;
 case 'csv':downloadCsv();break;
 case 'demo':{
   try{
     const stamp=Date.now();for(const c of CASES){const r=simulateCase(c.id,'NORMAL',PRESETS[c.id].NORMAL);
       const rec={id:`demo-s2-${c.id}-${stamp}`,createdAt:new Date(Date.now()+c.id).toISOString(),modelVersion:'semana2-integrada-v2.1',result:r};
       await saveExperiment(rec);
     }
     await refreshRuns();await refreshPreview();render();toast('4 experimentos sintéticos guardados en la base activa.');
   }catch(err){toast('Error guardando demostraciones: '+err.message);}
   break;
 }
 case 'import-s1':{
   try{const n=await importWeek1();await refreshRuns();await refreshPreview();render();toast(`${n} registros importados desde Semana 1.`);}
   catch(err){toast('No se pudo importar: '+err.message);}
   break;
 }
 case 'mc-run':{
   const runs=Number($('#mcRuns')?.value),sigma=Number($('#mcSigma')?.value),seed=Number($('#mcSeed')?.value);
   try{monteCarloSensor(state.aiScenario,PRESETS[4][state.aiScenario],{runs,sigma,seed});
     state.mcRuns=runs;state.mcSigma=sigma;state.mcSeed=seed;render();toast('Monte Carlo reproducible actualizado.');}
   catch(error){toast(error.message);}break;
 }
 case 'ai-scenario':state.aiScenario=b.dataset.value;state.mcSigma=suggestedSigma(state.aiScenario);render();break;
 case 'verify-saved':{
   const rec=state.history.find(x=>x.id===b.dataset.id);
   if(!rec){toast('Registro no encontrado.');break;}
   const v=verifyExperiment(rec);
   state.verification={...v,message:`${v.ok?'✓':'✗'} ${rec.id.slice(0,12)}: ${v.reason}; ${v.compared} valores numéricos comprobados. Máxima diferencia ${nfmt(v.maxDelta||0)}.`};
   render();await refreshPreview();toast(v.ok?'Registro reproducible y verificado.':'La simulación no coincide con lo recuperado.');break;
 }

 case 'open-saved':{const r=state.history.find(x=>x.id===b.dataset.id);if(r)openSaved(r);break;}
 case 'rerun':{const r=state.history.find(x=>x.id===b.dataset.id);if(r)openSaved(r,true);break;}
 case 'delete':{
    const id=b.dataset.id;
    if(!window.confirm('¿Eliminar esta simulación del historial local?'))break;
    try{await removeExperiment(id);await refreshRuns();render();toast('Simulación eliminada.');}catch(error){toast('No se pudo eliminar el experimento.');}
    break;
 }
 case 'close-menu':closeMenu();break;
 }
});
document.addEventListener('submit',e=>{if(e.target.id==='parametersForm'){e.preventDefault();runCurrent();}});
document.addEventListener('input',e=>{if(e.target.id==='dbSearch'){state.dbQuery=e.target.value;const box=$('#dbRecords');if(box)box.innerHTML=renderDbRecords();}if(e.target.id==='historySearch'){state.query=e.target.value;const list=$('#historyResults');if(list)list.innerHTML=historyList();}});
document.addEventListener('change',e=>{if(e.target.id==='dbTableSelect'){state.dbTable=e.target.value;state.dbPreview=null;refreshPreview();}if(e.target.id==='historyScenario'){state.historyScenario=e.target.value;$('#historyResults').innerHTML=historyList();}});
$('#menuToggle').addEventListener('click',()=>{$('.sidebar').classList.toggle('open');$('#mobileBackdrop').classList.toggle('show');});
window.addEventListener('hashchange',()=>{
 const target=decodeURIComponent(window.location.hash.slice(1))||'inicio';
 const current=state.view==='caso'?`caso-${state.caseId}`:state.view;
 if(target!==current)navigate(target);
});
(async()=>{try{await initStorage();await refreshRuns();}catch(e){console.error(e);toast('El historial no se pudo cargar.');}navigate(decodeURIComponent(window.location.hash.slice(1))||'inicio');})();
