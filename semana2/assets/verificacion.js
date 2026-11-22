/** SIMTELE-RISK · Reejecución verificable de experimentos persistidos.
 * Contrasta además de la métrica, las tablas, gráficos y conclusiones.
 */
import { simulateCase } from './math.js';
export function verifyExperiment(record, relTol = 1e-9, absTol = 1e-12){
  if(!record || !record.result) return {ok:false, reason:'Registro inexistente', compared:0};
  const previous=record.result;
  let recalculated;
  try{recalculated=simulateCase(previous.caseId,previous.scenario,previous.params)}
  catch(error){return {ok:false, reason:`No se puede repetir: ${error.message}`,compared:0};}
  let compared=0,maxDelta=0,mismatch=null;
  function visit(a,b,path){
    if(mismatch)return;
    if(typeof a==='number' && typeof b==='number'){
      compared++;
      if(!Number.isFinite(a)||!Number.isFinite(b)){mismatch=`${path}: valor no finito`;return;}
      const diff=Math.abs(a-b);maxDelta=Math.max(maxDelta,diff);
      if(diff>absTol+relTol*Math.max(Math.abs(a),Math.abs(b))) mismatch=`${path}: diferencia ${diff}`;
      return;
    }
    if(Array.isArray(a)&&Array.isArray(b)){
      if(a.length!==b.length){mismatch=`${path}: distinta cantidad de elementos`;return;}
      a.forEach((x,i)=>visit(x,b[i],`${path}[${i}]`));return;
    }
    if(a&&b&&typeof a==='object'&&typeof b==='object'){
      const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();
      if(ka.join('|')!==kb.join('|')){mismatch=`${path}: diferente estructura`;return;}
      for(const key of ka)visit(a[key],b[key],`${path}.${key}`);
      return;
    }
    if(a!==b)mismatch=`${path}: diferencia textual/de tipo`;
  }
  // Los objetos preservados incluyen tablas, trazas, gráficos y referencias.
  visit(previous,recalculated,'resultado');
  return {ok:!mismatch,reason:mismatch||'Coincidencia dentro de tolerancia',compared,maxDelta};
}
