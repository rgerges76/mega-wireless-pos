(function(){
'use strict';

var editingId=null;
var DBKEY='mw_platform_v1';
var REPAIRS_KEY='mw_repairs';
var SALES_KEY='mw_sales';

function byId(id){return document.getElementById(id)}
function escHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]})}
function money(n){return '$'+Number(n||0).toFixed(2)}
function num(id){return Number(byId(id).value||0)}
function text(id){return byId(id).value.trim()}
function loadJSON(key,def){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):def}catch(e){return def}}
function saveJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val))}catch(e){console.error(e)}}

function loadPlatform(){var db=loadJSON(DBKEY,{});if(!db||typeof db!=='object'||Array.isArray(db))db={};if(!Array.isArray(db.repairs))db.repairs=[];return db}
function mergeRepairLists(a,b){var out=[],map={};[].concat(a||[],b||[]).forEach(function(r){if(!r||!r.id)return;var id=String(r.id);if(!map[id]){map[id]=Object.assign({},r);out.push(map[id]);return}var old=Date.parse(map[id].updatedAt||map[id].createdAt||0)||0,nu=Date.parse(r.updatedAt||r.createdAt||0)||0;if(nu>=old)Object.assign(map[id],r)});return out}
function applyPaidSales(list){var sales=loadJSON(SALES_KEY,[]);if(!Array.isArray(sales))return list;sales.forEach(function(s){if(s&&s.voided)return;(s&&s.items||[]).forEach(function(it){var cat=String(it.c||it.category||'').toLowerCase();if(cat!=='repair')return;var name=String(it.n||it.name||''),m=name.match(/\[(R[^\]]+)\]/i)||name.match(/\b(R\d{6,})\b/i);if(!m)return;var r=list.find(function(x){return String(x.id).toLowerCase()===String(m[1]).toLowerCase()});if(!r)return;r.status='Completed';r.deposit=Number(r.total||0);r.balance=0;r.paidAt=r.paidAt||s.time||s.date||new Date().toISOString();r.saleId=r.saleId||s.inv||s.id||null;r.updatedAt=new Date().toISOString()})});return list}
function ensureRepairs(){var db=loadPlatform(),legacy=loadJSON(REPAIRS_KEY,[]);var list=mergeRepairLists(db.repairs,Array.isArray(legacy)?legacy:[]);return applyPaidSales(list)}
function saveRepairs(list){list=applyPaidSales(Array.isArray(list)?list:[]);var db=loadPlatform();db.repairs=list;saveJSON(DBKEY,db);saveJSON(REPAIRS_KEY,list)}

function calcBalance(){var bal=Math.max(0,num('rTotal')-num('rDeposit'));byId('rBalance').value=bal.toFixed(2);return bal}
function clearForm(){editingId=null;['rCustomer','rPhone','rDevice','rImei','rIssue','rDiagnosis','rTech','rParts','rPartsCost','rTotal','rDeposit'].forEach(function(id){byId(id).value=''});byId('rStatus').value='Received';byId('rBalance').value='0.00';byId('formTitle').textContent='New Repair';byId('saveRepairBtn').textContent='Save Repair'}
function getRepair(id){return ensureRepairs().find(function(r){return r.id===id})||null}

function saveRepair(){
  var customer=text('rCustomer'),phone=text('rPhone'),device=text('rDevice'),issue=text('rIssue');
  if(!customer||!phone||!device||!issue){alert('Customer, phone, device and repair issue are required.');return}
  var repairs=ensureRepairs(),existing=editingId?repairs.find(function(r){return r.id===editingId}):null,now=new Date().toISOString();
  var total=num('rTotal'),deposit=Math.min(num('rDeposit'),total||num('rDeposit'));
  var record={id:existing?existing.id:'R'+Date.now(),createdAt:existing?existing.createdAt:now,updatedAt:now,customer:customer,phone:phone,device:device,imei:text('rImei'),issue:issue,diagnosis:text('rDiagnosis'),technician:text('rTech'),parts:text('rParts'),partsCost:num('rPartsCost'),total:total,deposit:deposit,balance:Math.max(0,total-deposit),status:byId('rStatus').value,paidAt:existing?existing.paidAt:null,saleId:existing?existing.saleId:null};
  if(record.balance===0&&record.total>0&&(record.status==='Ready for Pickup'||record.status==='Completed'||record.status==='Paid'))record.status='Completed';
  if(existing){var idx=repairs.findIndex(function(r){return r.id===editingId});repairs[idx]=record}else repairs.unshift(record);
  saveRepairs(repairs);clearForm();renderRepairs();
}

