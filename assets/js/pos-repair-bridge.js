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
    var exists=(window.cart||[]).some(function(x){return x.repairId&&x.repairId===payload.repairId;});
    if(!exists)window.cart.push(payload.line);
    localStorage.removeItem('mw_pos_prefill');
    drawCart();
    setTimeout(function(){alert('Repair '+payload.repairId+' added to the POS cart.');},100);
  }catch(err){
    console.error('Repair prefill error',err);
    localStorage.removeItem('mw_pos_prefill');
  }
};

window.checkout=function(payment){
  var repairs=(window.cart||[]).filter(function(x){return x.repairId;}).map(function(x){return {id:x.repairId,amount:Number(x.price||0)*Number(x.qty||1)};});
  var saleCountBefore=(window.db&&window.db.sales?window.db.sales.length:0);
  baseCheckout(payment);
  if(!repairs.length||!window.db)return;
  if((window.db.sales||[]).length<=saleCountBefore)return;
  if(!Array.isArray(window.db.repairs))window.db.repairs=[];
  var sale=window.db.sales[window.db.sales.length-1];
  repairs.forEach(function(info){
    var r=window.db.repairs.find(function(x){return x.id===info.id;});
    if(!r)return;
    r.deposit=Number(r.total||0);
    r.balance=0;
    r.status='Completed';
    r.paidAt=new Date().toISOString();
    r.saleId=sale&&sale.id?sale.id:null;
    r.updatedAt=new Date().toISOString();
  });
  saveDB(window.db);
};
})();
