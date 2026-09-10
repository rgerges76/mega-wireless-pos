(function(){
'use strict';

var ENDPOINT='/.netlify/functions/klaviyo-event';
var REPAIRS_KEY='mw_repairs';
var DBKEY='mw_platform_v1';

function byId(id){return document.getElementById(id)}
function loadJSON(key,def){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):def}catch(e){return def}}
function saveJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val))}catch(e){console.error(e)}}
function text(id){var el=byId(id);return el?String(el.value||'').trim():''}

function configureSmsUi(){
  var email=byId('rEmail');
  if(email&&email.parentElement)email.parentElement.style.display='none';

  var optIn=byId('rMarketingOptIn');
  if(optIn){
    var span=optIn.parentElement&&optIn.parentElement.querySelector('span');
    if(span)span.innerHTML='<strong>SMS offers opt-in.</strong> Customer agrees to receive occasional Mega Wireless promotional text messages at the phone number above. Consent is optional and not required for repair service. Leave unchecked unless the customer explicitly agrees. Message/data rates may apply. Reply STOP to opt out.';
  }
}

function patchRepair(id,smsMarketingOptIn){
  if(!id)return null;
  var list=loadJSON(REPAIRS_KEY,[]);
  if(!Array.isArray(list))list=[];
  var record=list.find(function(r){return String(r&&r.id||'')===String(id)});
  if(record){
    record.smsMarketingOptIn=smsMarketingOptIn===true;
    saveJSON(REPAIRS_KEY,list);
  }

  var db=loadJSON(DBKEY,{});
  if(db&&Array.isArray(db.repairs)){
    var platformRecord=db.repairs.find(function(r){return String(r&&r.id||'')===String(id)});
    if(platformRecord){
      platformRecord.smsMarketingOptIn=smsMarketingOptIn===true;
      saveJSON(DBKEY,db);
      record=platformRecord;
    }
  }
  return record||null;
}

function findLatestRepair(customer,phone,device){
  var list=loadJSON(REPAIRS_KEY,[]);
  if(!Array.isArray(list))return null;
  return list.slice().sort(function(a,b){return String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))}).find(function(r){
    return String(r.customer||'')===customer&&String(r.phone||'')===phone&&String(r.device||'')===device;
  })||null;
}

function syncRepair(type,repair){
  if(!repair||!repair.id)return;
  var payload={
    type:type,
    repair:{
      id:repair.id,
      customer:repair.customer,
      phone:repair.phone,
      smsMarketingOptIn:repair.smsMarketingOptIn===true,
      device:repair.device,
      status:repair.status,
      total:Number(repair.total||0),
      balance:Number(repair.balance||0),
      createdAt:repair.createdAt,
      updatedAt:repair.updatedAt
    }
  };

  fetch(ENDPOINT,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
    keepalive:true
  }).then(function(res){
    if(!res.ok)throw new Error('Klaviyo sync '+res.status);
  }).catch(function(err){
    console.warn('Klaviyo sync skipped:',err.message||err);
  });
}

function installSaveWrapper(){
  if(typeof window.saveRepair!=='function'||window.saveRepair.__klaviyoWrapped)return;
  var original=window.saveRepair;
  function wrappedSaveRepair(){
    var customer=text('rCustomer');
    var phone=text('rPhone');
    var device=text('rDevice');
    var smsMarketingOptIn=!!(byId('rMarketingOptIn')&&byId('rMarketingOptIn').checked);
    var title=byId('formTitle')?byId('formTitle').textContent:'';
    var editMatch=String(title||'').match(/^Edit\s+(R\d+)/i);
    var editingId=editMatch?editMatch[1]:null;

    original.apply(this,arguments);

    setTimeout(function(){
      var repair=editingId?patchRepair(editingId,smsMarketingOptIn):findLatestRepair(customer,phone,device);
      if(repair&&!editingId)repair=patchRepair(repair.id,smsMarketingOptIn)||repair;
      if(repair)syncRepair(editingId?'repair_updated':'repair_created',repair);
    },0);
  }
  wrappedSaveRepair.__klaviyoWrapped=true;
  window.saveRepair=wrappedSaveRepair;
}

function hydrateConsentOnEdit(){
  if(typeof window.editRepair!=='function'||window.editRepair.__klaviyoWrapped)return;
  var original=window.editRepair;
  function wrappedEditRepair(id){
    original.apply(this,arguments);
    var list=loadJSON(REPAIRS_KEY,[]);
    var repair=Array.isArray(list)?list.find(function(r){return String(r.id)===String(id)}):null;
    if(repair&&byId('rMarketingOptIn'))byId('rMarketingOptIn').checked=repair.smsMarketingOptIn===true;
  }
  wrappedEditRepair.__klaviyoWrapped=true;
  window.editRepair=wrappedEditRepair;
}

function clearConsentField(){
  var clear=window.clearRepairForm;
  if(typeof clear!=='function'||clear.__klaviyoWrapped)return;
  function wrappedClear(){
    clear.apply(this,arguments);
    if(byId('rEmail'))byId('rEmail').value='';
    if(byId('rMarketingOptIn'))byId('rMarketingOptIn').checked=false;
  }
  wrappedClear.__klaviyoWrapped=true;
  window.clearRepairForm=wrappedClear;
}

function init(){configureSmsUi();installSaveWrapper();hydrateConsentOnEdit();clearConsentField()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
