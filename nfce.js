async function processNfceUrl(url){
  const cfg = FinStore.loadCfg();
  if(!cfg.endpoint){ throw new Error('Defina o endpoint do Apps Script em Config.'); }

  // Chamada via GET com query (evita preflight CORS)
  const api = cfg.endpoint.replace(/\/$/, '');
  const full = `${api}?u=${encodeURIComponent(url)}`;

  const resp = await fetch(full, { method: 'GET' });
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
