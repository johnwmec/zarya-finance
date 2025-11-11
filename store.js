
window.FinStore = {
  cfgKey: 'finapp_cfg_v2', recKey: 'finapp_receipts_v2',
  loadCfg(){ try{ return JSON.parse(localStorage.getItem(this.cfgKey)||'{}'); }catch(e){ return {}; } },
  saveCfg(cfg){ localStorage.setItem(this.cfgKey, JSON.stringify(cfg||{})); },
  loadReceipts(){ try{ return JSON.parse(localStorage.getItem(this.recKey)||'[]'); }catch(e){ return []; } },
  saveReceipts(a){ localStorage.setItem(this.recKey, JSON.stringify(a||[])); }
};
