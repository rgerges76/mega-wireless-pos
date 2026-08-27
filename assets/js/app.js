const DBKEY='mw_platform_v1';
const LEGACY={inv:'mw_inv',sales:'mw_sales',repairs:'mw_repairs',cust:'mw_cust',cfg:'mw_cfg'};

function money(n){return '$'+Number(n||0).toFixed(2)}
function $(id){return document.getElementById(id)}
function readJSON(key,def){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):def}catch(e){return def}}
function writeJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true}catch(e){console.error('Storage write failed',key,e);return false}}
function normText(v){return String(v==null?'':v).trim().toLowerCase()}
function uid(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

function normalizeDB(db){
  db=(db&&typeof db==='object')?db:{};
  db.settings=(db.settings&&typeof db.settings==='object')?db.settings:{};
  if(!db.settings.storeName)db.settings.storeName='Mega Wireless Nashville';
  if(!db.settings.phone)db.settings.phone='615-678-5849';
  if(!Number.isFinite(Number(db.settings.taxRate)))db.settings.taxRate=9.75;
  if(!Number.isFinite(Number(db.settings.lowStock)))db.settings.lowStock=5;
  ['products','websiteDeals','plans','rewards','rewardTiers','sales','repairs'].forEach(k=>{if(!Array.isArray(db[k]))db[k]=[]});
  db.products=db.products.map((p,i)=>({
    id:p.id||p.sku||('P'+i),sku:p.sku||p.id||('P'+i),name:String(p.name||'Unnamed Product'),category:String(p.category||'Accessories'),brand:String(p.brand||''),barcode:String(p.barcode||p.bc||''),imei:String(p.imei||''),imeis:Array.isArray(p.imeis)?p.imeis:[],cost:Number(p.cost||0),price:Number(p.price??p.sell??0),qty:Number(p.qty||0),minQty:Number(p.minQty??db.settings.lowStock??5),showOnline:!!p.showOnline
  }));
  return db;
}

function mergeLegacyInventory(db){
  const legacy=readJSON(LEGACY.inv,{});
  if(!legacy||typeof legacy!=='object'||Array.isArray(legacy))return false;
  let changed=false;
  const byExact=new Map();
  const byName=new Map();
  db.products.forEach(p=>{
    byExact.set(normText(p.category)+'::'+normText(p.name),p);
    if(!byName.has(normText(p.name)))byName.set(normText(p.name),p);
  });
  Object.keys(legacy).forEach(key=>{
    const d=legacy[key];
    if(!d||typeof d!=='object')return;
    const sep=key.indexOf('::');
    const cat=sep>=0?key.slice(0,sep):'Accessories';
    const name=sep>=0?key.slice(sep+2):key;
    if(!name||normText(cat)==='repair')return;
    let p=byExact.get(normText(cat)+'::'+normText(name))||byName.get(normText(name));
    if(!p){
      p={id:uid('LEG-'),sku:String(d.sku||''),name,category:cat,brand:'',barcode:String(d.bc||''),imei:'',imeis:Array.isArray(d.imeis)?d.imeis.slice():[],cost:Number(d.cost||0),price:Number(d.sell||0),qty:Number(d.qty||0),minQty:Number(db.settings.lowStock||5),showOnline:false};
      db.products.push(p);byExact.set(normText(cat)+'::'+normText(name),p);byName.set(normText(name),p);changed=true;return;
    }
    const cost=Number(d.cost||0),price=Number(d.sell||0),qty=Number(d.qty||0);
    if(cost&&Number(p.cost||0)!==cost){p.cost=cost;changed=true}
    if(price&&Number(p.price||0)!==price){p.price=price;changed=true}
    if((qty||Number(p.qty||0)===0)&&Number(p.qty||0)!==qty){p.qty=qty;changed=true}
    if(d.bc&&!p.barcode){p.barcode=String(d.bc);changed=true}
    if(d.sku&&!p.sku){p.sku=String(d.sku);changed=true}
    if(Array.isArray(d.imeis)&&d.imeis.length){p.imeis=d.imeis.slice();p.qty=d.imeis.length;changed=true}
  });
  return changed;
}

function mapLegacySale(s){
  const oldId=String(s.id??s.inv??s.time??uid('OLD-'));
  return {id:'LEGACY:'+oldId,legacyId:oldId,invoice:s.inv||'',date:s.time||s.date||new Date().toISOString(),cashier:s.cashier||'',items:(s.items||[]).map(x=>({id:'',name:x.n||x.name||'',category:x.c||x.category||'',qty:Number(x.qty||1),price:Number(x.price||0),imei:x.imei||''})),subtotal:Number(s.sub??s.subtotal??0),discount:Number(s.disc||0),tax:Number(s.tax||0),total:Number(s.grand??s.total??0),cost:Number(s.cogs??s.cost??0),payment:s.pay||s.payment||'',customer:s.cust||null,voided:!!s.voided};
}

function mergeLegacySales(db){
  const legacy=readJSON(LEGACY.sales,[]);
  if(!Array.isArray(legacy))return false;
  const known=new Set(db.sales.map(s=>String(s.legacyId??s.bridgeId??s.id??'')));
  let changed=false;
  legacy.forEach(s=>{
    const key=String(s.bridgeId??s.id??s.inv??s.time??'');
    if(!key||known.has(key)||known.has('LEGACY:'+key))return;
    const mapped=mapLegacySale(s);db.sales.push(mapped);known.add(mapped.legacyId);changed=true;
  });
  return changed;
}

function mergeLegacyRepairs(db){
  const legacy=readJSON(LEGACY.repairs,[]);
  if(!Array.isArray(legacy))return false;
  const map=new Map(db.repairs.map(r=>[String(r.id),r]));
  let changed=false;
  legacy.forEach(r=>{
    if(!r||!r.id)return;
    const cur=map.get(String(r.id));
    if(!cur){db.repairs.push({...r});map.set(String(r.id),db.repairs[db.repairs.length-1]);changed=true;return}
    const a=Date.parse(cur.updatedAt||cur.createdAt||0)||0,b=Date.parse(r.updatedAt||r.createdAt||0)||0;
    if(b>a){Object.assign(cur,r);changed=true}
  });
  return changed;
}

function applyRepairPaymentsFromLegacySales(db){
  const legacy=readJSON(LEGACY.sales,[]);
  if(!Array.isArray(legacy)||!db.repairs.length)return false;
  let changed=false;
  legacy.forEach(s=>{
    if(s.voided)return;
    (s.items||[]).forEach(it=>{
      if(normText(it.c||it.category)!=='repair')return;
      const name=String(it.n||it.name||'');
      const m=name.match(/\[(R[^\]]+)\]/i)||name.match(/\b(R\d{6,})\b/i);
      if(!m)return;
      const r=db.repairs.find(x=>String(x.id).toLowerCase()===String(m[1]).toLowerCase());
      if(!r)return;
      if(r.status!=='Completed'&&r.status!=='Paid'){r.status='Completed';changed=true}
      if(Number(r.balance||0)!==0){r.balance=0;changed=true}
      if(Number(r.deposit||0)<Number(r.total||0)){r.deposit=Number(r.total||0);changed=true}
      if(!r.paidAt){r.paidAt=s.time||s.date||new Date().toISOString();changed=true}
      if(!r.saleId){r.saleId=s.inv||s.id||null;changed=true}
      r.updatedAt=new Date().toISOString();
    });
  });
  return changed;
}

