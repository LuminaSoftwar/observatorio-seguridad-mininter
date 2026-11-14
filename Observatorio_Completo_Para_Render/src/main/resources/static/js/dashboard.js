(() => {
'use strict';
const $=id=>document.getElementById(id);
const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const tipos=['Robo','Hurto','Extorsión','Estafa','Secuestro','Violencia contra la mujer e integrantes','Otros'];
const fmt=n=>Math.round(n).toLocaleString('es-PE');
const config=window.OBS_SUPABASE||{};
const charts={};let filas=[],homicidios=[],homicidiosNacionales=[],vista='mensual',catalogo=[];
const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const CATALOGO_BASE='https://cdn.jsdelivr.net/gh/RitchieRD/ubigeos-peru-data@main/json/';
async function cargarCatalogo(){
 const [deps,provs,dists]=await Promise.all(['1_ubigeo_departamentos.json','2_ubigeo_provincias.json','3_ubigeo_distritos.json'].map(async f=>{const r=await fetch(CATALOGO_BASE+f);if(!r.ok)throw new Error('No se pudo cargar '+f);const j=await r.json();return Array.isArray(j)?j:Object.values(j); }));
 const depMap=new Map(deps.map(d=>[String(d.id),String(d.departamento).trim()]));
 const provMap=new Map(provs.map(p=>[String(p.id),{departamento:depMap.get(String(p.departamento_id)),provincia:String(p.provincia).trim()}]));
 const listado=dists.map(d=>{const p=provMap.get(String(d.provincia_id));return p?{departamento:p.departamento,provincia:p.provincia,distrito:String(d.distrito).trim()}:null;}).filter(x=>x&&x.departamento);
 if(listado.length<1000)throw new Error('Catálogo territorial incompleto');return listado;
}

function aviso(s){const el=$('estado-catalogo-dashboard');if(el)el.textContent=s;}
function unique(a){return [...new Set(a)].sort((x,y)=>x.localeCompare(y,'es'));}
function poblar(sel,items,placeholder,preferred='Todos'){
 sel.replaceChildren(new Option(placeholder,'Todos'));
 for(const v of items)sel.add(new Option(v,v));
 sel.value=items.includes(preferred)?preferred:'Todos';
}
function options(){return {responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}};}
function graf(id,type,labels,values,label){if(!window.Chart)return;if(charts[id])charts[id].destroy();charts[id]=new Chart($(id),{type,data:{labels,datasets:[{label,data:values,backgroundColor:type==='doughnut'?['#164b78','#47866b','#d18b24','#a94f4f','#8064a2']:'rgba(22,75,120,.65)',borderColor:'#164b78',tension:.25,fill:type==='line'}]},options:type==='doughnut'?{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}:options()});}
// Los meses provienen de SIDPOL: no se generan valores sintéticos.
function mensual(r,mes){return r.mes===mes+1?r.cantidad:0;}
function filtroGeo(r){const dep=$('filtro-departamento').value,prov=$('filtro-provincia').value,dist=$('filtro-distrito-visible').value;return (dep==='Todos'||normalizar(r.departamento)===normalizar(dep))&&(prov==='Todos'||normalizar(r.provincia)===normalizar(prov))&&(dist==='Todos'||normalizar(r.distrito)===normalizar(dist));}
function suma(year,tipo='Todos',mes=null){let total=0;for(const r of filas)if(r.anio===year&&(tipo==='Todos'||r.modalidad===tipo)&&filtroGeo(r))total+=(mes===null||r.mes===mes+1)?r.cantidad:0;return total;}
function actualizaGeo(nivel){
 const depEl=$('filtro-departamento'),provEl=$('filtro-provincia'),distEl=$('filtro-distrito-visible');
 const dep=depEl.value,prov=provEl.value,dist=distEl.value;
 const base=catalogo.length?catalogo:filas;
 if(nivel===0)poblar(depEl,unique(base.map(r=>r.departamento)),'Todos los departamentos',dep);
 const d=depEl.value;
 if(nivel<=1)poblar(provEl,unique(base.filter(r=>d==='Todos'||normalizar(r.departamento)===normalizar(d)).map(r=>r.provincia)),'Todas las provincias',nivel===0?prov:'Todos');
 const p=provEl.value;
 poblar(distEl,unique(base.filter(r=>(d==='Todos'||normalizar(r.departamento)===normalizar(d))&&(p==='Todos'||normalizar(r.provincia)===normalizar(p))).map(r=>r.distrito)),'Todos los distritos',nivel<=1?'Todos':dist);
 provEl.disabled=false;distEl.disabled=false;actualizar();
}

function actualizar(){
 if(!filas.length)return;
 const anio=+$('filtro-periodo').value,comp=+$('filtro-comparacion').value;
 const total=suma(anio),prev=suma(comp),vals=Object.fromEntries(tipos.map(t=>[t,suma(anio,t)]));
 const dep=$('filtro-departamento').value,prov=$('filtro-provincia').value,dist=$('filtro-distrito-visible').value;
 let hom=null,notaH='';
 if(anio===2025){if(dep==='Todos'&&prov==='Todos'&&dist==='Todos'){
   const r=homicidiosNacionales.find(x=>Number(x.anio)===2025);if(r){hom=Number(r.cantidad);notaH='Estimación preliminar nacional del INEI/CEIC (2025)';}
  }else notaH='Sin desglose territorial verificable para 2025';
 }else{
  const lista=homicidios.filter(r=>Number(r.anio)===anio);
  if(lista.length){hom=lista.filter(r=>(dep==='Todos'||normalizar(r.departamento)===normalizar(dep))&&(prov==='Todos'||normalizar(r.provincia)===normalizar(prov))&&(dist==='Todos'||normalizar(r.distrito)===normalizar(dist))).reduce((a,r)=>a+Number(r.cantidad),0);notaH='INEI/CEIC · muertes violentas dolosas';}
 }
 $('kpi-homicidios').textContent=hom===null?'Sin datos':fmt(hom);
 const hnota=$('nota-homicidios');if(hnota)hnota.textContent=notaH;

 [['kpi-hechos',total],['kpi-extorsion',vals['Extorsión']],['kpi-robos',vals.Robo],['kpi-hurtos',vals.Hurto]].forEach(([id,n])=>$(id).textContent=fmt(n));
 $('kpi-variacion').textContent=prev?`${((total-prev)/prev*100).toFixed(1)} %`:'Sin datos';
 $('kpi-hechos-periodo').textContent=`Denuncias en CSV · ${anio}`;
 $('kpi-variacion-detalle').textContent=`Comparado con ${comp}`;
 $('estado-filtros').textContent=`Fuente: SIDPOL, denuncias policiales mensuales 2022–2025. Homicidios: INEI/CEIC (2025 preliminar nacional).${total===0?' Sin registros de denuncias para la selección actual.':''}`;
 graf('chart-tipos','doughnut',tipos,tipos.map(t=>vals[t]),'Denuncias');
 $('alt-tipos').textContent=`Total anual: ${fmt(total)} denuncias; distribución por cinco categorías.`;
 const tipo=$('evolucion-tipo').value,desde=+$('anio-desde').value,hasta=+$('anio-hasta').value;
 if(vista==='mensual'){
  const serie=meses.map((_,m)=>suma(anio,tipo,m));
  $('titulo-evolucion').textContent='1. Evolución mensual de denuncias policiales';
  $('descripcion-evolucion').textContent=`Registros mensuales SIDPOL de ${tipo==='Todos'?'todas las modalidades':tipo} en ${anio}.`;
  $('rango-anios').hidden=true;
  graf('chart-evolucion','line',meses,serie,'Denuncias mensuales SIDPOL');
  $('alt-evolucion').textContent=`Denuncias mensuales observadas. Total anual: ${fmt(serie.reduce((a,b)=>a+b,0))}.`;
 }else{
  const years=Array.from({length:Math.max(0,hasta-desde+1)},(_,i)=>desde+i);
  $('titulo-evolucion').textContent='1. Comparación anual';$('descripcion-evolucion').textContent='Datos anuales procedentes de los CSV.';$('rango-anios').hidden=false;
  graf('chart-evolucion','bar',years,years.map(y=>suma(y,tipo)),'Denuncias anuales');$('alt-evolucion').textContent=`Comparación anual entre ${desde} y ${hasta}.`;
 }
 const ay=+$('distritos-anio').value,mes=$('distritos-mes').value,dt=$('distritos-tipo').value;
 const porDistrito=new Map();
 for(const r of filas){if(r.anio!==ay||(dt!=='Todos'&&r.modalidad!==dt)||!filtroGeo(r))continue;
  const k=`${r.distrito} · ${r.provincia} · ${r.departamento}`;
  porDistrito.set(k,(porDistrito.get(k)||0)+(mes==='Todos'?r.cantidad:mensual(r,+mes-1)));
 }
 const top=[...porDistrito].sort((a,b)=>b[1]-a[1]).slice(0,10);
 graf('chart-distritos','bar',top.map(x=>x[0]),top.map(x=>x[1]),mes==='Todos'?'Denuncias anuales':'Denuncias mensuales SIDPOL');
 $('alt-distritos').textContent=mes==='Todos'?'Comparación anual de distritos del CSV.':'Comparación de denuncias registradas durante el mes seleccionado.';
}
async function consultarTabla(tabla,campos){
 let arr=[],offset=0;
 while(true){
  const url=`${config.url.replace(/\/$/,'')}/rest/v1/${tabla}?select=${campos}&limit=1000&offset=${offset}`;
  const headers={apikey:config.anonKey};if(config.anonKey.startsWith('eyJ'))headers.Authorization=`Bearer ${config.anonKey}`;
  const resp=await fetch(url,{headers});if(!resp.ok)throw new Error(`${tabla}: HTTP ${resp.status}: ${await resp.text()}`);
  const page=await resp.json();arr.push(...page);if(page.length<1000)break;offset+=page.length;
  if(offset>300000)throw new Error('Se superó el límite de paginación de '+tabla);
 }
 return arr;
}
async function cargar(){
 if(!config.url||!config.anonKey||config.url.includes('REEMPLAZAR')){aviso('Configura URL y clave pública en supabase-config.js');return;}
 aviso('Cargando denuncias mensuales SIDPOL y homicidios INEI…');
 try{
  [filas,homicidios,homicidiosNacionales]=await Promise.all([
   consultarTabla('obs_denuncias_policiales','anio,mes,departamento,provincia,distrito,ubigeo,modalidad,cantidad'),
   consultarTabla('obs_homicidios_inei','anio,ubigeo,departamento,provincia,distrito,cantidad,estado'),
   consultarTabla('obs_homicidios_nacional','anio,ambito,cantidad,estado')]);
  filas=filas.map(r=>({...r,anio:Number(r.anio),mes:Number(r.mes),cantidad:Number(r.cantidad)}));
  aviso(`${fmt(filas.length)} registros agregados de denuncias SIDPOL y ${fmt(homicidios.length)} registros de homicidios INEI.`);
  try{catalogo=await cargarCatalogo();aviso(`${fmt(filas.length)} filas SIDPOL. Catálogo nacional: ${fmt(catalogo.length)} distritos. Las ubicaciones sin registros no representan cero delitos.`);}catch(err){console.warn(err);aviso(`Catálogo nacional no disponible: ${err.message}`);}
  actualizaGeo(0);
 }catch(e){aviso(`No se pudo consultar Supabase: ${e.message}. Ejecuta SQL e importa los tres CSV.`);console.error(e);}
}
document.addEventListener('DOMContentLoaded',()=>{
 if(!$('filtro-periodo'))return;
 for(const id of ['evolucion-tipo','distritos-tipo'])poblar($(id),tipos,'Todos');
 for(const id of ['filtro-periodo','filtro-comparacion','evolucion-tipo','distritos-anio','distritos-mes','distritos-tipo','anio-desde','anio-hasta'])$(id).addEventListener('change',actualizar);
 $('filtro-departamento').addEventListener('change',()=>actualizaGeo(1));
 $('filtro-provincia').addEventListener('change',()=>actualizaGeo(2));
 $('filtro-distrito-visible').addEventListener('change',actualizar);
 $('vista-mensual').addEventListener('click',()=>{vista='mensual';$('vista-mensual').classList.add('activo');$('vista-anual').classList.remove('activo');actualizar();});
 $('vista-anual').addEventListener('click',()=>{vista='anual';$('vista-anual').classList.add('activo');$('vista-mensual').classList.remove('activo');actualizar();});
 $('restablecer-filtros').addEventListener('click',()=>{$('filtro-periodo').value='2025';$('filtro-comparacion').value='2024';$('distritos-anio').value='2025';$('distritos-mes').value='Todos';$('evolucion-tipo').value='Todos';$('distritos-tipo').value='Todos';$('filtro-departamento').value='Todos';actualizaGeo(1);});
 cargar();
});
})();
