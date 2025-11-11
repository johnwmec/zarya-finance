
async function fetchNfceViaAppsScript(nfceUrl){
  const cfg = FinStore.loadCfg();
  if(!cfg.endpoint) throw new Error('Defina o endpoint do Apps Script em Config.');
  const resp = await fetch(cfg.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: nfceUrl }) });
  if (!resp.ok) throw new Error('Falha no parser ('+resp.status+')');
  return await resp.json();
}
async function fetchNfceViaProxy(nfceUrl){
  const proxied = 'https://r.jina.ai/http://'+ nfceUrl.replace(/^https?:\/\//i,'').replace(/^\/\//,'');
  const resp = await fetch(proxied); if (!resp.ok) throw new Error('Proxy falhou ('+resp.status+')'); const html = await resp.text();
  return parseNfceHtml(html, nfceUrl);
}
function parseNfceHtml(html, url){
  function pick(text, arr){ for (let re of arr){ const m = re.exec(text); if (m && m[1]) return m[1]; } return ''; }
  function clean(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  let emitente = pick(html,[/Raz[aã]o Social[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,/<span[^>]*class="txtTopo"[^>]*>([^<]+)/i]);
  let cnpj = pick(html,[/CNPJ[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,/CNPJ:\s*<\/span>\s*<span[^>]*>([^<]+)/i]); cnpj = cnpj ? cnpj.replace(/\D+/g,'') : '';
  let valor = pick(html,[/Valor\s*Total[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,/TOTAL\s*R\$\s*([^<]+)/i]); valor = valor ? (parseFloat(valor.replace(/\./g,'').replace(',','.'))||0) : 0;
  let dataEm = pick(html,[/Data\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>([^<]+)/i]);
  let uf = (url.match(/\/\/(\w{2})\./i)||[])[1] || '';
  let chave = (url.match(/chNFe=([\d]{44})/i)||url.match(/p=([\d]{44})/i)||[])[1] || '';
  const items = []; try{
    const re = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/ig;
    let m; while ((m=re.exec(html))!==null){ const desc=clean(m[1]); const qtd=parseFloat(clean(m[2]).replace(',','.'))||0; const un=clean(m[3]); const v=parseFloat(clean(m[4]).replace(/\./g,'').replace(',','.'))||0; if (desc && v>0) items.push({descricao:desc, quantidade:qtd, unidade:un, valor_total:v}); }
  }catch(e){}
  return { emitente: clean(emitente), cnpj, valor, data: dataEm || new Date().toISOString(), uf: uf.toUpperCase(), chave, items };
}
async function processNfceUrl(url){
  let data=null; try{ data = await fetchNfceViaAppsScript(url); }catch(e){ data = await fetchNfceViaProxy(url); }
  const arr = FinStore.loadReceipts();
  arr.unshift({ id: crypto.randomUUID(), emitente: data.emitente||'', cnpj: data.cnpj||'', data: data.data || new Date().toISOString(), valor: data.valor||0, uf: data.uf||'', chave: data.chave||'', url, itens: data.items||data.itens||[] });
  FinStore.saveReceipts(arr);
  return arr[0];
}
