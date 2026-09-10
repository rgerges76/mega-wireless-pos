(function(){
'use strict';

var ENDPOINT='/.netlify/functions/klaviyo-event';
var REPAIRS_KEY='mw_repairs';
var DBKEY='mw_platform_v1';

function byId(id){return document.getElementById(id)}
function loadJSON(key,def){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):def}catch(e){return def}}
function saveJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val))}catch(e){console.error(e)}}
function text(id){var el=byId(id);return el?String(el.value||'').trim():''}

function patchRepair(id,email,marketingOptIn){
  if(!id)return null;
  var list=loadJSON(REPAIRS_KEY,[]);
  if(!Array.isArray(list))list=[];
  var record=list.find(function(r){return String(r&&r.id||'')===String(id)});
  if(record){
    record.email=email||'';
    record.marketingOptIn=marketingOptIn===true;
    saveJSON(REPAIRS_KEY,list);
  }

  var db=loadJSON(DBKEY,{});
  if(db&&Array.isArray(db.repairs)){
    var platformRecord=db.repairs.find(function(r){return String(r&&r.id||'')===String(id)});
    if(platformRecord){
      platformRecord.email=email||'';
      platformRecord.marketingOptIn=marketingOptIn===true;
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
      email:repair.email||'',
      marketingOptIn:repair.marketingOptIn===true,
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
    var email=text('rEmail');
    var marketingOptIn=!!(byId('rMarketingOptIn')&&byId('rMarketingOptIn').checked);
    var title=byId('formTitle')?byId('formTitle').textContent:'';
    var editMatch=String(title||'').match(/^Edit\s+(R\d+)/i);
    var editingId=editMatch?editMatch[1]:null;

    original.apply(this,arguments);

    setTimeout(function(){
      var repair=editingId?patchRepair(editingId,email,marketingOptIn):findLatestRepair(customer,phone,device);
      if(repair&&!editingId)repair=patchRepair(repair.id,email,marketingOptIn)||repair;
      if(repair)syncRepair(editingId?'repair_updated':'repair_created',repair);
    },0);
  }
  wrappedSaveRepair.__klaviyoWrapped=true;
  window.saveRepair=wrappedSaveRepair;
}

function hydrateEmailOnEdit(){
  if(typeof window.editRepair!=='function'||window.editRepair.__klaviyoWrapped)return;
  var original=window.editRepair;
  function wrappedEditRepair(id){
    original.apply(this,arguments);
    var list=loadJSON(REPAIRS_KEY,[]);
    var repair=Array.isArray(list)?list.find(function(r){return String(r.id)===String(id)}):null;
    if(repair){
      if(byId('rEmail'))byId('rEmail').value=repair.email||'';
      if(byId('rMarketingOptIn'))byId('rMarketingOptIn').checked=repair.marketingOptIn===true;
    }
  }
  wrappedEditRepair.__klaviyoWrapped=true;
  window.editRepair=wrappedEditRepair;
}

function clearMarketingFields(){
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

function init(){installSaveWrapper();hydrateEmailOnEdit();clearMarketingFields()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
