import assert from 'node:assert/strict';
import {CASES,SCENARIOS,PRESETS,simulateCase,knnPredict,evaluateSensorIA} from '../assets/math.js';
let checks=0;
const near=(a,b,tol)=>{assert.ok(Math.abs(a-b)<=tol,`Esperado ${b}, obtenido ${a}`);checks++;};
near(knnPredict([0,1],[0,1],.5,2),.5,1e-12);
near(knnPredict([0,1,2],[3,5,7],1,2),5,1e-12);
assert.throws(()=>knnPredict([0],[1],.5,3));checks++;
for(const scen of SCENARIOS){
 const ai=evaluateSensorIA(scen,PRESETS[4][scen]);
 assert.equal(ai.metrics.length,4);checks++;
 assert.equal(ai.testCount,41);checks++;
 for(const item of ai.metrics){
  assert.ok(Number.isFinite(item.mae)&&Number.isFinite(item.rmse)&&item.mae>=0&&item.rmse>=item.mae-1e-14);checks++;
 }
}
const normal=simulateCase(3,'NORMAL',PRESETS[3].NORMAL);
const integration=normal.tables.find(t=>t.title.includes('Integración de'));
assert.ok(integration,'Se requiere tabla de integración en módulo 3');checks++;
assert.ok(integration.rows.length>=4);checks++;
const baseIntegral=normal.summary.find(m=>m.label==='Integral ∫x²dt');
assert.ok(baseIntegral,'Se requiere integral en el resumen');checks++;
near(Number(baseIntegral.value),.0072481551,8e-6);
for(const c of CASES){
 for(const s of SCENARIOS){
  const r=simulateCase(c.id,s,PRESETS[c.id][s]);
  assert.ok(r.plots.length>=2,`Faltan gráficos en ${c.id} ${s}`);checks++;
  assert.ok(r.tables.length>=2,`Faltan tablas en ${c.id} ${s}`);checks++;
  assert.ok(r.numeric.length>45&&r.physical.length>45,`Faltan dos conclusiones en ${c.id} ${s}`);checks++;
  assert.ok(Number.isFinite(r.metric.value));checks++;
 }
}
const sensors=simulateCase(4,'ESTRÉS',PRESETS[4]['ESTRÉS']);
assert.ok(sensors.tables.some(t=>t.title.includes('Métricas')));checks++;
assert.ok(sensors.plots.some(t=>t.title.includes('IA')));checks++;
console.log(`OK · ${checks} verificaciones de Semana 2 (métodos, IA, gráficos, errores).`);
