async function processNfceUrl(url){
  const cfg = FinStore.loadCfg();
  if(!cfg.endpoint){ throw new Error('Defina o endpoint do Apps Script em Config.'); }
  const payload = { url };
  const resp = await fetch(cfg.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!resp.ok){ throw new Error('Falha no parser ('+resp.status+')'); }
  const data = await resp.json();
  const arr = FinStore.loadReceipts();
  arr.unshift({
    id: crypto.randomUUID(),
    emitente: data.emitente||'',
    cnpj: data.cnpj||'',
    data: data.data || new Date().toISOString(),
    valor: data.valor||0,
    uf: data.uf||'',
    chave: data.chave||'',
    url: url,
    itens: data.items||[]
  });
  FinStore.saveReceipts(arr);
  return arr[0];
}
