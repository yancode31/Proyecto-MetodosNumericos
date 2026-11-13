import {CASES,SCENARIOS,PARAM_DEFS,PRESETS,simulateCase,nfmt} from './math.js';

const $=s=>document.querySelector(s);
const app=$('#app'), sideNav=$('#sideNav');
const state={view:'inicio',caseId:1,scenario:'NORMAL',params:{...PRESETS[1].NORMAL},result:null,savedId:null,history:[],query:'',historyScenario:'TODOS'};
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
  sideNav.innerHTML=`<div class="side-label">PLATAFORMA</div>${navButton('Panel general','inicio','home')}${navButton('Comparación','comparacion','chart')}${navButton('Historial','historial','history',String(state.history.length))}<div class="side-label" style="margin-top:26px">CASOS DE ESTUDIO</div>${CASES.map(c=>navButton(c.short,`caso-${c.id}`,c.icon,`0${c.id}`)).join('')}`;
  $('#historyCount').textContent=String(state.history.length);
  const bc=state.view==='inicio'?'Inicio':state.view==='caso'?CASES[state.caseId-1].short:state.view==='historial'?'Historial':'Comparación';
  $('#breadcrumb').textContent=`Plataforma / ${bc}`;
}
function sectionTitle(tag,title,description){return `<div class="main-heading"><div><div class="eyebrow-blue">${esc(tag)}</div><h1>${esc(title)}</h1>${description?`<p class="lead">${esc(description)}</p>`:''}</div></div>`;}
function caseColor(id){return ['icon-blue','icon-teal','icon-orange','icon-purple'][id-1];}
function caseCard(c){return `<article class="case-card"><div class="case-header"><div class="case-icon ${caseColor(c.id)}">${icon(c.icon,24)}</div><div class="case-title"><h3>${esc(c.name)}</h3><small>CASO 0${c.id} · Módulo obligatorio</small></div></div><p>${esc(c.description)}</p><div class="case-model">${esc(c.model)}</div><div class="case-bottom"><span class="chip">${esc(c.methods)}</span><button class="text-link" data-nav="caso-${c.id}" type="button">Explorar ${icon('arrow',14)}</button></div></article>`;}
function heroGraphic(){return `<svg viewBox="0 0 300 190" fill="none" aria-hidden="true"><path d="m8 46 280-31M75 38l-12 21m146-31 12 16" stroke="#7194d3" stroke-width="2"/><path d="M150 32v50" stroke="#8eaeeb" stroke-width="4"/><path d="M150 82h-62c-10 0-17 8-17 18v49c0 12 9 21 20 21h119c11 0 20-9 20-21v-49c0-10-8-18-18-18z" fill="#274879" stroke="#7fa9ee" stroke-width="3"/><path d="M84 102c0-5 4-9 9-9h44v40H84zm62-9h55c7 0 12 5 12 12v28h-67z" fill="#88b7f8" fill-opacity=".24" stroke="#77a5ef" stroke-width="1.5"/><path d="M91 148h120" stroke="#85a9e6" stroke-width="3"/><path d="M109 171l-8 10m93-10 9 10" stroke="#8eaeeb" stroke-width="3"/><circle cx="260" cy="104" r="16" stroke="#74d9c1" stroke-opacity=".65"/><path d="m252 104 6 6 10-11" stroke="#74d9c1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function renderHome(){
 const n=state.history.length;
 return `<div class="hero"><div class="hero-copy"><span class="tag">SEMANA 1 · PROTOTIPO FUNCIONAL</span><h1>Simulaciones que convierten <em>números en decisiones.</em></h1><p>Explora cuatro casos hipotéticos de un transporte por cable. Cambia parámetros, compara métodos y conserva tus experimentos.</p><button class="primary-btn" data-nav="caso-1" type="button">Iniciar simulación ${icon('arrow',15)}</button></div><div class="hero-graphic">${heroGraphic()}</div></div>
 <section class="stats-grid"><div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('layers')}</div><span class="small-badge">OBLIGATORIOS</span></div><strong class="stat-number">04</strong><div class="stat-label">Casos de estudio</div><div class="stat-foot">Modelos numéricos integrados</div></div>
 <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('flask')}</div><span class="small-badge">POR MÓDULO</span></div><strong class="stat-number">03</strong><div class="stat-label">Escenarios reproducibles</div><div class="stat-foot">Normal, estrés y mal condicionado</div></div>
 <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('calculator')}</div><span class="small-badge">SPD 4×4</span></div><strong class="stat-number">04</strong><div class="stat-label">Métodos de sistemas lineales</div><div class="stat-foot">Jacobi, GS, LU y CG</div></div>
 <div class="stat-card"><div class="stat-card-top"><div class="stat-icon">${icon('database')}</div><span class="small-badge">EN ESTE EQUIPO</span></div><strong class="stat-number">${n.toString().padStart(2,'0')}</strong><div class="stat-label">Experimentos guardados</div><div class="stat-foot">Persistencia local IndexedDB</div></div></section>
 <section><div class="section-heading"><div><div class="eyebrow-blue">EXPLORA EL LABORATORIO</div><h2>Cuatro casos. Un solo sistema.</h2><p>Elige un módulo para modificar sus entradas y ver resultados matemáticos reproducibles.</p></div><button class="outline-btn" data-nav="comparacion" type="button">Ver comparación general ${icon('arrow',14)}</button></div><div class="case-grid">${CASES.map(caseCard).join('')}</div></section>
 <section class="below-home"><div class="info-panel"><div class="eyebrow-blue">ALCANCE DE LA ENTREGA</div><h3>¿Qué incluye esta primera versión?</h3><ul><li>Modelos, fórmulas, parámetros validados y tres escenarios.</li><li>Tablas, gráficas, errores y conclusiones separadas.</li><li>Sistemas lineales SPD con cuatro métodos y residuales.</li><li>Guardar, reabrir y relanzar simulaciones en este navegador.</li></ul></div><div class="info-panel"><div class="eyebrow-blue">IMPORTANTE</div><h3>Simulación sintética, no sistema real</h3><p>Los resultados no proceden de Mi Teleférico, no implican fallas verificadas y no son recomendaciones de seguridad ni mantenimiento. La base relacional SQL se incluye como diseño inicial para una integración de servidor posterior.</p></div></section>`;
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
 return `<div class="case-page-heading"><div><button data-nav="inicio" class="back-link" type="button">${icon('chevron',13)} Volver al panel general</button><div class="eyebrow-blue">MÓDULO 0${c.id} · CASO DE ESTUDIO</div><h1>${esc(c.name)}</h1><p class="lead" style="margin:0">${esc(c.description)}</p></div><span class="small-badge">SEMANA 1</span></div>
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
 return `${sectionTitle('PERSISTENCIA LOCAL','Historial de experimentos','Busca, recupera y relanza una simulación completa con sus entradas, gráficos y tablas, aunque hayas actualizado la página.')}
 <div class="hist-controls"><label class="search-box">${icon('search',17)}<input id="historySearch" type="search" placeholder="Buscar caso, escenario o fecha..." value="${esc(state.query)}" autocomplete="off" /></label><select id="historyScenario" class="outline-btn" aria-label="Filtrar escenarios"><option value="TODOS" ${state.historyScenario==='TODOS'?'selected':''}>Todos los escenarios</option>${SCENARIOS.map(s=>`<option ${state.historyScenario===s?'selected':''} value="${esc(s)}">${esc(s)}</option>`).join('')}</select><button class="outline-btn" data-action="export" type="button" ${state.history.length?'':'disabled'}>${icon('download',14)} Exportar JSON</button></div>
 <div id="historyResults">${historyList()}</div><div class="alert info" style="margin-top:20px">${icon('database',15)} Las ejecuciones se guardan en IndexedDB dentro de este navegador y equipo, no en un servidor. Esta persistencia permite cerrar y recuperar; puede perderse si se borran los datos del sitio. La base SQL de servidor se plantea para la integración posterior.</div>`;
}
function render(){renderNav();if(state.view==='caso')app.innerHTML=renderCase();else if(state.view==='historial')app.innerHTML=renderHistory();else if(state.view==='comparacion')app.innerHTML=renderComparison();else app.innerHTML=renderHome();}
function navigate(target,mode='default'){
 const id=target.startsWith('caso-')?Number(target.split('-')[1]):null;
 if(id&&CASES.some(c=>c.id===id)){
   const same=state.view==='caso'&&state.caseId===id;
   state.view='caso';state.caseId=id;
   if(!same||mode==='fresh'){
     state.scenario='NORMAL';state.params={...PRESETS[id].NORMAL};state.result=simulateCase(id,'NORMAL',state.params);state.savedId=null;
   }
 }else if(['inicio','comparacion','historial'].includes(target))state.view=target;
 else target='inicio',state.view='inicio';
 window.location.hash=target;render();window.scrollTo({top:0,behavior:'instant'});closeMenu();
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
// IndexedDB: datos guardados entre recargas, limitado al dispositivo y navegador actual.
const DB_NAME='SIMTELE_RISK_S1',STORE='experimentos';let databasePromise;
function openDatabase(){if(!('indexedDB'in window))return Promise.resolve(null);
 if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,1);
   req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'id'});store.createIndex('createdAt','createdAt',{unique:false});store.createIndex('caseId','result.caseId',{unique:false});}};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 }).catch(()=>null);
 return databasePromise;
}
function backupList(){try{return JSON.parse(localStorage.getItem(DB_NAME+'_fallback')||'[]')}catch{return []}}
async function storedAll(){const db=await openDatabase();if(!db)return backupList();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function putStored(record){const db=await openDatabase();if(!db){const all=backupList();all.push(record);localStorage.setItem(DB_NAME+'_fallback',JSON.stringify(all));return;}
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function deleteStored(id){const db=await openDatabase();if(!db){localStorage.setItem(DB_NAME+'_fallback',JSON.stringify(backupList().filter(r=>r.id!==id)));return;}
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function refreshRuns(){state.history=(await storedAll()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));renderNav();}
async function save(){
 if(!state.result || state.savedId)return;
 const record={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),createdAt:new Date().toISOString(),result:JSON.parse(JSON.stringify(state.result)),modelVersion:'semana1-v1'};
 try{await putStored(record);state.savedId=record.id;await refreshRuns();render();toast('Experimento guardado. Puedes recuperarlo desde Historial.');}
 catch(err){toast('No se pudo guardar: comprueba el almacenamiento del navegador.');console.error(err);}
}
function openSaved(rec,rerun=false){
 state.view='caso';state.caseId=rec.result.caseId;state.scenario=rec.result.scenario;state.params={...rec.result.params};
 if(rerun){
   try{state.result=simulateCase(state.caseId,state.scenario,state.params);state.savedId=null;
    const delta=Math.abs(state.result.metric.value-rec.result.metric.value), tolerance=1e-9*Math.max(1,Math.abs(rec.result.metric.value));
    toast(delta<=tolerance?'Reejecución verificada: resultados dentro de tolerancia.':`Reejecutado; diferencia de métrica ${nfmt(delta)}.`);
   }catch(e){toast('No se pudo relanzar: '+e.message);return;}
 }else{state.result=rec.result;state.savedId=rec.id;toast('Simulación recuperada: parámetros, tablas y gráficos.');}
 window.location.hash=`caso-${state.caseId}`;render();window.scrollTo({top:0,behavior:'instant'});
}
function exportRuns(){if(!state.history.length)return;const blob=new Blob([JSON.stringify({app:'SIMTELE-RISK Semana 1',exportedAt:new Date().toISOString(),experimentos:state.history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='SIMTELE-RISK_historial_S1.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Historial exportado como JSON.');}

document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action],[data-nav]');if(!b)return;
 if(b.hasAttribute('data-nav')){navigate(b.dataset.nav);return;}
 switch(b.dataset.action){
 case 'scenario':state.scenario=b.dataset.value;state.params={...PRESETS[state.caseId][state.scenario]};state.result=simulateCase(state.caseId,state.scenario,state.params);state.savedId=null;render();break;
 case 'reset':state.params={...PRESETS[state.caseId][state.scenario]};state.result=simulateCase(state.caseId,state.scenario,state.params);state.savedId=null;render();toast('Parámetros restablecidos.');break;
 case 'save':await save();break;
 case 'export':exportRuns();break;
 case 'open-saved':{const r=state.history.find(x=>x.id===b.dataset.id);if(r)openSaved(r);break;}
 case 'rerun':{const r=state.history.find(x=>x.id===b.dataset.id);if(r)openSaved(r,true);break;}
 case 'delete':{
    const id=b.dataset.id;
    if(!window.confirm('¿Eliminar esta simulación del historial local?'))break;
    try{await deleteStored(id);await refreshRuns();render();toast('Simulación eliminada.');}catch(error){toast('No se pudo eliminar el experimento.');}
    break;
 }
 case 'close-menu':closeMenu();break;
 }
});
document.addEventListener('submit',e=>{if(e.target.id==='parametersForm'){e.preventDefault();runCurrent();}});
document.addEventListener('input',e=>{if(e.target.id==='historySearch'){state.query=e.target.value;const list=$('#historyResults');if(list)list.innerHTML=historyList();}});
document.addEventListener('change',e=>{if(e.target.id==='historyScenario'){state.historyScenario=e.target.value;$('#historyResults').innerHTML=historyList();}});
$('#menuToggle').addEventListener('click',()=>{$('.sidebar').classList.toggle('open');$('#mobileBackdrop').classList.toggle('show');});
window.addEventListener('hashchange',()=>{
 const target=decodeURIComponent(window.location.hash.slice(1))||'inicio';
 const current=state.view==='caso'?`caso-${state.caseId}`:state.view;
 if(target!==current)navigate(target);
});
(async()=>{try{await refreshRuns();}catch(e){console.error(e);toast('El historial no se pudo cargar.');}navigate(decodeURIComponent(window.location.hash.slice(1))||'inicio');})();
