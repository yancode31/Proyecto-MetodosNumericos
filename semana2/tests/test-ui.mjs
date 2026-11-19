import assert from 'node:assert/strict';
const elements=new Map();
function makeEl(){return {innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}};}
const get=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s);};
const handlers={};
globalThis.document={querySelector:get,addEventListener:(type,fn)=>{handlers[type]=fn;},createElement:()=>makeEl(),body:{append(){} }};
globalThis.window={location:{hash:''},scrollTo(){},clearTimeout(){},addEventListener(){},confirm:()=>true};
let values=new Map();
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.fetch=async()=>({ok:false});
globalThis.setTimeout=(fn)=>1; // no browser timers in this DOM test
await import('../assets/app.js');
await new Promise(resolve=>process.nextTick(resolve));
await new Promise(resolve=>setImmediate(resolve));
assert.ok(get('#app').innerHTML.includes('Datos realmente guardados'),'Inicio debe incluir la tabla del docente.');
function nav(key){handlers.click({target:{closest:()=>({hasAttribute:k=>k==='data-nav',dataset:{nav:key}})}});}
async function act(key){await handlers.click({target:{closest:()=>({hasAttribute:()=>false,dataset:{action:key}})}});}
nav('base-datos');
assert.ok(get('#app').innerHTML.includes('Base de datos y simulaciones'));
assert.ok(get('#app').innerHTML.includes('IndexedDB · este navegador'));
await act('demo');
assert.ok(get('#app').innerHTML.includes('4</h3>'),'Se deben guardar 4 pruebas sintéticas');
nav('inicio');
assert.ok(get('#app').innerHTML.includes('Datos realmente guardados'));
assert.ok(get('#app').innerHTML.includes('Ver base de datos'));
nav('laboratorio-ia');
assert.ok(get('#app').innerHTML.includes('Laboratorio de predicción IA'));
assert.ok(get('#app').innerHTML.includes('k-NN (k=2)'));
nav('caso-3');
assert.ok(get('#app').innerHTML.includes('Integración de ∫₀¹⁰'));
nav('caso-4');
assert.ok(get('#app').innerHTML.includes('Métricas sobre puntos de prueba'));
console.log('OK · 10 comprobaciones de renderizado de vistas, IA y tabla de registros (DOM simulado).');
