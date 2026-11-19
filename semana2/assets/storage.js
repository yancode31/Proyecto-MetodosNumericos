/** Persistencia de Semana 2.
 * Servidor Python + SQLite si está disponible en el mismo origen.
 * En GitHub Pages: IndexedDB (no compartido entre dispositivos).
 */
const DB_NAME='SIMTELE_RISK_S2';
const STORE='experimentos';
let mode='pendiente';
let dbPromise;

const localFallbackKey=DB_NAME+'_fallback';
function fallbackRead(){try{return JSON.parse(localStorage.getItem(localFallbackKey)||'[]')}catch{return []}}
function fallbackWrite(rows){localStorage.setItem(localFallbackKey,JSON.stringify(rows));}

async function idb(){
  if(!('indexedDB' in globalThis))return null;
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const st=db.createObjectStore(STORE,{keyPath:'id'});
        st.createIndex('createdAt','createdAt',{unique:false});
        st.createIndex('caseId','result.caseId',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  }).catch(()=>null);
  return dbPromise;
}
async function readFromIdb(){
  const db=await idb();if(!db)return fallbackRead();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function putInIdb(record){
  const db=await idb();if(!db){fallbackWrite([...fallbackRead().filter(x=>x.id!==record.id),record]);return;}
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
}
async function deleteInIdb(id){
  const db=await idb();if(!db){fallbackWrite(fallbackRead().filter(x=>x.id!==id));return;}
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
}
async function jsonFetch(path,options={}){
  const res=await fetch('./api/'+path,{cache:'no-store',...options});
  if(!res.ok){const message=await res.text();throw Error(`API ${res.status}: ${message.slice(0,120)}`);}
  return res.status===204?null:res.json();
}
export async function initStorage(){
  if(mode!=='pendiente')return mode;
  try{
    const controller=new AbortController();
    const res=await fetch('./api/health',{cache:'no-store',signal:controller.signal});
    if(res.ok&&res.headers.get('content-type')?.includes('application/json')){
      const data=await res.json();if(data?.database==='SQLite'){mode='sqlite';return mode;}
    }
  }catch{/* GitHub Pages no proporciona API */}
  mode='indexeddb';return mode;
}
export const getStorageMode=()=>mode;
export async function listExperiments(){
  await initStorage();
  const rows=mode==='sqlite'?await jsonFetch('experimentos'):await readFromIdb();
  return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
export async function saveExperiment(rec){
  await initStorage();
  if(mode==='sqlite')return jsonFetch('experimentos',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});
  await putInIdb(rec);return {id:rec.id};
}
export async function removeExperiment(id){
  await initStorage();
  if(mode==='sqlite')return jsonFetch(`experimentos/${encodeURIComponent(id)}`,{method:'DELETE'});
  return deleteInIdb(id);
}
export async function databasePreview(table='simulacion'){
  await initStorage();
  if(mode==='sqlite')return jsonFetch('tabla/'+encodeURIComponent(table));
  // SQLite no existe en GitHub Pages. La tabla representa la colección IndexedDB real.
  const rows=await readFromIdb();
  return {table:'experimentos (IndexedDB)',columns:['id','createdAt','caseId','scenario','params','metric'],rows:rows.map(x=>({
    id:x.id,createdAt:x.createdAt,caseId:x.result.caseId,scenario:x.result.scenario,
    params:JSON.stringify(x.result.params),metric:JSON.stringify(x.result.metric)
  })),total:rows.length};
}
/** Importa registros guardados antes en SIMTELE_RISK_S1, mismo navegador y origen.
 * Este botón es explícito para no modificar resultados de la Semana 1.
 */
export async function importWeek1(){
  await initStorage();
  let previous=[];
  if('indexedDB' in globalThis){
    const db=await new Promise((resolve)=>{
      const req=indexedDB.open('SIMTELE_RISK_S1',1);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
      req.onupgradeneeded=()=>{/* la tienda aún no existe */};
    });
    if(db){
      if(db.objectStoreNames.contains('experimentos')){
        previous=await new Promise((resolve,reject)=>{
          const req=db.transaction('experimentos','readonly').objectStore('experimentos').getAll();
          req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
        });
      }
      db.close();
    }
  }
  if(!previous.length){
    try{previous=JSON.parse(localStorage.getItem('SIMTELE_RISK_S1_fallback')||'[]')}catch{}
  }
  const existing=new Set((await listExperiments()).map(x=>x.id));
  let imported=0;
  for(const rec of previous){
    if(existing.has(rec.id)||!rec.result)continue;
    await saveExperiment({...rec,importedFrom:'semana1',modelVersion:rec.modelVersion||'semana1-v1'});
    imported++;
  }
  return imported;
}
