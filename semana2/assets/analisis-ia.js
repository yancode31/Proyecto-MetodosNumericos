/** SIMTELE-RISK / Semana 2: integración de ideas de incertidumbre y estadística
 * de la propuesta del equipo con el Laboratorio k-NN ya publicado.
 * Experimentos pedagógicos: no predicen fallas de transporte real.
 */
import { rng, gauss, stats } from './advanced/errors.js';
import { lagrange, newtonDivided, splineNatural, knnPredict } from './math.js';

const METHODS = [
  ['Lagrange', lagrange],
  ['Newton dividido', newtonDivided],
  ['Spline cúbico natural', splineNatural],
  ['k-NN (k=2) · IA', (x,y,t)=>knnPredict(x,y,t,2)]
];
export const suggestedSigma = scenario => scenario === 'ESTRÉS' ? 0.035 : scenario === 'MAL CONDICIONADO' ? 0.00001 : 0.008;
/** Se generan perturbaciones gaussianas IID en los nodos observados; los puntos
 * de evaluación no se usan para ajuste/entrenamiento.  La estadística de salida
 * es la distribución del MAE por ensayo, no una probabilidad de accidente.
 */
export function monteCarloSensor(scenario, params, options = {}) {
  if(!['NORMAL','ESTRÉS','MAL CONDICIONADO'].includes(scenario)) throw Error('Escenario inválido');
  const runs = options.runs ?? 200, seed = options.seed ?? 20261121;
  const sigma = options.sigma ?? suggestedSigma(scenario);
  if(!Number.isInteger(runs) || runs < 20 || runs > 2000) throw Error('Ensayos: entre 20 y 2000');
  if(!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('Semilla inválida');
  if(!(Number.isFinite(sigma) && sigma >= 0 && sigma <= 0.5)) throw Error('Desviación σ fuera de rango');
  if(!(Number.isFinite(params.amp) && params.amp > 0)) throw Error('Amplitud inválida');
  const xs = scenario==='MAL CONDICIONADO' ? [0,.001,.002,.003] : [0,.5,1.5,2];
  const ideal = t=>params.amp * Math.sin(t);
  const ts = Array.from({length:41},(_,i)=>xs[0]+(i+.5)*(xs.at(-1)-xs[0])/41)
    .filter(t=>xs.every(x=>Math.abs(x-t)>1e-11));
  const random = rng(seed);
  const errorsByMethod = METHODS.map(()=>[]);
  const meanByTime = METHODS.map(()=>Array(ts.length).fill(0));
  for(let iteration=0;iteration<runs;iteration++){
    const observed = xs.map(x=>ideal(x)+sigma*gauss(random));
    for(let methodIndex=0; methodIndex<METHODS.length;methodIndex++){
      const predict = METHODS[methodIndex][1];
      let sum=0;
      for(let i=0;i<ts.length;i++){
        const error=Math.abs(predict(xs,observed,ts[i])-ideal(ts[i]));
        if(!Number.isFinite(error))throw Error('Predicción numérica no finita');
        sum+=error;meanByTime[methodIndex][i]+=error/runs;
      }
      errorsByMethod[methodIndex].push(sum/ts.length);
    }
  }
  const metrics = METHODS.map(([method],i)=>{
    const st=stats(errorsByMethod[i]);
    return {method,meanMAE:st.mean,p95MAE:st.p95,minMAE:st.min,maxMAE:st.max,sdMAE:st.sd,errors:ts.map((t,j)=>[t,meanByTime[i][j]])};
  });
  return {scenario, sigma, runs, seed, xs, testCount:ts.length, metrics,
    note:'Monte Carlo con ruido sintético independiente N(0, σ²), semilla fija y evaluación fuera de los nodos observados; no es estimación de riesgo físico.'};
}

/** Diferencia finita central del indicador de frenado respecto a v₀, a y tᵣ. */
export function sensibilidadFrenado(p, variation = 0.01){
  if(!(p.v0>0&&p.a>0&&p.tr>=0))throw Error('Parámetros de frenado inválidos');
  const f=o=>o.v0*o.tr+o.v0**2/(2*o.a);
  const base=f(p);
  return ['v0','a','tr'].map(key=>{
    const h=Math.max(Math.abs(p[key])*variation, 0.001);
    const hi=f({...p,[key]:p[key]+h}),lo=f({...p,[key]:Math.max(0,key==='a'?1e-8:p[key]-h)});
    const derivative=(hi-lo)/(key==='a'&&p[key]-h<=0 ? p[key]+h-1e-8 : Math.min(p[key]+h,p[key]+h)-(p[key]-h>=0 ? p[key]-h : 0));
    const elasticity=base===0?null:derivative*p[key]/base;
    return {key, derivative, elasticity};
  });
}
