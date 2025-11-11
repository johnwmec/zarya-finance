const FinStore = {
  cfgKey: 'finapp_cfg',
  recKey: 'finapp_receipts',
  txKey:  'finapp_txs',
  rulesKey: 'finapp_rules',

  loadCfg(){ try{ return JSON.parse(localStorage.getItem(this.cfgKey)||'{}'); }catch(e){ return {}; } },
  saveCfg(cfg){ localStorage.setItem(this.cfgKey, JSON.stringify(cfg||{})); },

  loadReceipts(){ try{ return JSON.parse(localStorage.getItem(this.recKey)||'[]'); }catch(e){ return []; } },
  saveReceipts(arr){ localStorage.setItem(this.recKey, JSON.stringify(arr||[])); },

  loadTxs(){ try{ return JSON.parse(localStorage.getItem(this.txKey)||'[]'); }catch(e){ return []; } },
  saveTxs(arr){ localStorage.setItem(this.txKey, JSON.stringify(arr||[])); },

  loadRules(){ try{ return JSON.parse(localStorage.getItem(this.rulesKey)||'[]'); }catch(e){ return []; } },
  saveRules(arr){ localStorage.setItem(this.rulesKey, JSON.stringify(arr||[])); },

  wipe(){
    localStorage.removeItem(this.cfgKey);
    localStorage.removeItem(this.recKey);
    localStorage.removeItem(this.txKey);
    localStorage.removeItem(this.rulesKey);
  }
};

function exportCSV(filename, rows){
  const esc = (v)=>('"'+String(v).replace(/"/g,'""')+'"');
  const csv = rows.map(r=>r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

function categorize(text){
  const rules = FinStore.loadRules();
  for (const r of rules){
    try { const re = new RegExp(r.pattern, 'i'); if (re.test(text||'')) return r.categoria; } catch(e){}
  }
  return 'Sem categoria';
}
