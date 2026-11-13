import assert from 'node:assert/strict';
import {simulateCase,solveLinearScenario,PRESETS,CASES} from '../assets/math.js';

let checked=0;
function near(a,b,tol=1e-8){assert.ok(Math.abs(a-b)<tol,`Esperado ${b}, obtenido ${a}`);checked++;}
for(const c of CASES){
 for(const scenario of Object.keys(PRESETS[c.id])){
  const res=simulateCase(c.id,scenario,PRESETS[c.id][scenario]);
  assert.ok(res.tables.length>=1);assert.ok(res.plots.length>=2);
  assert.ok(Number.isFinite(res.metric.value));checked+=3;
 }
}
const br=simulateCase(1,'NORMAL',PRESETS[1].NORMAL);
near(br.metric.value,40);
const brStress=simulateCase(1,'ESTRÉS',PRESETS[1]['ESTRÉS']);
near(brStress.metric.value,105);
const wear=simulateCase(2,'NORMAL',PRESETS[2].NORMAL);
near(wear.metric.value,15.8480037854,1e-9);
const wearStress=simulateCase(2,'ESTRÉS',PRESETS[2]['ESTRÉS']);
near(wearStress.metric.value,6.32904643145,1e-9);
for(const s of ['NORMAL','ESTRÉS','MAL CONDICIONADO']){
 const lin=solveLinearScenario(s);
 assert.equal(lin.A.length,4);checked++;
 for(const method of lin.solvers){
  assert.ok(method.converged,`No convergió: ${method.method}, ${s}`);
  assert.ok(method.trace.at(-1).residual<1e-10);
  checked+=2;
 }
}
const noisy=simulateCase(4,'ESTRÉS',PRESETS[4]['ESTRÉS']);
assert.ok(noisy.metric.value>0.01);checked++;
const clean=simulateCase(4,'NORMAL',PRESETS[4].NORMAL);
near(clean.metric.value,0.00609031154,1e-9);
const vib=simulateCase(3,'NORMAL',PRESETS[3].NORMAL);
near(vib.metric.value,0.1);
for(const id of [1,2,3,4]){
 const invalid={...PRESETS[id].NORMAL};
 const key=Object.keys(invalid)[0];invalid[key]=NaN;
 assert.throws(()=>simulateCase(id,'NORMAL',invalid));checked++;
}
console.log(`OK · ${checked} verificaciones matemáticas y de validación.`);
