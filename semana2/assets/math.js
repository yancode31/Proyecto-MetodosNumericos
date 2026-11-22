/** SIMTELE-RISK — Semana 2: núcleo matemático reproducible, con línea base de IA. Datos sintéticos. */
export const CASES = [
  {id:1, name:'Detención de emergencia', short:'Detención', icon:'brake', unit:'m', description:'Tiempo de frenado, velocidad y distancia estimada.', methods:'RK2 · RK4 · raíces · integración', model:'v(t) = v₀ − at; x(t) = v₀t − ½at²'},
  {id:2, name:'Deterioro mecánico', short:'Deterioro', icon:'tool', unit:'meses', description:'Umbral hipotético de inspección y calibración SPD.', methods:'Bisección · Newton · secante · sistemas lineales', model:'D(t) = D₀ + αt + βt²'},
  {id:3, name:'Oscilaciones por viento', short:'Oscilaciones', icon:'wind', unit:'m', description:'Respuesta masa–resorte–amortiguador.', methods:'RK2 · RK4 · referencia', model:'mx″ + cx′ + kx = F(t)'},
  {id:4, name:'Reconstrucción de sensores', short:'Sensores', icon:'activity', unit:'u.', description:'Recuperación de muestras ocultas y sensibilidad al ruido.', methods:'Lagrange · Newton dividido · spline natural · k-NN (IA)', model:'s(t) = sen(t); yᵢ = s(tᵢ) + εᵢ'}
];
export const SCENARIOS = ['NORMAL','ESTRÉS','MAL CONDICIONADO'];
const p = (key,label,unit,min,max,step) => ({key,label,unit,min,max,step});
export const PARAM_DEFS = {
  1:[p('v0','Velocidad inicial','m/s',0.1,80,.1),p('a','Desaceleración','m/s²',.01,25,.01),p('tr','Tiempo de reacción','s',0,20,.1),p('h','Paso numérico','s',.01,2,.01)],
  2:[p('D0','Deterioro inicial','índice',0,.99,.001),p('alpha','Tasa lineal α','mes⁻¹',0,.5,.00001),p('beta','Tasa cuadrática β','mes⁻²',0,.1,.000001),p('threshold','Umbral preventivo','índice',.01,1,.01)],
  3:[p('m','Masa equivalente','kg',1,10000,1),p('c','Amortiguamiento','N·s/m',0,10000,10),p('k','Rigidez','N/m',.1,100000,10),p('F0','Fuerza periódica (amplitud)','N',0,1000,5),p('omega','Frecuencia de excitación','rad/s',0,20,.1),p('x0','Desplazamiento inicial','m',-.5,.5,.01),p('vInit','Velocidad inicial','m/s',-2,2,.01),p('h','Paso de integración','s',.005,.5,.005)],
  4:[p('amp','Amplitud de la señal','u.',.01,10,.1),p('noiseScale','Factor de ruido sintético','×',0,10,.1),p('test1','Muestra oculta 1','s',0,2,.001),p('test2','Muestra oculta 2','s',0,2,.001)]
};
export const PRESETS = {
  1:{'NORMAL':{v0:10,a:2,tr:1.5,h:.5},'ESTRÉS':{v0:15,a:1.5,tr:2,h:.5},'MAL CONDICIONADO':{v0:10,a:2,tr:1.5,h:.5}},
  2:{'NORMAL':{D0:.05,alpha:.0205,beta:.0001,threshold:.4},'ESTRÉS':{D0:.05,alpha:.05125,beta:.00064,threshold:.4},'MAL CONDICIONADO':{D0:.05,alpha:.0205,beta:.0001,threshold:.4}},
  3:{'NORMAL':{m:500,c:400,k:2000,F0:0,omega:1.9,x0:.1,vInit:0,h:.1},'ESTRÉS':{m:500,c:200,k:2000,F0:100,omega:1.9,x0:0,vInit:0,h:.01},'MAL CONDICIONADO':{m:500,c:400,k:2000,F0:0,omega:1.9,x0:.1,vInit:0,h:.1}},
  4:{'NORMAL':{amp:1,noiseScale:0,test1:.75,test2:1.25},'ESTRÉS':{amp:1,noiseScale:1,test1:.75,test2:1.25},'MAL CONDICIONADO':{amp:1,noiseScale:0,test1:.0015,test2:.0025}}
};
export function validate(caseId,scenario,params) {
  if (!SCENARIOS.includes(scenario)) throw Error('Escenario no válido.');
  for (const d of PARAM_DEFS[caseId]||[]) {
    const v=params[d.key];
    if(typeof v!=='number'||!Number.isFinite(v)||v<d.min-1e-12||v>d.max+1e-12) throw Error(`Verifica «${d.label}»: debe estar entre ${d.min} y ${d.max} ${d.unit}.`);
  }
  if(caseId===2 && !(params.threshold>params.D0)) throw Error('El umbral debe ser mayor que el deterioro inicial.');
  if(caseId===2 && !(params.alpha>0||params.beta>0)) throw Error('α o β debe ser positivo para alcanzar el umbral.');
  if(caseId===3 && params.h > Math.min(.5, 0.55*Math.sqrt(params.m/params.k))) throw Error('El paso es demasiado grande para la rigidez y masa declaradas; reduce h.');
  if(caseId===4){
    const nodes=scenario==='MAL CONDICIONADO'?[0,.001,.002,.003]:[0,.5,1.5,2];
    for(const t of [params.test1,params.test2]) if(!(t>nodes[0] && t<nodes.at(-1))||nodes.some(x=>Math.abs(x-t)<1e-10)) throw Error('Los puntos ocultos deben estar dentro del intervalo y ser distintos de los nodos conocidos.');
    if(Math.abs(params.test1-params.test2)<1e-9) throw Error('Elige dos puntos ocultos distintos.');
  }
}
const round=(x,d=6)=>Number.isFinite(x)?Number(x.toFixed(d)):null;
const nfmt=x=>!Number.isFinite(x)?'—':Math.abs(x)===0?'0':(Math.abs(x)>=1e-4 && Math.abs(x)<1e5)?Number(x.toFixed(8)).toString():x.toExponential(3);
export {nfmt};
const normInf=x=>Math.max(...x.map(Math.abs));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const matVec=(A,x)=>A.map(row=>dot(row,x));
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const residual=(A,x,b)=>subtract(b,matVec(A,x));
function matrixNormal(scenario){
  if (scenario==='MAL CONDICIONADO'){
    const A=[[1,0,0,0],[0,.01,0,0],[0,0,.0001,0],[0,0,0,.000001]];
    const xStar=[1,1,1,1]; return {A,xStar,b:matVec(A,xStar),condition:1e6};
  }
  const A=scenario==='ESTRÉS'?[[2.01,-1,0,0],[-1,2.01,-1,0],[0,-1,2.01,-1],[0,0,-1,2.01]]:[[4,1,0,0],[1,4,1,0],[0,1,4,1],[0,0,1,3]];
  const xStar=[1,2,3,4];return {A,xStar,b:matVec(A,xStar),condition:scenario==='ESTRÉS'?9.255991:2.608719};
}
function solveLU(Ain,b) {
  const n=b.length, A=Ain.map(row=>row.slice()), L=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0)),U=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++){
    for(let j=i;j<n;j++){let s=0;for(let k=0;k<i;k++)s+=L[i][k]*U[k][j];U[i][j]=A[i][j]-s;}
    if(Math.abs(U[i][i])<1e-15) throw Error('Pivote nulo al calcular LU.');
    for(let j=i+1;j<n;j++){let s=0;for(let k=0;k<i;k++)s+=L[j][k]*U[k][i];L[j][i]=(A[j][i]-s)/U[i][i];}
  }
  const y=Array(n).fill(0), x=Array(n).fill(0);
  for(let i=0;i<n;i++){let s=0;for(let j=0;j<i;j++)s+=L[i][j]*y[j];y[i]=b[i]-s;}
  for(let i=n-1;i>=0;i--){let s=0;for(let j=i+1;j<n;j++)s+=U[i][j]*x[j];x[i]=(y[i]-s)/U[i][i];}
  return x;
}
function iterateLinear(method,A,b,xStar,tol=1e-10,maxIter=10000){
  const n=b.length, trace=[];let x=Array(n).fill(0), r=residual(A,x,b);
  const push=(k)=>trace.push({k,approx:x.slice(),residual:normInf(residual(A,x,b)),error:normInf(subtract(x,xStar))});
  push(0);
  if(method==='LU'){x=solveLU(A,b);push(1);return {method,iterations:1,x,trace,converged:true};}
  if(method==='Gradiente conjugado'){
    let p=r.slice(),rs=dot(r,r);
    for(let k=1;k<=n*8;k++){
      const Ap=matVec(A,p), den=dot(p,Ap);
      if(!(den>0))break;
      const alpha=rs/den;
      x=x.map((v,i)=>v+alpha*p[i]);
      r=r.map((v,i)=>v-alpha*Ap[i]);
      push(k);
      if(normInf(residual(A,x,b))<tol)return {method,iterations:k,x,trace,converged:true};
      const rsNew=dot(r,r), coeff=rsNew/rs;
      p=r.map((v,i)=>v+coeff*p[i]);rs=rsNew;
      if(!Number.isFinite(rs))break;
    }
    return {method,iterations:trace.length-1,x,trace,converged:false};
  }
  for(let k=1;k<=maxIter;k++){
    const next=x.slice();
    for(let i=0;i<n;i++){
      let sum=0;
      for(let j=0;j<n;j++)if(j!==i)sum+=A[i][j]*(method==='Gauss-Seidel'&&j<i?next[j]:x[j]);
      next[i]=(b[i]-sum)/A[i][i];
    }
    x=next;
    push(k);
    if(trace.at(-1).residual<tol)return {method,iterations:k,x,trace,converged:true};
    if(!x.every(Number.isFinite))break;
  }
  return {method,iterations:trace.length-1,x,trace,converged:false};
}
export function solveLinearScenario(scenario){
  const {A,xStar,b,condition}=matrixNormal(scenario);
  const solvers=['Jacobi','Gauss-Seidel','LU','Gradiente conjugado'].map(m=>iterateLinear(m,A,b,xStar));
  const rows=solvers.map(s=>[s.method,s.iterations,nfmt(normInf(residual(A,s.x,b))),nfmt(normInf(subtract(s.x,xStar))),s.converged?'Sí':'No']);
  const iterationRows=[];
  for(const s of solvers)for(const z of s.trace.slice(0,5))iterationRows.push([s.method,z.k,z.approx.map(v=>nfmt(v)).join(', '),nfmt(z.residual)]);
  let perturbation=null;
  if(scenario==='MAL CONDICIONADO'){
    const db=[0,0,0,1e-6], xPert=solveLU(A,b.map((x,i)=>x+db[i]));
    perturbation={relativeB:normInf(db)/normInf(b),relativeX:normInf(subtract(xPert,xStar))/normInf(xStar),xPert};
  }
  return {A,b,xStar,condition,solvers,rows,iterationRows,perturbation};
}
function solveRoot(g,gp,left,right,reference,precision=1e-10){
  const all=[];
  const signOk=g(left)*g(right)<=0;
  if(!signOk)throw Error('No hay cambio de signo en el intervalo seleccionado.');
  let l=left,r=right,iter=[];
  for(let i=1;i<=90;i++){
    let x=(l+r)/2,fx=g(x);iter.push({k:i,x,residual:Math.abs(fx),error:Math.abs(x-reference)});
    if(Math.abs(fx)<precision || (r-l)<1e-10)break;
    if(g(l)*fx<=0)r=x;else l=x;
  }
  all.push({method:'Bisección',trace:iter});
  let x=left+.4*(right-left);iter=[];
  for(let i=1;i<=90;i++){
    const f=g(x),d=gp(x);
    if(Math.abs(f)<precision)break;
    if(!Number.isFinite(d) || Math.abs(d)<1e-14)break;
    const next=x-f/d; if(!Number.isFinite(next))break;
    x=next;
    iter.push({k:i,x,residual:Math.abs(g(x)),error:Math.abs(x-reference)});
  }
  all.push({method:'Newton-Raphson',trace:iter.length?iter:[{k:0,x,residual:Math.abs(g(x)),error:Math.abs(x-reference)}]});
  let xprev=left,xcur=right,fprev=g(xprev),fcur=g(xcur);iter=[];
  for(let i=1;i<=90;i++){
    if(Math.abs(fcur)<precision)break;
    const den=fcur-fprev;if(Math.abs(den)<1e-15)break;
    let next=xcur-fcur*(xcur-xprev)/den;
    if(!Number.isFinite(next))break;
    xprev=xcur;fprev=fcur;xcur=next;fcur=g(xcur);
    iter.push({k:i,x:xcur,residual:Math.abs(fcur),error:Math.abs(xcur-reference)});
  }
  all.push({method:'Secante',trace:iter.length?iter:[{k:0,x:xcur,residual:Math.abs(fcur),error:Math.abs(xcur-reference)}]});
  return all.map(item=>({...item,iterations:item.trace.length,root:item.trace.at(-1).x,residual:item.trace.at(-1).residual,error:item.trace.at(-1).error}));
}
function integrationMethods(fn,a,b,n=20){
  const h=(b-a)/n;
  const trap=h*(.5*fn(a)+.5*fn(b)+Array.from({length:n-1},(_,i)=>fn(a+(i+1)*h)).reduce((acc,v)=>acc+v,0));
  const simpson=h/3*(fn(a)+fn(b)+Array.from({length:n-1},(_,i)=> (i%2===0?4:2)*fn(a+(i+1)*h)).reduce((acc,v)=>acc+v,0));
  const R=[];
  for(let level=0;level<6;level++){
    const count=2**level,step=(b-a)/count;
    let val=step*(fn(a)+fn(b))/2;
    for(let i=1;i<count;i++)val+=step*fn(a+i*step);
    const row=[val];
    for(let j=1;j<=level;j++)row[j]=row[j-1]+(row[j-1]-R[level-1][j-1])/(4**j-1);
    R.push(row);
  }
  return {trap,simpson,romberg:R.at(-1).at(-1)};
}
function rootTables(roots){
  return {rows:roots.map(z=>[z.method,z.iterations,nfmt(z.root),nfmt(z.residual),nfmt(z.error)]),
    plot:{title:'Convergencia de raíces',xLabel:'Iteración',yLabel:'log₁₀(error absoluto)',series:roots.map(z=>({name:z.method,points:z.trace.map(v=>[v.k,Math.log10(Math.max(v.error,1e-15))])}))},
    iterationRows:roots.flatMap(z=>z.trace.slice(0,6).map(t=>[z.method,t.k,nfmt(t.x),nfmt(t.residual)]))};
}
function series(name,points){return {name,points};}
const samples=(max,n,fn)=>Array.from({length:n+1},(_,i)=>{const t=max*i/n;return [t,fn(t)];});
function rkStep(y,t,h,fun,order){
  const k1=fun(t,y);
  if(order===2){const temp=y.map((v,i)=>v+.5*h*k1[i]); const k2=fun(t+h/2,temp); return y.map((v,i)=>v+h*k2[i]);}
  const y2=y.map((v,i)=>v+h*.5*k1[i]), k2=fun(t+h/2,y2);
  const y3=y.map((v,i)=>v+h*.5*k2[i]), k3=fun(t+h/2,y3);
  const y4=y.map((v,i)=>v+h*k3[i]), k4=fun(t+h,y4);
  return y.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
function integrateSystem(y0,T,h,fun,order){
  const N=Math.ceil(T/h),dt=T/N,arr=[[0,...y0]], vals=y0.slice();
  for(let i=1;i<=N;i++){const next=rkStep(vals,(i-1)*dt,dt,fun,order);vals.splice(0,vals.length,...next);arr.push([i*dt,...vals]);}
  return arr;
}
function case1(s,p){
  const {v0,a,tr,h}=p,T=v0/a,dist=v0*v0/(2*a),reaction=v0*tr,total=dist+reaction;
  const isMal=s==='MAL CONDICIONADO';
  const g=isMal?(t)=>v0*Math.pow(1-t/T,3):(t)=>v0-a*t;
  const gp=isMal?(t)=>-3*v0/T*Math.pow(1-t/T,2):()=>-a;
  const roots=solveRoot(g,gp,0,T*1.4+1,T,1e-10), rootData=rootTables(roots);
  const exact=t=>Math.max(0,v0-a*t);
  const rk2=integrateSystem([0,v0],T,h,(_t,y)=>[y[1],-a],2),rk4=integrateSystem([0,v0],T,h,(_t,y)=>[y[1],-a],4);
  const rkErr=Math.max(...rk4.map(z=>Math.abs(z[1]-(v0*z[0]-.5*a*z[0]*z[0]))));
  const integrations=integrationMethods(t=>v0-a*t,0,T,20);
  const summary=[{label:'Tiempo de frenado',value:nfmt(T),unit:'s'},{label:'Distancia de frenado',value:nfmt(dist),unit:'m'},{label:'Distancia de reacción',value:nfmt(reaction),unit:'m'},{label:'Distancia total',value:nfmt(total),unit:'m'}];
  const tables=[{title:'Raíces: tiempo de detención',headers:['Método','Iteraciones','Raíz (s)','Residual','Error absoluto'],rows:rootData.rows},
    {title:'Iteraciones iniciales de raíces',headers:['Método','k','Estimación (s)','|g(t)|'],rows:rootData.iterationRows},
    {title:'EDO: posición por RK2 y RK4',headers:['t (s)','Posición analítica (m)','RK2 (m)','RK4 (m)'],rows:rk2.filter((_,i)=>i%Math.max(1,Math.floor(rk2.length/8))===0||i===rk2.length-1).map(z=>{const i=rk2.indexOf(z);return [nfmt(z[0]),nfmt(v0*z[0]-.5*a*z[0]**2),nfmt(z[1]),nfmt(rk4[i][1])];})},
    {title:'Integración de la velocidad: distancia de frenado',headers:['Método','Integral (m)','Referencia (m)','Error absoluto (m)'],rows:[['Trapecio compuesto',integrations.trap,dist,Math.abs(integrations.trap-dist)],['Simpson 1/3 compuesto',integrations.simpson,dist,Math.abs(integrations.simpson-dist)],['Romberg',integrations.romberg,dist,Math.abs(integrations.romberg-dist)]].map(row=>row.map((v,i)=>i===0?v:nfmt(v)))}];
  const plots=[{title:'Velocidad durante el frenado',xLabel:'Tiempo de frenado (s)',yLabel:'Velocidad (m/s)',series:[series('Referencia analítica',samples(T,70,exact)),series('RK2',rk2.map(z=>[z[0],z[2]])),series('RK4',rk4.map(z=>[z[0],z[2]]))]},rootData.plot];
  const sensitivity=isMal?'Subexperimento numérico: g(t)=v₀(1−t/T)³ tiene raíz triple; la derivada en la raíz es cero. No es una curva física de frenado.':'';
  return {summary,tables,plots,metric:{label:'Distancia total',value:total,unit:'m'},
    numeric:`La referencia analítica da ${nfmt(T)} s. RK2 y RK4 reproducen este caso de desaceleración constante con error de posición máximo de ${nfmt(rkErr)} m (redondeo flotante). ${sensitivity}`,
    physical:`Con los parámetros sintéticos, la cabina recorre ${nfmt(reaction)} m durante la reacción y ${nfmt(dist)} m durante el frenado. No equivale a una distancia operativa de seguridad.`,
    note:isMal?'Escenario MAL CONDICIONADO: prueba de sensibilidad de una raíz múltiple; las distancias proceden del modelo lineal base.':'La desaceleración es constante; los escenarios no representan datos de Mi Teleférico.'};
}
function case2(s,p){
  const {D0,alpha,beta,threshold}=p,delta=threshold-D0;
  const T=2*delta/(alpha+Math.sqrt(alpha*alpha+4*beta*delta));
  const D=t=>D0+alpha*t+beta*t*t;
  const g=t=>D(t)-threshold,gp=t=>alpha+2*beta*t;
  const roots=solveRoot(g,gp,0,Math.max(1,2*T+1),T),rt=rootTables(roots),lin=solveLinearScenario(s);
  const tables=[{title:'Raíces: umbral preventivo',headers:['Método','Iteraciones','Raíz (mes)','Residual','Error absoluto'],rows:rt.rows},
    {title:'Iteraciones iniciales de raíces',headers:['Método','k','Estimación (mes)','|D(t)−umbral|'],rows:rt.iterationRows},
    {title:'Comparación de sistemas lineales SPD (4×4)',headers:['Método','Iteraciones','‖b−Ax‖∞','‖x−x*‖∞','Convergió'],rows:lin.rows},
    {title:'Primeras iteraciones de sistemas lineales',headers:['Método','k','Aproximación x⁽ᵏ⁾','Residual ∞'],rows:lin.iterationRows}];
  const plots=[{title:'Evolución del deterioro sintético',xLabel:'Tiempo (meses)',yLabel:'Índice de deterioro',series:[series('D(t)',samples(Math.max(20,T*1.3),90,D)),series('Umbral',[[0,threshold],[Math.max(20,T*1.3),threshold]])]},
    rt.plot,{title:'Convergencia de sistemas lineales SPD',xLabel:'Iteración',yLabel:'log₁₀(residual ∞)',series:lin.solvers.map(z=>series(z.method,z.trace.slice(0,140).map(t=>[t.k,Math.log10(Math.max(t.residual,1e-16))])))}];
  const mal=lin.perturbation;
  const note=mal?`Calibración auxiliar MAL CONDICIONADA: κ₂(A)=10⁶; perturbación relativa ‖δb‖∞/‖b‖∞=${nfmt(mal.relativeB)} y cambio relativo ‖δx‖∞/‖x*‖∞=${nfmt(mal.relativeX)}. La matriz permanece SPD.`:'Se emplea la referencia cuadrática del informe de Semana 1; la calibración SPD es transversal.';
  return {summary:[{label:'Mes de cruce',value:nfmt(T),unit:'mes'},{label:'Umbral sintético',value:nfmt(threshold),unit:'índice'},{label:'Condición matriz SPD',value:nfmt(lin.condition),unit:'κ₂'},{label:'Métodos de calibración',value:'4',unit:'aplicados'}],tables,plots,
    metric:{label:'Tiempo al umbral',value:T,unit:'meses'},
    numeric:`Bisección, Newton-Raphson y secante se contrastan con la raíz cuadrática ${nfmt(T)} meses. En la calibración SPD se ejecutaron Jacobi, Gauss-Seidel, LU y gradiente conjugado; los residuales y errores aparecen en la tabla.`,
    physical:`Bajo este modelo educativo se alcanzaría el umbral ${nfmt(threshold)} en ${nfmt(T)} meses. No constituye un calendario real de inspección ni diagnóstico mecánico.`,note};
}
function vibrationExact(t,p){
  const w0=Math.sqrt(p.k/p.m),gamma=p.c/(2*p.m),wd=Math.sqrt(Math.max(0,w0*w0-gamma*gamma));
  if(wd>1e-12)return Math.exp(-gamma*t)*(p.x0*Math.cos(wd*t)+(p.vInit+gamma*p.x0)/wd*Math.sin(wd*t));
  if(Math.abs(wd)<1e-12 && Math.abs(w0-gamma)<1e-9)return Math.exp(-gamma*t)*(p.x0+(p.vInit+gamma*p.x0)*t);
  // Para sobreamortiguamiento: dos exponentes reales.
  const d=Math.sqrt(Math.max(0,gamma*gamma-w0*w0)),r1=-gamma+d,r2=-gamma-d;
  const A=(p.vInit-r2*p.x0)/(r1-r2),B=p.x0-A;
  return A*Math.exp(r1*t)+B*Math.exp(r2*t);
}
function case3(s,p){
  const T=10,fun=(t,y)=>[y[1],(p.F0*Math.sin(p.omega*t)-p.c*y[1]-p.k*y[0])/p.m];
  const rk2=integrateSystem([p.x0,p.vInit],T,p.h,fun,2),rk4=integrateSystem([p.x0,p.vInit],T,p.h,fun,4);
  const analytic=p.F0===0;
  const fine=analytic?null:integrateSystem([p.x0,p.vInit],T,T/(12*(rk4.length-1)),fun,4);
  const ref=i=>analytic?vibrationExact(rk4[i][0],p):fine[i*12][1];
  const err2=rk2.map((z,i)=>Math.abs(z[1]-ref(i))),err4=rk4.map((z,i)=>Math.abs(z[1]-ref(i)));
  let idx=0;for(let i=1;i<rk4.length;i++)if(Math.abs(rk4[i][1])>Math.abs(rk4[idx][1]))idx=i;
  const max2=Math.max(...err2),max4=Math.max(...err4), maxAbs=Math.abs(rk4[idx][1]);
  const tables=[{title:'Trayectoria y error (m)',headers:['t (s)','Referencia','RK2','RK4','Error RK2','Error RK4'],rows:rk4.filter((_,i)=>i%Math.max(1,Math.floor(rk4.length/10))===0||i===rk4.length-1).map(z=>{const i=rk4.indexOf(z);return [nfmt(z[0]),nfmt(ref(i)),nfmt(rk2[i][1]),nfmt(z[1]),nfmt(err2[i]),nfmt(err4[i])];})}];
  // Cuadratura independiente en la misma función de referencia, con refinamiento.
  // Para vibración libre la referencia es analítica; para vibración forzada
  // se evalúa una trayectoria RK4 con paso más fino e interpolación lineal.
  const fineQuad=analytic?null:integrateSystem([p.x0,p.vInit],T,T/8192,fun,4);
  function xReference(t){
    if(analytic)return vibrationExact(t,p);
    const pos=Math.max(0,Math.min(fineQuad.length-1,t/T*(fineQuad.length-1)));
    const i=Math.min(fineQuad.length-2,Math.floor(pos)),w=pos-i;
    return fineQuad[i][1]*(1-w)+fineQuad[i+1][1]*w;
  }
  const square=t=>xReference(t)**2;
  const integrateRef=integrationMethods(square,0,T,4096).simpson;
  const quadratures=[10,20,40,80].map(n=>{
    const m=integrationMethods(square,0,T,n);
    return {n,trap:m.trap,simpson:m.simpson,romberg:m.romberg};
  });
  tables.push({title:'Integración de ∫₀¹⁰ x(t)² dt (cuadratura sobre referencia)',
    headers:['n','Trapecio','Error trapecio','Simpson 1/3','Error Simpson','Romberg','Error Romberg'],
    rows:quadratures.map(q=>[q.n,nfmt(q.trap),nfmt(Math.abs(q.trap-integrateRef)),nfmt(q.simpson),nfmt(Math.abs(q.simpson-integrateRef)),nfmt(q.romberg),nfmt(Math.abs(q.romberg-integrateRef))])});
  tables.push({title:'Referencia de magnitud integrada',headers:['Magnitud','Valor','Unidad'],rows:[['∫₀¹⁰ x(t)² dt',nfmt(integrateRef),'m²·s'],['Fuente',analytic?'Analítica + Simpson refinado':'RK4 h=10/8192 + Simpson refinado','—']]});
  const plots=[{title:'Desplazamiento lateral simulado',xLabel:'Tiempo (s)',yLabel:'Desplazamiento (m)',series:[series('Referencia',rk4.map((z,i)=>[z[0],ref(i)])),series('RK2',rk2.map(z=>[z[0],z[1]])),series('RK4',rk4.map(z=>[z[0],z[1]]))]},
    {title:'Error frente a referencia',xLabel:'Tiempo (s)',yLabel:'log₁₀(error absoluto)',series:[series('RK2',rk2.map((z,i)=>[z[0],Math.log10(Math.max(err2[i],1e-16))])),series('RK4',rk4.map((z,i)=>[z[0],Math.log10(Math.max(err4[i],1e-16))]))]}];
  plots.push({title:'Refinamiento de integración numérica',xLabel:'Subintervalos n',yLabel:'log₁₀(error absoluto)',series:[series('Trapecio',quadratures.map(q=>[q.n,Math.log10(Math.max(1e-16,Math.abs(q.trap-integrateRef)))])),series('Simpson 1/3',quadratures.map(q=>[q.n,Math.log10(Math.max(1e-16,Math.abs(q.simpson-integrateRef)))])),series('Romberg',quadratures.map(q=>[q.n,Math.log10(Math.max(1e-16,Math.abs(q.romberg-integrateRef)))]))]});
  return {summary:[{label:'Amplitud máx. |x|',value:nfmt(maxAbs),unit:'m'},{label:'Instante de pico',value:nfmt(rk4[idx][0]),unit:'s'},{label:'Error máx. RK2',value:nfmt(max2),unit:'m'},{label:'Error máx. RK4',value:nfmt(max4),unit:'m'},{label:'Integral ∫x²dt',value:nfmt(integrateRef),unit:'m²·s'}],tables,plots,
    metric:{label:'Amplitud máxima',value:maxAbs,unit:'m'},
    numeric:`RK2 (punto medio) tiene error máximo ${nfmt(max2)} m y RK4 ${nfmt(max4)} m en los nodos evaluados. La referencia es ${analytic?'la solución analítica subamortiguada/libre cuando corresponde':'RK4 independiente con paso doce veces menor'}.`,
    physical:`La respuesta hipotética alcanza |x|≈${nfmt(maxAbs)} m. La interpretación depende de masa, amortiguamiento y excitación; estos parámetros no representan una instalación real.`,
    note:s==='MAL CONDICIONADO'?'El escenario MAL CONDICIONADO corresponde a una calibración SPD auxiliar, no a un aumento demostrado del peligro físico. Para la trayectoria se usan los parámetros de NORMAL.':analytic?'Referencia exacta para vibración libre; el sistema no está conectado a sensores reales.':'Referencia independiente de malla refinada para el caso forzado.'};
}
export function lagrange(xs,ys,t){
  return xs.reduce((sum,x,i)=>{let li=1;for(let j=0;j<xs.length;j++)if(j!==i)li*=(t-xs[j])/(x-xs[j]);return sum+ys[i]*li;},0);
}
export function newtonDivided(xs,ys,t){
  const n=xs.length,coef=ys.slice();
  for(let j=1;j<n;j++)for(let i=n-1;i>=j;i--)coef[i]=(coef[i]-coef[i-1])/(xs[i]-xs[i-j]);
  let result=coef[n-1];for(let j=n-2;j>=0;j--)result=result*(t-xs[j])+coef[j];return result;
}
export function splineNatural(xs,ys,t){
  const n=xs.length,h=Array.from({length:n-1},(_,i)=>xs[i+1]-xs[i]);
  const alpha=Array(n).fill(0);
  for(let i=1;i<n-1;i++)alpha[i]=3/h[i]*(ys[i+1]-ys[i])-3/h[i-1]*(ys[i]-ys[i-1]);
  const l=Array(n).fill(0), mu=Array(n).fill(0),z=Array(n).fill(0),c=Array(n).fill(0),b=Array(n-1).fill(0),d=Array(n-1).fill(0);
  l[0]=1;
  for(let i=1;i<n-1;i++){l[i]=2*(xs[i+1]-xs[i-1])-h[i-1]*mu[i-1];mu[i]=h[i]/l[i];z[i]=(alpha[i]-h[i-1]*z[i-1])/l[i];}
  l[n-1]=1;
  for(let j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(ys[j+1]-ys[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j]);}
  let i=0;while(i<n-2&&t>xs[i+1])i++;
  const dx=t-xs[i];return ys[i]+b[i]*dx+c[i]*dx*dx+d[i]*dx*dx*dx;
}
/** k-NN de regresión; algoritmo supervisado sencillo usado solo como comparación IA.
 * Usa únicamente nodos observados para predecir; los puntos ocultos no entran al entrenamiento.
 */
export function knnPredict(xs,ys,t,k=2){
  if(xs.length!==ys.length||!xs.length)throw Error('Nodos inválidos para k-NN.');
  if(!Number.isFinite(t)||!Number.isInteger(k)||k<1||k>xs.length)throw Error('Consulta o k inválidos.');
  const neighbors=xs.map((x,i)=>({distance:Math.abs(t-x),y:ys[i]})).sort((a,b)=>a.distance-b.distance).slice(0,k);
  if(neighbors[0].distance<1e-14)return neighbors[0].y;
  const weights=neighbors.map(v=>1/Math.max(1e-12,v.distance**2));
  return neighbors.reduce((sum,v,i)=>sum+v.y*weights[i],0)/weights.reduce((a,b)=>a+b,0);
}
/** Evaluación de conjunto de prueba sintético independiente de los nodos de entrenamiento. */
export function evaluateSensorIA(scenario,p,count=41){
  validate(4,scenario,p);
  const mal=scenario==='MAL CONDICIONADO',xs=mal?[0,.001,.002,.003]:[0,.5,1.5,2];
  const eps=[.015,-.020,.025,-.015];
  const ys=xs.map((x,i)=>p.amp*Math.sin(x)+p.noiseScale*eps[i]);
  const fns=[['Lagrange',t=>lagrange(xs,ys,t)],['Newton dividido',t=>newtonDivided(xs,ys,t)],['Spline cúbico natural',t=>splineNatural(xs,ys,t)],['k-NN (k=2) · IA',t=>knnPredict(xs,ys,t,2)]];
  // No usar los nodos de entrenamiento como puntos de evaluación.
  const times=Array.from({length:count},(_,i)=>xs[0]+(i+0.5)/count*(xs.at(-1)-xs[0])).filter(t=>xs.every(x=>Math.abs(x-t)>1e-11));
  const metrics=fns.map(([method,fn])=>{
    const errors=times.map(t=>fn(t)-p.amp*Math.sin(t));
    const mae=errors.reduce((a,b)=>a+Math.abs(b),0)/errors.length;
    const rmse=Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length);
    return {method,mae,rmse,samples:times.length,errors:times.map((t,i)=>[t,Math.abs(errors[i])])};
  });
  return {xs,ys,times,metrics,knnK:2,testCount:times.length,warning:'Evaluación sintética; no hay sensores reales ni entrenamiento con telemetría.'};
}
function case4(s,p){
  const mal=s==='MAL CONDICIONADO',xs=mal?[0,.001,.002,.003]:[0,.5,1.5,2],epsilon=[.015,-.020,.025,-.015];
  const ys=xs.map((t,i)=>p.amp*Math.sin(t)+p.noiseScale*epsilon[i]);
  const hidden=[p.test1,p.test2],ai=evaluateSensorIA(s,p);
  const funcs=[['Lagrange',t=>lagrange(xs,ys,t)],['Newton dividido',t=>newtonDivided(xs,ys,t)],['Spline cúbico natural',t=>splineNatural(xs,ys,t)],['k-NN (k=2) · IA',t=>knnPredict(xs,ys,t,2)]];
  const rows=[],values=[];
  for(const t of hidden){const ref=p.amp*Math.sin(t);for(const [method,fun] of funcs){const prediction=fun(t),ea=Math.abs(prediction-ref);rows.push([nfmt(t),method,nfmt(prediction),nfmt(ref),nfmt(ea),ref!==0?nfmt(100*ea/Math.abs(ref))+' %':'—']);values.push({t,method,ea,prediction});}}
  const maxError=Math.max(...values.filter(v=>v.method!=='k-NN (k=2) · IA').map(v=>v.ea));
  const pts=samples(xs.at(-1),100,t=>p.amp*Math.sin(t));
  const plots=[{title:'Reconstrucción y señal sintética',xLabel:'Tiempo (s)',yLabel:'Lectura (u.)',series:[series('Señal de referencia',pts),series('Lagrange / Newton',pts.map(([t])=>[t,lagrange(xs,ys,t)])),series('Spline natural',pts.map(([t])=>[t,splineNatural(xs,ys,t)])),series('Muestras observadas',xs.map((t,i)=>[t,ys[i]]))]},
  {title:'Error en las muestras ocultas',xLabel:'Tiempo (s)',yLabel:'Error absoluto (u.)',series:funcs.map(([name])=>series(name,values.filter(v=>v.method===name).map(v=>[v.t,v.ea])))}];
  const tables=[{title:'Predicciones de puntos ocultados',headers:['t (s)','Método','Reconstrucción','Referencia','Error absoluto','Error %'],rows},
    {title:'Nodos de entrada',headers:['Nodo','t (s)','Dato observado','Señal ideal'],rows:xs.map((t,i)=>[i,nfmt(t),nfmt(ys[i]),nfmt(p.amp*Math.sin(t))])},
    {title:'Métricas sobre puntos de prueba NO utilizados en el entrenamiento',headers:['Método','Puntos de prueba','MAE','RMSE'],rows:ai.metrics.map(z=>[z.method,z.samples,nfmt(z.mae),nfmt(z.rmse)])}];
  plots.push({title:'IA y métodos numéricos: error absoluto de predicción',xLabel:'Tiempo (s)',yLabel:'Error absoluto (u.)',series:ai.metrics.map(z=>series(z.method,z.errors))});
  const extras=mal?`La Vandermonde cúbica para t=(0;0.001;0.002;0.003) tiene κ₂≈1.49×10⁹; al usar τ=t/0.003, κ₂≈98.868. Estos valores corresponden a los nodos fijos del subexperimento.`:'Lagrange y Newton dividido representan el mismo polinomio; sus valores deben coincidir salvo redondeo.';
  return {summary:[{label:'Muestras disponibles',value:String(xs.length),unit:'nodos'},{label:'Pruebas ocultas',value:String(hidden.length),unit:'puntos'},{label:'Error máximo',value:nfmt(maxError),unit:'u.'},{label:'Ruido aplicado',value:nfmt(p.noiseScale),unit:'factor'},{label:'MAE k-NN (IA)',value:nfmt(ai.metrics.at(-1).mae),unit:'u.'}],tables,plots,
    metric:{label:'Error máximo de reconstrucción',value:maxError,unit:'u.'},
    numeric:`Los tres métodos reconstruyen los dos puntos ocultados y se comparan frente a sen(t). Error absoluto máximo observado: ${nfmt(maxError)} u. El algoritmo IA k-NN (k=2) se evalúa con ${ai.testCount} puntos sintéticos no utilizados como entrenamiento; comparación MAE/RMSE disponible. ${extras}`,
    physical:'Las lecturas faltantes se estiman, pero una curva ajustada no garantiza exactitud fuera de los puntos verificados; el ruido puede distorsionar una interpolación exacta en los nodos.',
    note:mal?'MAL CONDICIONADO es un ensayo de escala de los nodos y de sensibilidad de coeficientes; no es fallo comprobado de sensores.':'Se utiliza la señal sintética s(t)=A·sen(t), no telemetría real.'};
}
export function simulateCase(caseId,scenario,params){
  const id=Number(caseId);validate(id,scenario,params);
  const result=[null,case1,case2,case3,case4][id](scenario,params);
  const metadata={caseId:id,scenario,params:{...params},model:CASES[id-1].model};
  return {...result,...metadata};
}