function editRepair(id){var r=getRepair(id);if(!r)return;editingId=id;byId('rCustomer').value=r.customer||'';byId('rPhone').value=r.phone||'';byId('rDevice').value=r.device||'';byId('rImei').value=r.imei||'';byId('rIssue').value=r.issue||'';byId('rDiagnosis').value=r.diagnosis||'';byId('rTech').value=r.technician||'';byId('rParts').value=r.parts||'';byId('rPartsCost').value=Number(r.partsCost||0);byId('rTotal').value=Number(r.total||0);byId('rDeposit').value=Number(r.deposit||0);byId('rBalance').value=Math.max(0,Number(r.total||0)-Number(r.deposit||0)).toFixed(2);byId('rStatus').value=r.status||'Received';byId('formTitle').textContent='Edit '+r.id;byId('saveRepairBtn').textContent='Update Repair';window.scrollTo({top:0,behavior:'smooth'})}
function deleteRepair(id){var r=getRepair(id);if(!r)return;if(!confirm('Delete repair '+id+' for '+r.customer+'?'))return;saveRepairs(ensureRepairs().filter(function(x){return x.id!==id}));renderRepairs()}

function provisionOldPOSRepair(r,balance){
  var custom=loadJSON('mw_cust',{}),inv=loadJSON('mw_inv',{});
  if(!custom||typeof custom!=='object'||Array.isArray(custom))custom={};if(!inv||typeof inv!=='object'||Array.isArray(inv))inv={};if(!Array.isArray(custom.Repair))custom.Repair=[];
  var itemName='['+r.id+'] '+r.device+' - '+r.customer;
  if(custom.Repair.indexOf(itemName)===-1)custom.Repair.unshift(itemName);
  inv['Repair::'+itemName]={sku:r.id,bc:r.imei||'',cost:Number(r.partsCost||0),sell:Number(balance||0),qty:1,imeis:[]};
  saveJSON('mw_cust',custom);saveJSON('mw_inv',inv);saveJSON('mw_repair_pos_context',{repairId:r.id,itemName:itemName,customer:r.customer,phone:r.phone,createdAt:new Date().toISOString()});
}
function provisionNewPOSRepair(r,balance){var payload={repairId:r.id,customer:{name:r.customer,phone:r.phone},line:{id:'REPAIR:'+r.id,repairId:r.id,name:'Repair - '+r.device+' - '+r.customer,category:'Repair',cost:Number(r.partsCost||0),price:Number(balance||0),qty:1,imei:r.imei||'',isRepair:true}};localStorage.setItem('mw_pos_prefill',JSON.stringify(payload))}
function sendToPOS(id){var repairs=ensureRepairs(),r=repairs.find(function(x){return x.id===id});if(!r)return;var balance=Math.max(0,Number(r.total||0)-Number(r.deposit||0));if(balance<=0){alert('This repair has no balance due.');return}provisionOldPOSRepair(r,balance);provisionNewPOSRepair(r,balance);r.status='Ready for Pickup';r.updatedAt=new Date().toISOString();saveRepairs(repairs);location.href='pos.html'}

function statusBadge(status){var cls='st-received';if(status==='In Progress')cls='st-progress';else if(status==='Waiting for Parts')cls='st-wait';else if(status==='Ready for Pickup')cls='st-ready';else if(status==='Completed'||status==='Paid')cls='st-done';return '<span class="status '+cls+'">'+escHtml(status)+'</span>'}
function renderRepairs(){var q=(byId('repairSearch').value||'').toLowerCase().trim(),all=ensureRepairs();saveRepairs(all);var rows=all.filter(function(r){if(!q)return true;return [r.id,r.customer,r.phone,r.device,r.imei,r.issue,r.status,r.technician].some(function(v){return String(v||'').toLowerCase().indexOf(q)!==-1})});byId('repairCount').textContent=rows.length+' repair'+(rows.length===1?'':'s');byId('repairRows').innerHTML=rows.length?rows.map(function(r){var bal=Math.max(0,Number(r.total||0)-Number(r.deposit||0));return '<tr><td><b>'+escHtml(r.id)+'</b><br><small>'+new Date(r.createdAt).toLocaleDateString()+'</small></td><td><b>'+escHtml(r.customer)+'</b><br><small>'+escHtml(r.phone)+'</small></td><td>'+escHtml(r.device)+(r.imei?'<br><small>IMEI/SN: '+escHtml(r.imei)+'</small>':'')+'</td><td>'+escHtml(r.issue)+'</td><td>'+statusBadge(r.status)+'</td><td>'+money(r.total)+'<br><small>Due: <b>'+money(bal)+'</b></small></td><td class="actions"><button onclick="editRepair(\''+r.id+'\')">Edit</button>'+(bal>0&&r.status!=='Completed'&&r.status!=='Paid'?'<button class="pay" onclick="sendToPOS(\''+r.id+'\')">Send to POS</button>':'')+'<button class="danger" onclick="deleteRepair(\''+r.id+'\')">Delete</button></td></tr>'}).join(''):'<tr><td colspan="7" class="empty">No repair jobs found.</td></tr>'}
function initRepairs(){['rTotal','rDeposit'].forEach(function(id){byId(id).addEventListener('input',calcBalance)});renderRepairs()}

window.initRepairs=initRepairs;window.saveRepair=saveRepair;window.editRepair=editRepair;window.deleteRepair=deleteRepair;window.sendToPOS=sendToPOS;window.renderRepairs=renderRepairs;window.clearRepairForm=clearForm;
})();