function mergeLegacySettings(db){
  const cfg=readJSON(LEGACY.cfg,{});let changed=false;
  if(cfg&&typeof cfg==='object'&&Number(cfg.tax)>0&&Number(db.settings.taxRate)!==Number(cfg.tax)){db.settings.taxRate=Number(cfg.tax);changed=true}
  return changed;
}

function mergeLegacy(db){
  let changed=false;
  if(mergeLegacyInventory(db))changed=true;
  if(mergeLegacySales(db))changed=true;
  if(mergeLegacyRepairs(db))changed=true;
  if(applyRepairPaymentsFromLegacySales(db))changed=true;
  if(mergeLegacySettings(db))changed=true;
  return changed;
}

function syncLegacyInventory(db){
  const inv=readJSON(LEGACY.inv,{});const out=(inv&&typeof inv==='object'&&!Array.isArray(inv))?inv:{};
  const cust=readJSON(LEGACY.cust,{});const cats=(cust&&typeof cust==='object'&&!Array.isArray(cust))?cust:{};
  db.products.forEach(p=>{
    if(!p.name||normText(p.category)==='repair')return;
    const key=(p.category||'Accessories')+'::'+p.name;
    const prev=out[key]||{};
    out[key]={...prev,sku:p.sku||prev.sku||'',bc:p.barcode||prev.bc||'',cost:Number(p.cost||0),sell:Number(p.price||0),qty:Number(p.qty||0),imeis:Array.isArray(p.imeis)?p.imeis:(Array.isArray(prev.imeis)?prev.imeis:[])};
    const cat=p.category||'Accessories';if(!Array.isArray(cats[cat]))cats[cat]=[];if(!cats[cat].includes(p.name))cats[cat].push(p.name);
  });
  writeJSON(LEGACY.inv,out);writeJSON(LEGACY.cust,cats);
}

