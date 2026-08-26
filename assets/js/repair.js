(function(){
'use strict';

var editingId=null;

function byId(id){return document.getElementById(id);}
function escHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
function num(id){return Number(byId(id).value||0);}
function text(id){return byId(id).value.trim();}
function ensureRepairs(){
  if(!window.db)throw new Error('Database is not loaded');
  if(!Array.isArray(window.db.repairs))window.db.repairs=[];
  return window.db.repairs;
}
function calcBalance(){
  var total=num('rTotal'),deposit=num('rDeposit');
  var bal=Math.max(0,total-deposit);
  byId('rBalance').value=bal.toFixed(2);
  return bal;
}
function clearForm(){
  editingId=null;
  ['rCustomer','rPhone','rDevice','rImei','rIssue','rDiagnosis','rTech','rParts','rPartsCost','rTotal','rDeposit'].forEach(function(id){byId(id).value='';});
  byId('rStatus').value='Received';
  byId('rBalance').value='0.00';
  byId('formTitle').textContent='New Repair';
  byId('saveRepairBtn').textContent='Save Repair';
}
function getRepair(id){return ensureRepairs().find(function(r){return r.id===id;})||null;}
function saveRepair(){
  var customer=text('rCustomer'),phone=text('rPhone'),device=text('rDevice'),issue=text('rIssue');
  if(!customer||!phone||!device||!issue){alert('Customer, phone, device and repair issue are required.');return;}
  var repairs=ensureRepairs();
  var existing=editingId?getRepair(editingId):null;
  var now=new Date().toISOString();
  var record={
    id:existing?existing.id:'R'+Date.now(),
    createdAt:existing?existing.createdAt:now,
    updatedAt:now,
    customer:customer,phone:phone,device:device,imei:text('rImei'),
    issue:issue,diagnosis:text('rDiagnosis'),technician:text('rTech'),parts:text('rParts'),
    partsCost:num('rPartsCost'),total:num('rTotal'),deposit:num('rDeposit'),balance:calcBalance(),
    status:byId('rStatus').value,
    paidAt:existing?existing.paidAt:null,
    saleId:existing?existing.saleId:null
  };
  if(existing){
    var idx=repairs.findIndex(function(r){return r.id===editingId;});
    repairs[idx]=record;
  }else repairs.unshift(record);
  saveDB(window.db);
  clearForm();
  renderRepairs();
}
function editRepair(id){
  var r=getRepair(id);if(!r)return;
  editingId=id;
  byId('rCustomer').value=r.customer||'';byId('rPhone').value=r.phone||'';byId('rDevice').value=r.device||'';byId('rImei').value=r.imei||'';
  byId('rIssue').value=r.issue||'';byId('rDiagnosis').value=r.diagnosis||'';byId('rTech').value=r.technician||'';byId('rParts').value=r.parts||'';
  byId('rPartsCost').value=Number(r.partsCost||0);byId('rTotal').value=Number(r.total||0);byId('rDeposit').value=Number(r.deposit||0);byId('rBalance').value=Number(r.balance||0).toFixed(2);
  byId('rStatus').value=r.status||'Received';
  byId('formTitle').textContent='Edit '+r.id;byId('saveRepairBtn').textContent='Update Repair';
  window.scrollTo({top:0,behavior:'smooth'});
}
function deleteRepair(id){
  var r=getRepair(id);if(!r)return;
  if(!confirm('Delete repair '+id+' for '+r.customer+'?'))return;
  window.db.repairs=ensureRepairs().filter(function(x){return x.id!==id;});
  saveDB(window.db);renderRepairs();
}
function sendToPOS(id){
  var r=getRepair(id);if(!r)return;
  var balance=Math.max(0,Number(r.total||0)-Number(r.deposit||0));
  if(balance<=0){alert('This repair has no balance due.');return;}
  var payload={
    repairId:r.id,
    customer:{name:r.customer,phone:r.phone},
    line:{
      id:'REPAIR:'+r.id,
      repairId:r.id,
      name:'Repair - '+r.device+(r.customer?' - '+r.customer:''),
      category:'Repair',
      cost:Number(r.partsCost||0),
      price:balance,
      qty:1,
      imei:r.imei||'',
      isRepair:true
    }
  };
  localStorage.setItem('mw_pos_prefill',JSON.stringify(payload));
  r.status='Ready for Pickup';r.updatedAt=new Date().toISOString();saveDB(window.db);
  location.href='pos.html?repair='+encodeURIComponent(r.id);
}
function statusBadge(status){
  var cls='st-received';
  if(status==='In Progress')cls='st-progress';
  else if(status==='Waiting for Parts')cls='st-wait';
  else if(status==='Ready for Pickup')cls='st-ready';
  else if(status==='Completed'||status==='Paid')cls='st-done';
  return '<span class="status '+cls+'">'+escHtml(status)+'</span>';
}
function renderRepairs(){
  var q=(byId('repairSearch').value||'').toLowerCase().trim();
  var rows=ensureRepairs().filter(function(r){
    if(!q)return true;
    return [r.id,r.customer,r.phone,r.device,r.imei,r.issue,r.status,r.technician].some(function(v){return String(v||'').toLowerCase().indexOf(q)!==-1;});
  });
  byId('repairCount').textContent=rows.length+' repair'+(rows.length===1?'':'s');
  byId('repairRows').innerHTML=rows.length?rows.map(function(r){
    var bal=Math.max(0,Number(r.total||0)-Number(r.deposit||0));
    return '<tr><td><b>'+escHtml(r.id)+'</b><br><small>'+new Date(r.createdAt).toLocaleDateString()+'</small></td>'+
      '<td><b>'+escHtml(r.customer)+'</b><br><small>'+escHtml(r.phone)+'</small></td>'+
      '<td>'+escHtml(r.device)+(r.imei?'<br><small>IMEI/SN: '+escHtml(r.imei)+'</small>':'')+'</td>'+
      '<td>'+escHtml(r.issue)+'</td><td>'+statusBadge(r.status)+'</td>'+
      '<td>'+money(r.total)+'<br><small>Due: <b>'+money(bal)+'</b></small></td>'+
      '<td class="actions"><button onclick="editRepair(\''+r.id+'\')">Edit</button>'+
      (bal>0&&r.status!=='Completed'&&r.status!=='Paid'?'<button class="pay" onclick="sendToPOS(\''+r.id+'\')">Send to POS</button>':'')+
      '<button class="danger" onclick="deleteRepair(\''+r.id+'\')">Delete</button></td></tr>';
  }).join(''):'<tr><td colspan="7" class="empty">No repair jobs found.</td></tr>';
}
async function initRepairs(){
  window.db=await loadSeed();
  ensureRepairs();
  saveDB(window.db);
  ['rTotal','rDeposit'].forEach(function(id){byId(id).addEventListener('input',calcBalance);});
  renderRepairs();
}

window.initRepairs=initRepairs;
window.saveRepair=saveRepair;
window.editRepair=editRepair;
window.deleteRepair=deleteRepair;
window.sendToPOS=sendToPOS;
window.renderRepairs=renderRepairs;
window.clearRepairForm=clearForm;
})();
