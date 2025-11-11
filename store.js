
const FinStore = {
  cfgKey: 'finapp_cfg_v2', recKey: 'finapp_receipts_v2', txKey:  'finapp_txs_v2', rulesKey: 'finapp_rules_v2',
  loadCfg(){ try{ return JSON.parse(localStorage.getItem(this.cfgKey)||'{}'); }catch(e){ return {}; } },
  saveCfg(cfg){ localStorage.setItem(this.cfgKey, JSON.stringify(cfg||{})); },
  loadReceipts(){ try{ return JSON.parse(localStorage.getItem(this.recKey)||'[]'); }catch(e){ return []; } },
  saveReceipts(a){ localStorage.setItem(this.recKey, JSON.stringify(a||[])); },
  loadTxs(){ try{ return JSON.parse(localStorage.getItem(this.txKey)||'[]'); }catch(e){ return []; } },
  saveTxs(a){ localStorage.setItem(this.txKey, JSON.stringify(a||[])); },
  loadRules(){ try{ return JSON.parse(localStorage.getItem(this.rulesKey)||'[]'); }catch(e){ return []; } },
  saveRules(a){ localStorage.setItem(this.rulesKey, JSON.stringify(a||[])); },
  wipe(){
    localStorage.removeItem('finapp_cfg_v2');
    localStorage.removeItem('finapp_receipts_v2');
    localStorage.removeItem('finapp_txs_v2');
    localStorage.removeItem('finapp_rules_v2');
  }
};
function inPeriod(dateISO, period){
  const d = new Date(dateISO); if (isNaN(d)) return false;
  const now = new Date(); let start = null;
  if (period.mode==='custom'){ const s=new Date(period.start), e=new Date(period.end||now); return d>=s && d<=e; }
  if (period.mode==='last30'){ start=new Date(now); start.setDate(start.getDate()-30); }
  else if (period.mode==='year'){ start=new Date(now.getFullYear(),0,1); }
  else { start=new Date(now.getFullYear(), now.getMonth(), 1); }
  return d>=start && d<=now;
}
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
  for (const r of rules){ try{ const re = new RegExp(r.pattern,'i'); if (re.test(text||'')) return r.categoria; }catch(e){} }
  return 'Sem categoria';
}