function syncLegacySales(db){
  const old=readJSON(LEGACY.sales,[]);const arr=Array.isArray(old)?old:[];
  const known=new Set(arr.map(s=>String(s.bridgeId??s.id??s.inv??'')));
  db.sales.forEach(s=>{
    if(s.legacyId)return;
    const key=String(s.bridgeId??s.id??'');if(!key||known.has(key))return;
    arr.push({id:s.id,bridgeId:s.id,inv:s.invoice||s.id,time:s.date||new Date().toISOString(),cashier:s.cashier||'POS',items:(s.items||[]).map(x=>({n:x.name||'',c:x.category||'',qty:Number(x.qty||1),price:Number(x.price||0),imei:x.imei||''})),sub:Number(s.subtotal||0),disc:Number(s.discount||0),tax:Number(s.tax||0),grand:Number(s.total||0),cogs:Number(s.cost||0),pay:s.payment||'',taxOn:Number(s.tax||0)>0,taxRate:Number(db.settings.taxRate||9.75)/100,cust:s.customer||null,voided:!!s.voided});known.add(key);
  });
  writeJSON(LEGACY.sales,arr);
}

function syncLegacyRepairs(db){writeJSON(LEGACY.repairs,db.repairs||[])}
function syncLegacySettings(db){const cfg=readJSON(LEGACY.cfg,{});const out=(cfg&&typeof cfg==='object')?cfg:{};out.tax=Number(db.settings.taxRate||9.75);writeJSON(LEGACY.cfg,out)}
function syncLegacy(db){syncLegacyInventory(db);syncLegacySales(db);syncLegacyRepairs(db);syncLegacySettings(db)}

function saveDB(db){
  db=normalizeDB(db||window.db||{});window.db=db;writeJSON(DBKEY,db);syncLegacy(db);return db;
}

async function loadSeed(){
  let db=readJSON(DBKEY,null);
  if(!db){
    const r=await fetch('/data/seed.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('Could not load POS data ('+r.status+')');
    db=await r.json();
  }
  db=normalizeDB(db);mergeLegacy(db);saveDB(db);return db;
}

const T={
  en:{services:'Services',deals:'Deals',phones:'Phones',activation:'Activations',gallery:'Gallery',contact:'Contact',hero:'Phone Repair Experts',sub:'Fast repairs. Premium unlocked phones. Easy activations. All in one place at Mega Wireless Nashville.',call:'Call Now',directions:'Get Directions',shop:'Shop Deals',trusted:"Nashville's Trusted Phone Repair Store",fix:'We Fix It All',today:'Today’s Hot Deals',plans:'Prepaid Wireless Plans',plansSub:'No contract • No credit check • Prepaid • Instant activation',rewards:'Mega Rewards',hours:'Store Hours'},
  es:{services:'Servicios',deals:'Ofertas',phones:'Teléfonos',activation:'Activaciones',gallery:'Galería',contact:'Contacto',hero:'Expertos en Reparación',sub:'Reparaciones rápidas. Teléfonos desbloqueados. Activaciones fáciles. Todo en Mega Wireless Nashville.',call:'Llamar',directions:'Cómo llegar',shop:'Ver ofertas',trusted:'Tienda confiable de reparación en Nashville',fix:'Reparamos todo',today:'Ofertas de hoy',plans:'Planes Prepagados',plansSub:'Sin contrato • Sin crédito • Prepagado • Activación rápida',rewards:'Mega Rewards',hours:'Horario'},
  ar:{services:'الخدمات',deals:'العروض',phones:'الهواتف',activation:'الخطوط',gallery:'المعرض',contact:'اتصل بنا',hero:'خبراء صيانة الهواتف',sub:'صيانة سريعة. هواتف مفتوحة. تفعيل خطوط بسهولة. كل شيء في Mega Wireless Nashville.',call:'اتصل الآن',directions:'الاتجاهات',shop:'شاهد العروض',trusted:'محل موثوق لصيانة الهواتف في ناشفيل',fix:'نصلح كل شيء',today:'عروض اليوم',plans:'خطوط مسبقة الدفع',plansSub:'بدون عقد • بدون فحص ائتماني • تفعيل فوري',rewards:'Mega Rewards',hours:'مواعيد العمل'}
};

async function initSite(){const db=await loadSeed();const lang=localStorage.getItem('mw_lang')||'en';renderSite(db,lang);document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{localStorage.setItem('mw_lang',b.dataset.lang);renderSite(db,b.dataset.lang)})}
function renderSite(db,lang){const tr=T[lang]||T.en;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-t]').forEach(el=>el.textContent=tr[el.dataset.t]||el.textContent);document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));if($('dealGrid'))$('dealGrid').innerHTML=(db.websiteDeals||[]).filter(d=>d.showOnline!==false).map(d=>`<div class="card deal"><span class="tag">${d.badge||'Deal'}</span><h3>${d.name}</h3><p class="muted">${d.spec||''}</p><div class="price">${money(d.price)}</div><a class="btn blue" href="tel:${String(db.settings.phone||'').replaceAll('-','')}">${tr.call}</a></div>`).join('');if($('planGrid'))$('planGrid').innerHTML=(db.plans||[]).map(p=>`<div class="card plan"><h3>${p.carrier}</h3><p class="muted">${p.plan}</p><div class="price">${money(p.price)}</div><p class="muted">${p.features}</p></div>`).join('');if($('rewardGrid'))$('rewardGrid').innerHTML=(db.rewards||[]).map(r=>`<div class="card"><h3>${r.action}</h3><p class="muted"><b style="color:var(--gold);font-size:28px">${r.points}</b> points</p></div>`).join('');if($('hoursTbl'))$('hoursTbl').innerHTML='<tr><td>Monday - Friday</td><td>10:00 AM - 9:00 PM</td></tr><tr><td>Saturday</td><td>10:00 AM - 10:00 PM</td></tr><tr><td>Sunday</td><td>10:00 AM - 9:00 PM</td></tr>'}

