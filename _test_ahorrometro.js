// Verificación de coherencia historial vs proyección (ahorrometro.html)
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/ahorrometro.html", "utf8");
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

function mkEl(id){
  const el = {
    id, _text:"", _html:"", style:{}, hidden:false, value:"", className:"",
    classList:{ _s:new Set(),
      add(...c){c.forEach(x=>this._s.add(x));}, remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){ if(f===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c);} else { f?this._s.add(c):this._s.delete(c);} },
      contains(c){return this._s.has(c);} },
    children:[], firstChild:null,
    appendChild(c){ this.children.push(c); this.firstChild=this.children[0]; return c; },
    remove(){},
    querySelector(){ return mkEl(id+"-q"); },
    querySelectorAll(){ return []; },
    getBoundingClientRect(){ return {left:0,top:0,width:0,height:0}; },
    addEventListener(){}, removeEventListener(){}, focus(){}, select(){},
    setAttribute(){}, getAttribute(){ return null; },
    clientWidth:900, clientHeight:300, offsetWidth:0,
    getContext(){ return null; }, animate(){},
  };
  Object.defineProperty(el,"textContent",{ get(){return this._text;}, set(v){this._text=String(v);} });
  Object.defineProperty(el,"innerHTML",{ get(){return this._html;}, set(v){this._html=String(v);} });
  return el;
}
const els = {};
const qsel = {};
const sandbox = {
  console,
  setTimeout:()=>0, clearTimeout(){}, requestAnimationFrame:()=>0,
  addEventListener:()=>{}, removeEventListener:()=>{},
  navigator:{},
  innerWidth:1200, innerHeight:800,
  localStorage:{ getItem:()=>null, setItem:()=>{}, removeItem:()=>{} },
  URL:{ createObjectURL:()=>"blob:x", revokeObjectURL:()=>{} },
  Blob:function(){},
  document:{
    documentElement: mkEl("html"),
    getElementById:(id)=> (els[id] = els[id] || mkEl(id)),
    createElement:(t)=> mkEl("new-"+t),
    addEventListener:()=>{},
    querySelector:(sel)=> (qsel[sel] = qsel[sel] || mkEl("q:"+sel)),
    querySelectorAll:()=>[],
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename:"ahorrometro.js" });
// `const state` y similares viven en el ámbito léxico global, no en el objeto global:
// un segundo script del mismo contexto los expone como propiedades.
vm.runInContext("globalThis.__api = { state, buildTimeline, proyectarFuturo, diasParaMetaConAportes, dailyRate, addDiasISO, hoyISO, streakPendienteHoy, renderAll, esFechaAporte, esDiaHabil, retirosPorDia, tasaParaFecha, baseDeInteresHoy };", sandbox);
Object.assign(sandbox, sandbox.__api);

