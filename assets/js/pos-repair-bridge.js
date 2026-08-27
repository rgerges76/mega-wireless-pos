(function(){
'use strict';

var baseInitPOS=window.initPOS;
var baseCheckout=window.checkout;

window.initPOS=async function(){
  await baseInitPOS();
  try{
    var raw=localStorage.getItem('mw_pos_prefill');
    if(!raw)return;
    var payload=JSON.parse(raw);
    if(!payload||!payload.line)return;
    var exists=(window.cart||[]).some(function(x){return x.repairId&&x.repairId===payload.repairId});
    if(!exists)window.cart.push(payload.line);
    localStorage.removeItem('mw_pos_prefill');
    if(typeof drawCart==='function')drawCart();
  }catch(err){console.error('Repair prefill error',err);localStorage.removeItem('mw_pos_prefill')}
};

window.checkout=function(payment){
  var repairIds=(window.cart||[]).filter(function(x){return x.repairId}).map(function(x){return x.repairId});
  var sale=baseCheckout(payment);
  if(!sale||!repairIds.length||!window.db)return sale;
  if(!Array.isArray(window.db.repairs))window.db.repairs=[];
  repairIds.forEach(function(id){
    var r=window.db.repairs.find(function(x){return x.id===id});
    if(!r)return;
    r.deposit=Number(r.total||0);r.balance=0;r.status='Completed';r.paidAt=sale.date||new Date().toISOString();r.saleId=sale.id||null;r.updatedAt=new Date().toISOString();
  });
  if(typeof saveDB==='function')saveDB(window.db);
  return sale;
};
})();