function adminLogin(){location.href='/admin.html'}
function initAdmin(){location.href='/admin.html'}

async function initPOS(){window.db=await loadSeed();window.cart=[];drawPOS()}
function drawPOS(){const db=window.db;if(!$('products'))return;$('products').innerHTML=db.products.filter(p=>Number(p.price)>0).slice(0,700).map(p=>`<div class="prod" onclick="addCart('${p.id}')"><b>${p.name}</b><small>${p.category}</small><h3>${money(p.price)}</h3><small>Qty: ${Number(p.qty||0)}</small></div>`).join('');drawCart()}
function addCart(id){const p=window.db.products.find(x=>x.id===id);if(!p)return;const line=window.cart.find(x=>x.id===id&&!x.repairId);const inCart=line?Number(line.qty||0):0;const stock=Number(p.qty||0);if(stock<=inCart){alert('No more stock available for '+p.name);return}if(line)line.qty++;else window.cart.push({...p,qty:1});drawCart()}
function changeCartQty(i,d){const line=window.cart[i];if(!line)return;if(d>0&&!line.repairId){const p=window.db.products.find(x=>x.id===line.id);if(p&&Number(line.qty||0)>=Number(p.qty||0)){alert('No more stock available');return}}line.qty=Number(line.qty||0)+d;if(line.qty<=0)window.cart.splice(i,1);drawCart()}
function drawCart(){if(!$('cart'))return;const sub=window.cart.reduce((a,l)=>a+Number(l.price||0)*Number(l.qty||0),0),tax=$('taxOn')?.checked?sub*(Number(window.db.settings.taxRate||0)/100):0,total=sub+tax;$('cart').innerHTML=window.cart.map((l,i)=>`<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #eee;padding:8px 0"><span style="flex:1">${l.name}<br><small>${l.qty} x ${money(l.price)}</small></span><span><button onclick="changeCartQty(${i},-1)">−</button> <button onclick="changeCartQty(${i},1)">+</button> <button onclick="cart.splice(${i},1);drawCart()">x</button></span></div>`).join('')+`<div style="padding-top:10px"><div>Subtotal: <b>${money(sub)}</b></div><div>Tax: <b>${money(tax)}</b></div><h3>Total: ${money(total)}</h3></div>`}
function checkout(payment){const cart=window.cart||[];if(!cart.length)return null;const sub=cart.reduce((a,l)=>a+Number(l.price||0)*Number(l.qty||0),0),cost=cart.reduce((a,l)=>a+Number(l.cost||0)*Number(l.qty||0),0),tax=$('taxOn')?.checked?sub*(Number(window.db.settings.taxRate||0)/100):0,total=sub+tax;for(const l of cart){if(l.repairId)continue;const p=window.db.products.find(x=>x.id===l.id);if(p&&Number(l.qty||0)>Number(p.qty||0)){alert('Not enough stock for '+p.name);return null}}
  const sale={id:'S'+Date.now(),date:new Date().toISOString(),items:cart.map(x=>({...x})),total,subtotal:sub,tax,cost,payment};window.db.sales.push(sale);cart.forEach(l=>{if(l.repairId)return;const p=window.db.products.find(x=>x.id===l.id);if(p)p.qty=Math.max(0,Number(p.qty||0)-Number(l.qty||0))});window.cart=[];saveDB(window.db);drawPOS();alert('Sale saved');return sale}

window.MWData={DBKEY,load:loadSeed,save:saveDB,normalize:normalizeDB,mergeLegacy,syncLegacy,applyRepairPaymentsFromLegacySales,readJSON,writeJSON};
