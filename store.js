
window.FinStore = {
  cfgKey: 'finapp_cfg_v2',
  recKey: 'finapp_receipts_v2',
  loadCfg: function(){ try{ return JSON.parse(localStorage.getItem(this.cfgKey)||'{}'); }catch(e){ return {}; } },
  saveCfg: function(cfg){ localStorage.setItem(this.cfgKey, JSON.stringify(cfg||{})); },
  loadReceipts: function(){ try{ return JSON.parse(localStorage.getItem(this.recKey)||'[]'); }catch(e){ return []; } },
  saveReceipts: function(a){ localStorage.setItem(this.recKey, JSON.stringify(a||[])); },
  wipe: function(){ try{ localStorage.removeItem(this.cfgKey); localStorage.removeItem(this.recKey); }catch(e){} }
};
window.FinCSV = {
  export: function(filename, rows){
    var esc = function(v){ return '\"' + String(v).replace(/\"/g,'\"\"') + '\"'; };
    var csv = rows.map(function(r){ return r.map(esc).join(','); }).join('\n');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1200);
  }
};
window.FinUtil = {
  inPeriod: function(dateISO, period){
    var d = new Date(dateISO); if (isNaN(d)) return false;
    var now = new Date(); var start = null;
    if (period.mode==='last30'){ start=new Date(now); start.setDate(start.getDate()-30); }
    else if (period.mode==='year'){ start=new Date(now.getFullYear(),0,1); }
    else { start=new Date(now.getFullYear(), now.getMonth(), 1); }
    return d>=start && d<=now;
  }
};
