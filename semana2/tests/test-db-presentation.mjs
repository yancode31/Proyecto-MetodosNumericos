import assert from 'node:assert/strict';
import {simulateCase,PRESETS} from '../assets/math.js';
const elements=new Map(),handlers={};
function makeEl(){return {innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},scrollIntoView(){}};}
const get=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s);};
globalThis.document={querySelector:get,addEventListener:(type,fn)=>{handlers[type]=fn;},createElement:()=>makeEl(),body:{append(){}}};
let confirmDelete=false;
globalThis.window={location:{hash:''},scrollTo(){},clearTimeout(){},addEventListener(){},confirm:()=>confirmDelete};
const key='SIMTELE_RISK_S2_fallback';const records=[];
for(let i=0;i<12;i++){const c=i%4+1,sc=['NORMAL','ESTRÉS','MAL CONDICIONADO'][Math.floor(i/4)];records.push({id:`registro-${String(i).padStart(2,'0')}`,createdAt:new Date(Date.UTC(2026,10,1+i)).toISOString(),modelVersion:'semana2-integrada-v2.1',result:simulateCase(c,sc,PRESETS[c][sc])});}
const values=new Map([[key,JSON.stringify(records)]]);globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};globalThis.fetch=async()=>({ok:false});globalThis.setTimeout=()=>1;
await import('../assets/app.js');await new Promise(resolve=>setImmediate(resolve));
let count=0;const check=(condition,message)=>{assert.ok(condition,message);count++;};
const act=async(action,id)=>handlers.click({target:{closest:()=>({hasAttribute:()=>false,dataset:{action,id}})}});
const nav=async(key)=>handlers.click({target:{closest:()=>({hasAttribute:k=>k==='data-nav',dataset:{nav:key}})}});
const change=(id,value)=>handlers.change({target:{id,value}});const input=(id,value)=>handlers.input({target:{id,value}});
const rows=(html)=>(html.match(/data-action="db-detail"/g)||[]).length;
check(get('#app').innerHTML.includes('Datos realmente guardados'),'Inicio mantiene datos guardados');
check(!get('#app').innerHTML.includes('"alpha"'),'Sin parámetros JSON en inicio');
await nav('base-datos');let html=get('#app').innerHTML;
check(html.includes('12</h3>'),'Lee 12 registros preexistentes');check(rows(html)===8,'Página de ocho');check(html.includes('Página 1 de 2'),'Dos páginas');check(!html.includes('Parámetros JSON'),'Sin columna JSON');check(!html.includes('json-panel'),'Sin bloques JSON');check(!html.includes('id="sqlPreview"'),'Explorador cerrado por defecto');
await act('db-next');check(rows(get('#dbRecords').innerHTML)===4,'Última página');await act('db-next');check(get('#dbRecords').innerHTML.includes('Página 2 de 2'),'Límite superior');await act('db-prev');check(rows(get('#dbRecords').innerHTML)===8,'Página anterior');
change('dbCaseFilter','2');check(rows(get('#dbRecords').innerHTML)===3,'Filtrar módulo');change('dbScenarioFilter','ESTRÉS');check(rows(get('#dbRecords').innerHTML)===1,'Combinar filtros');input('dbSearch','estres');check(rows(get('#dbRecords').innerHTML)===1,'Búsqueda sin tilde');input('dbSearch','no existe');check(rows(get('#dbRecords').innerHTML)===0,'Búsqueda sin coincidencias');await act('db-reset');check(rows(get('#app').innerHTML)===8,'Restablecer filtros');change('dbSort','oldest');check(get('#dbRecords').innerHTML.indexOf('registro-00')<get('#dbRecords').innerHTML.indexOf('registro-01'),'Orden cronológico');
await act('db-detail','registro-01');let detail=get('#dbDetail').innerHTML;check(detail.includes('Tasa lineal α'),'Etiqueta legible');check(detail.includes('mes⁻¹'),'Unidad');check(detail.includes('Abrir resultados completos'),'Acceso a resultados');check(!detail.includes('json-panel'),'Detalle sin JSON');
await act('verify-saved','registro-01');check(get('#dbDetail').innerHTML.includes('valores numéricos comprobados'),'Verificación visible');check(get('#dbDetail').innerHTML.includes('✓'),'Verificación satisfactoria');check(values.get(key)===JSON.stringify(records),'Consultar/verificar no modifica registros históricos');await act('db-close');check(get('#dbDetail').innerHTML==='','Cerrar detalle');
await act('db-technical');check(get('#app').innerHTML.includes('id="sqlPreview"'),'Explorador bajo demanda');check(get('#sqlPreview').innerHTML.includes('Dato estructurado'),'Oculta objetos crudos');check(get('#sqlPreview').innerHTML.includes('experimentos (IndexedDB)'),'Identifica colección');await act('db-technical');check(!get('#app').innerHTML.includes('id="sqlPreview"'),'Ocultar explorador');
await act('open-saved','registro-01');check(get('#app').innerHTML.includes('Recuperado / guardado'),'Recuperar experimento');await nav('base-datos');await act('rerun','registro-01');check(get('#app').innerHTML.includes('Guardar ejecución'),'Relanzamiento permite guardar nueva ejecución');await nav('base-datos');await act('db-detail','registro-01');await act('delete','registro-01');check(JSON.parse(values.get(key)).length===12,'Cancelar eliminación');confirmDelete=true;await act('delete','registro-01');check(JSON.parse(values.get(key)).length===11,'Eliminar confirmado');check(!get('#app').innerHTML.includes('dbDetailTitle'),'Detalle cerrado tras eliminación');check(JSON.parse(values.get(key)).every(r=>r.modelVersion==='semana2-integrada-v2.1'),'Versiones originales conservadas');
console.log(`OK · ${count} comprobaciones de gestión de datos (DOM simulado, persistencia alternativa local).`);