let fails = 0;
function check(name, cond, detail){
  if(cond){ console.log("  ✅ " + name); }
  else { fails++; console.log("  ❌ " + name + (detail ? "  → " + detail : "")); }
}
const S = sandbox.state;
const near = (a,b,eps=1e-4) => Math.abs(a-b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

// Aportes base (incluye uno en sábado, para ejercitar el "backdate" de rachas)
S.contributions = [
  { id:"c1", date:"2026-08-10", amount:200000, note:"lun" },
  { id:"c2", date:"2026-09-05", amount:150000, note:"sáb" },
  { id:"c3", date:"2026-10-19", amount:150000, note:"lun" },
];
S.tasa = 40; S.tasaType = "TNA"; S.compound = true; S.meta = null;
S.aporteExtra = {monto:0, mode:"dia", dia:1, hab:1};
S.diaAjuste = {};
S.retiros = []; S.tasaHist = []; S.inflacionMensual = 0;

console.log("\n[1] Proyección sin aportes extra == historial extendido (compound=true)");
{
  const H = sandbox.hoyISO();
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  for(const N of [1, 7, 30, 90, 365]){
    const hist = sandbox.buildTimeline(S.contributions, 40, sandbox.addDiasISO(H, N));
    const proj = sandbox.proyectarFuturo(B0.balanceTotal, N, {monto:0,mode:"dia",dia:1,hab:1}, S.compound ? B0.balanceTotal : B0.depositado);
    check("N=" + N + "  hist=" + hist.balanceTotal.toFixed(2) + "  proj=" + proj.balance.toFixed(2),
          near(proj.balance, hist.balanceTotal),
          "diferencia: " + (proj.balance - hist.balanceTotal).toFixed(4));
  }
}

console.log("\n[2] Mismo check con compound=false (base de interés = solo aportes)");
{
  S.compound = false;
  const H = sandbox.hoyISO();
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  for(const N of [7, 30, 90]){
    const hist = sandbox.buildTimeline(S.contributions, 40, sandbox.addDiasISO(H, N));
    const proj = sandbox.proyectarFuturo(B0.balanceTotal, N, {monto:0,mode:"dia",dia:1,hab:1}, S.compound ? B0.balanceTotal : B0.depositado);
    check("N=" + N + "  hist=" + hist.balanceTotal.toFixed(2) + "  proj=" + proj.balance.toFixed(2),
          near(proj.balance, hist.balanceTotal),
          "diferencia: " + (proj.balance - hist.balanceTotal).toFixed(4));
  }
  S.compound = true;
}

console.log("\n[3] Hoy NO hábil (domingo): la racha abierta debe arrancar en la proyección");
{
  const realHoy = sandbox.hoyISO;
  sandbox.hoyISO = () => "2026-10-25"; // domingo
  const H = "2026-10-25";
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  const pend = sandbox.streakPendienteHoy();
  check("streakPendienteHoy() = " + pend + " (esperado 2)", pend === 2);
  for(const N of [1, 2, 7, 30, 90]){
    const hist = sandbox.buildTimeline(S.contributions, 40, sandbox.addDiasISO(H, N));
    const proj = sandbox.proyectarFuturo(B0.balanceTotal, N, {monto:0,mode:"dia",dia:1,hab:1}, S.compound ? B0.balanceTotal : B0.depositado);
    check("N=" + N + "  hist=" + hist.balanceTotal.toFixed(2) + "  proj=" + proj.balance.toFixed(2),
          near(proj.balance, hist.balanceTotal),
          "diferencia: " + (proj.balance - hist.balanceTotal).toFixed(4));
  }
  sandbox.hoyISO = realHoy;
}
console.log("\n[4] Con aporte extra mensual: proyección == historial con esos aportes como contribuciones reales");
{
  const H = sandbox.hoyISO();
  const N = 60;
  const aportes = { monto:50000, mode:"dia", dia:7, hab:1 };
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  const hasta = sandbox.addDiasISO(H, N);
  const extras = [];
  for(let y = +H.slice(0,4); y <= +hasta.slice(0,4); y++){
    for(let m = 1; m <= 12; m++){
      const dim = new Date(y, m, 0).getDate();
      const dia = Math.min(7, dim);
      const iso = y + "-" + String(m).padStart(2,"0") + "-" + String(dia).padStart(2,"0");
      if(iso > H && iso <= hasta) extras.push({ id:"x"+y+m, date:iso, amount:50000, note:"sim" });
    }
  }
  const hist = sandbox.buildTimeline([...S.contributions, ...extras], 40, hasta);
  const proj = sandbox.proyectarFuturo(B0.balanceTotal, N, aportes, S.compound ? B0.balanceTotal : B0.depositado);
  check("nAportes=" + proj.nAportes + " (esperado " + extras.length + ")", proj.nAportes === extras.length);
  check("hist=" + hist.balanceTotal.toFixed(2) + "  proj=" + proj.balance.toFixed(2),
        near(proj.balance, hist.balanceTotal),
        "diferencia: " + (proj.balance - hist.balanceTotal).toFixed(4));
}

console.log("\n[5] diasParaMetaConAportes sin aportes == fórmula cerrada (hoy día hábil)");
{
  const H = sandbox.hoyISO();
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  const meta = 5000000;
  const daily = sandbox.dailyRate(40, "TNA");
  const closed = Math.ceil(Math.log(meta / B0.balanceTotal) / Math.log(1 + daily));
  const r = sandbox.diasParaMetaConAportes(B0.balanceTotal, meta, {monto:0,mode:"dia",dia:1,hab:1}, S.compound ? B0.balanceTotal : B0.depositado);
  check("motor=" + (r ? r.dias : null) + " días  fórmula cerrada=" + closed, r && r.dias === closed);
  const r2 = sandbox.diasParaMetaConAportes(B0.balanceTotal, meta, {monto:100000,mode:"dia",dia:1,hab:1}, S.compound ? B0.balanceTotal : B0.depositado);
  check("con $100k/mes: " + (r2 ? r2.dias : "no alcanza") + " días (sin aportar: " + closed + ")",
        r2 && r2.dias <= closed);
}

console.log("\n[6] Smoke renderAll (sin errores de runtime, chip sin monto duplicado)");
{
  S.meta = 5000000; S.metaName = "Casa"; S.aporteExtra = {monto:100000, mode:"dia", dia:1, hab:1};
  let ok = true, err = null;
  try{ sandbox.renderAll(); }catch(e){ ok = false; err = e; }
  check("renderAll() sin excepciones", ok, err && (err.stack || err));
  const chip = els["todayChip"] && els["todayChip"]._text || "";
  check("chip = \"" + chip + "\"", chip.includes("📅"));
  check("chip NO repite el monto del historial", !chip.includes("hoy: +"));
  const pr = els["projResult"] && (els["projResult"]._html || els["projResult"]._text) || "";
  check("proyección renderizada", pr.length > 20, pr);
  const gr = els["goalResult"] && (els["goalResult"]._html || els["goalResult"]._text) || "";
  check("meta renderizada con aporte extra", gr.includes("días"), gr.slice(0,120));
}

console.log("\n[7] Sin reinvertir: los puntos de entrada sin timeline (btnProj, metaInput, refAporte…) usan base = solo aportes");
{
  S.compound = false;
  S.meta = 2000000; S.metaName = "";
  S.aporteExtra = {monto:100000, mode:"dia", dia:1, hab:1};
  const B0 = sandbox.buildTimeline(S.contributions, 40, sandbox.hoyISO());
  const current = B0.balanceTotal;
  const dep = B0.depositado;

  // Envuelve el motor real (mismo ámbito léxico) para observar qué base le pasan los render.
  vm.runInContext("(() => { globalThis.__realPF = proyectarFuturo; globalThis.__realDM = diasParaMetaConAportes; globalThis.__seen = { pf: [], dm: [] }; proyectarFuturo = function(c,n,a,b){ __seen.pf.push(b); return __realPF(c,n,a,b); }; diasParaMetaConAportes = function(c,m,a,b){ __seen.dm.push(b); return __realDM(c,m,a,b); }; })();", sandbox);

  els["projDays"].value = "30";
  sandbox.renderProjection(current); // sin tl — igual que btnProj / projDays / data-pd / refAporte
  sandbox.renderGoal(current);       // sin tl — igual que metaInput / metaName / refAporte

  const seen = sandbox.__seen;
  check("renderProjection sin tl → base0 = solo aportes (" + dep + ")", seen.pf.length > 0 && seen.pf.every(b => b === dep), JSON.stringify(seen.pf));
  check("renderGoal sin tl → base0 = solo aportes (llamadas: " + seen.dm.length + ")", seen.dm.length > 0 && seen.dm.every(b => b === dep), JSON.stringify(seen.dm));
  const gr = els["goalResult"] && (els["goalResult"]._html || els["goalResult"]._text) || "";
  check("meta sin-reinvertir renderizada con días", gr.includes("días"), gr.slice(0,160));

  // Restaura los motores originales y el modo compound.
  S.compound = true;
  vm.runInContext("proyectarFuturo = __realPF; diasParaMetaConAportes = __realDM;", sandbox);
}

// ============================ Verificaciones de nuevas features ============================

console.log("\n[8] Retiros: el balance tracked baja exactamente el monto (retiro del último día) y la base se achica (retiro intermedio)");
{
  const H = sandbox.hoyISO();
  const tlNoRet = sandbox.buildTimeline(S.contributions, 40, H);
  // Retiro el MISMO último día: el interés de ese día se calcula antes del retiro → resta exacto.
  S.retiros = [{ id:"r1", date: H, amount: 100000, note:"" }];
  const tlRet = sandbox.buildTimeline(S.contributions, 40, H);
  check("retiro del último día: balance = " + tlRet.balanceTotal.toFixed(2) + " (esperado " + (tlNoRet.balanceTotal - 100000).toFixed(2) + ")",
        near(tlRet.balanceTotal, tlNoRet.balanceTotal - 100000, 1e-9),
        "diferencia: " + (tlRet.balanceTotal - (tlNoRet.balanceTotal - 100000)).toFixed(4));
  check("tl.retirosTotal = 100000", tlRet.retirosTotal === 100000);
  check("fila de retiro presente en el timeline", tlRet.filas.some(f => f.tipo === "retiro" && f.iso === H && f.retiro === 100000));
  // Retiro intermedio: la base de interés se achica → se pierde interés respecto del caso sin retiro.
  S.retiros = [{ id:"r1", date: "2026-09-20", amount: 100000, note:"" }];
  const tlRetMid = sandbox.buildTimeline(S.contributions, 40, H);
  const lostMax = (tlNoRet.balanceTotal - tlNoRet.depositado); // todo el interés que habría generado
  check("retiro intermedio baja más que el monto (perdida de interés): " + tlRetMid.balanceTotal.toFixed(2) + " < " + (tlNoRet.balanceTotal - 100000).toFixed(2),
        tlRetMid.balanceTotal < tlNoRet.balanceTotal - 100000 - 1e-6);
  check("y no baja más que monto + todo el interés: > " + (tlNoRet.balanceTotal - 100000 - lostMax).toFixed(2),
        tlRetMid.balanceTotal > tlNoRet.balanceTotal - 100000 - lostMax - 1);
  // baseDeInteresHoy (sin reinversión) = aportes netos
  const base = sandbox.baseDeInteresHoy();
  check("baseDeInteresHoy() = 400000 (500k - 100k retirado), fue " + base.toFixed(2), near(base, 400000, 1e-9));
  S.retiros = [];
}

console.log("\n[9] Historial de tasas: el interés se calcula con la tasa que regía en cada época");
{
  S.compound = true;
  // Aporte 100k el lunes 2026-08-03; cambio de tasa el martes 2026-08-04 (40 → 20 TNA).
  const contribs = [{ id:"t1", date:"2026-08-03", amount:100000, note:"" }];
  S.tasaHist = [];
  const tlSin = sandbox.buildTimeline(contribs, 40, "2026-08-04");
  const d40 = sandbox.dailyRate(40, "TNA");
  check("sin hist: interés 2026-08-04 = 100000*d(40%) = " + (100000*d40).toFixed(2) + ", fue " + tlSin.filas.find(f=>f.tipo==="interes").interes.toFixed(2),
        near(tlSin.filas.find(f=>f.tipo==="interes").interes, 100000*d40, 1e-9));
  S.tasaHist = [{ desde:"2026-08-04", tasa:20 }];
  const tlHist = sandbox.buildTimeline(contribs, 40, "2026-08-04");
  const d20 = sandbox.dailyRate(20, "TNA");
  check("con hist: interés del 2026-08-04 usa 20% → " + (100000*d20).toFixed(2) + ", fue " + tlHist.filas.find(f=>f.tipo==="interes").interes.toFixed(2),
        near(tlHist.filas.find(f=>f.tipo==="interes").interes, 100000*d20, 1e-9));
  check("tasaParaFecha respeta el corte: 2026-08-03→40, 2026-08-04→20",
        sandbox.tasaParaFecha("2026-08-03") === 40 && sandbox.tasaParaFecha("2026-08-04") === 20);
  // Dos épocas en una racha: el producto de tasas diarias ≠ (1+d)^n con una sola tasa.
  // sáb 8 y dom 9 rinden al 20%, el lun 10 vuelve al 40% (cambio de regreso).
  S.tasaHist = [{ desde:"2026-08-08", tasa:20 }, { desde:"2026-08-10", tasa:40 }];
  const tlRacha = sandbox.buildTimeline(contribs, 40, "2026-08-10");
  const f = tlRacha.filas.find(x => x.tipo === "interes" && x.iso === "2026-08-10");
  // Base entrante del lunes = 100000 capitalizado 4 días hábiles al 40% (compound).
  const baseLun = 100000 * Math.pow(1 + d40, 4);
  const prod3 = (1 + d20) * (1 + d20) * (1 + d40);
  const esperado = baseLun * (prod3 - 1);
  check("racha con cambio de tasa en el medio (lun 10): esperado " + esperado.toFixed(2) + ", fue " + (f ? f.interes.toFixed(2) : "N/A"),
        f && near(f.interes, esperado, 1e-9));
  check("tasaDia mostrada = raíz cúbica del producto: fue " + (f ? (f.tasaDia*100).toFixed(4) + "%" : "N/A"),
        f && near(f.tasaDia, Math.pow(prod3, 1/3) - 1, 1e-9));
  S.tasaHist = [];
}

console.log("\n[10] Inflación (IPC): la meta crece y la fecha de llegada se atrasa");
{
  const H = sandbox.hoyISO();
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  const meta = B0.balanceTotal * 2;
  S.inflacionMensual = 0;
  const r0 = sandbox.diasParaMetaConAportes(B0.balanceTotal, meta, {monto:0,mode:"dia",dia:1,hab:1}, B0.balanceTotal);
  // IPC 1,5%/mes (19,6% anual) < rendimiento anual del fondo (~40%) → la meta se alcanza, más tarde.
  S.inflacionMensual = 1.5;
  const r3 = sandbox.diasParaMetaConAportes(B0.balanceTotal, meta, {monto:0,mode:"dia",dia:1,hab:1}, B0.balanceTotal);
  check("sin IPC: " + (r0 ? r0.dias : null) + " días · con IPC 1,5%: " + (r3 ? r3.dias : null) + " días (debe ser mayor)",
        r0 && r3 && r3.dias > r0.dias);
  const factorEsperado = Math.pow(1.015, r3.dias / 30.44);
  check("metaAjustada = meta * (1.015)^(dias/30.44): esperado " + (meta*factorEsperado).toFixed(0) + ", fue " + (r3.metaAjustada||0).toFixed(0),
        near(r3.metaAjustada, meta*factorEsperado, 1e-9));
  // Con IPC tan alta que supera el rendimiento anual efectivo (~49%): no se alcanza → null (y la UI lo dice).
  S.inflacionMensual = 4;
  const rNula = sandbox.diasParaMetaConAportes(B0.balanceTotal, meta, {monto:0,mode:"dia",dia:1,hab:1}, B0.balanceTotal);
  check("IPC 4%/mes > rendimiento: no se alcanza → null", rNula === null);
  S.inflacionMensual = 0;
}

console.log("\n[11] proyectarFuturo devuelve la serie de puntos (para la gráfica)");
{
  const H = sandbox.hoyISO();
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  const p = sandbox.proyectarFuturo(B0.balanceTotal, 30, {monto:50000,mode:"dia",dia:1,hab:1}, B0.balanceTotal);
  check("puntos.length = 30", p.puntos && p.puntos.length === 30);
  check("primer punto = mañana (" + (p.puntos && p.puntos[0].date) + ")", p.puntos && p.puntos[0].date === sandbox.addDiasISO(H, 1));
  check("serie monótona no decreciente (compound)", p.puntos.every((q,i,a)=> i === 0 || a[i-1].balance <= q.balance + 1e-9));
}

console.log("\n[12] Agrupación del historial por mes (modo 'por mes')");
{
  const H = sandbox.hoyISO();
  const tl = sandbox.buildTimeline(S.contributions, 40, H);
  const groups = {};
  for(const f of tl.filas){
    const mm = f.iso.slice(0,7);
    if(!groups[mm]) groups[mm] = { ap:0, ret:0, ini:0, n:0 };
    if(f.tipo === "aporte") groups[mm].ap += f.aporte;
    else if(f.tipo === "retiro") groups[mm].ret += f.retiro;
    else groups[mm].ini += f.interes;
    groups[mm].n++;
  }
  const apTot = Object.values(groups).reduce((s,g)=>s+g.ap,0);
  const iniTot = Object.values(groups).reduce((s,g)=>s+g.ini,0);
  const nTot = Object.values(groups).reduce((s,g)=>s+g.n,0);
  check("sumas por mes = totales del timeline (aportes " + apTot + " / interés " + iniTot.toFixed(2) + " / filas " + nTot + ")",
        near(apTot, tl.depositado) && near(iniTot, tl.balanceTotal - tl.depositado + tl.retirosTotal, 1e-6) && nTot === tl.filas.length);
  check("más de un mes presente (hay qué agrupar): " + Object.keys(groups).length, Object.keys(groups).length >= 2);
}

console.log("\n[13] REGRESIÓN: aporte mensual en DÍA HÁBIL (caso real: día hábil 4, $1,2M, 365 días)");
{
  S.compound = true;
  const H = sandbox.hoyISO();
  const N = 365;
  const hasta = sandbox.addDiasISO(H, N);
  const aportes = { monto: 1200000, mode: "habil", hab: 4 };
  // Replicar el motor: qué fechas son el 4° día hábil de cada mes dentro del horizonte.
  const extras = [];
  {
    const d0 = new Date(H + "T12:00:00");
    const d1 = new Date(hasta + "T12:00:00");
    for(let y = d0.getFullYear(); y <= d1.getFullYear(); y++){
      for(let m = 1; m <= 12; m++){
        const dim = new Date(y, m, 0).getDate();
        let cnt = 0;
        for(let d = 1; d <= dim; d++){
          const iso = y + "-" + String(m).padStart(2,"0") + "-" + String(d).padStart(2,"0");
          if(sandbox.esDiaHabil(iso)){
            cnt++;
            if(cnt === 4){
              if(iso > H && iso <= hasta) extras.push({ id:"x"+y+m, date:iso, amount:1200000, note:"sim" });
              break;
            }
          }
        }
      }
    }
  }
  const B0 = sandbox.buildTimeline(S.contributions, 40, H);
  const hist = sandbox.buildTimeline([...S.contributions, ...extras], 40, hasta);
  const proj = sandbox.proyectarFuturo(B0.balanceTotal, N, aportes, B0.balanceTotal);
  check("nAportes = " + proj.nAportes + " (esperado " + extras.length + ")", proj.nAportes === extras.length);
  check("invariante: saldo final >= saldo hoy + total aportado (" + proj.balance.toFixed(2) + " >= " + (B0.balanceTotal + proj.aporteTotal).toFixed(2) + ")",
        proj.balance >= B0.balanceTotal + proj.aporteTotal - 1e-9);
  check("proyección == historial con esos aportes reales: hist=" + hist.balanceTotal.toFixed(2) + " proj=" + proj.balance.toFixed(2),
        near(proj.balance, hist.balanceTotal),
        "diferencia: " + (proj.balance - hist.balanceTotal).toFixed(4));
  // Idem para el motor de meta: la fecha con aportes debe ser alcanzable y consistente.
  const meta = B0.balanceTotal + proj.aporteTotal + 100000; // apenas por encima → debe alcanzarse
  const rMeta = sandbox.diasParaMetaConAportes(B0.balanceTotal, meta, aportes, B0.balanceTotal);
  check("meta apenas por encima de (hoy + aportes): se alcanza en " + (rMeta ? rMeta.dias : null) + " días", rMeta !== null);
}

console.log(fails === 0 ? "\n🟢 TODAS LAS VERIFICACIONES PASARON" : "\n🔴 " + fails + " verificación(es) fallaron");
process.exit(fails === 0 ? 0 : 1);
