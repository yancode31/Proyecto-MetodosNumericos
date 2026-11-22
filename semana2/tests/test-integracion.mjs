import assert from 'node:assert/strict';
import {monteCarloSensor,suggestedSigma} from '../assets/analisis-ia.js';
import {verifyExperiment} from '../assets/verificacion.js';
import {CASES,SCENARIOS,PRESETS,simulateCase} from '../assets/math.js';
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
for(const scen of SCENARIOS){
  const opts={runs:100,seed:20261121,sigma:suggestedSigma(scen)};
  const a=monteCarloSensor(scen,PRESETS[4][scen],opts);
  const b=monteCarloSensor(scen,PRESETS[4][scen],opts);
  check(a.testCount===41,`Puntos ocultos del ${scen}`);
  check(a.metrics.length===4,'Tres interpolantes y k-NN');
  check(JSON.stringify(a.metrics)===JSON.stringify(b.metrics),'Monte Carlo repetible con semilla');
  for(const m of a.metrics){
    check(Number.isFinite(m.meanMAE)&&m.meanMAE>=0,'MAE finito');
    check(Number.isFinite(m.p95MAE)&&m.p95MAE>=0,'Percentil finito');
    check(m.errors.length===a.testCount,'Curva de errores completa');
  }
}
for(const c of CASES){
  for(const scen of SCENARIOS){
    const r=simulateCase(c.id,scen,PRESETS[c.id][scen]);
    const v=verifyExperiment({result:r});
    check(v.ok,`Reejecución exacta ${c.id}/${scen}: ${v.reason}`);
    check(v.compared>100,`Comprobación exhaustiva ${c.id}/${scen}: ${v.compared}`);
    const damaged=structuredClone(r);
    damaged.metric.value+=Math.max(0.001,Math.abs(r.metric.value)*0.05);
    check(!verifyExperiment({result:damaged}).ok,'Detecta manipulación numérica');
    const mangled=structuredClone(r);
    mangled.tables.pop();
    check(!verifyExperiment({result:mangled}).ok,'Detecta tabla perdida');
  }
}
assert.throws(()=>monteCarloSensor('NORMAL',PRESETS[4].NORMAL,{runs:0}));checks++;
assert.throws(()=>monteCarloSensor('NORMAL',PRESETS[4].NORMAL,{runs:100,sigma:-1}));checks++;
assert.throws(()=>monteCarloSensor('MAL',PRESETS[4].NORMAL,{runs:100}));checks++;
console.log(`OK · ${checks} verificaciones de integración (Monte Carlo, persistencia reproducible, integridad).`);
