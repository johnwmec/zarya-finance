
function brToNumber(txt){
  if (txt == null) return null;
  const s = String(txt).replace(/\u00A0/g,' ').trim().replace(/\s/g,'');
  if (!s) return null;
  const cleaned = s.replace(/[R$\s]/gi,'');
  const n = cleaned.replace(/\./g,'').replace(',', '.');
  const v = parseFloat(n);
  return isNaN(v) ? null : v;
}
function toISO(dateStr, timeStr){
  if (!dateStr) return new Date().toISOString();
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dateStr);
  if (!m) return new Date().toISOString();
  const [_, d, mo, y] = m;
  let hh='00', mm='00', ss='00';
  if (timeStr){
    const t = /(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeStr);
    if (t){ hh=t[1]; mm=t[2]; ss=t[3]||'00'; }
  }
  return `${y}-${mo}-${d}T${hh}:${mm}:${ss}`;
}
function clean(s){ return String(s||'').replace(/\s+/g,' ').replace(/\u00A0/g,' ').trim(); }
function text(node){ return clean(node?.textContent||''); }

async function fetchHtmlViaProxy(nfceUrl){
  const proxied = 'https://r.jina.ai/http://'+ nfceUrl.replace(/^https?:\/\//i,'').replace(/^\/\//,'');
  const resp = await fetch(proxied);
  if (!resp.ok) throw new Error('Proxy falhou ('+resp.status+')');
  return await resp.text();
}
async function fetchViaAppsScript(nfceUrl){
  const cfg = FinStore.loadCfg();
  if(!cfg.endpoint) throw new Error('Defina o endpoint do Apps Script em Config.');
  try{
    const resp = await fetch(cfg.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: nfceUrl, v:3, raw:true }) });
    if (!resp.ok) throw new Error('Falha no parser ('+resp.status+')');
    return await resp.text();
  }catch(e){
    const sep = cfg.endpoint.includes('?') ? '&' : '?';
    const resp = await fetch(`${cfg.endpoint}${sep}url=${encodeURIComponent(nfceUrl)}&v=3&raw=true`);
    if (!resp.ok) throw new Error('Falha no parser GET ('+resp.status+')');
    return await resp.text();
  }
}

function parseWithDOM(html, url){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let emitente='', cnpj='', documento='';
  const allRows = Array.from(doc.querySelectorAll('table tr'));
  for(const tr of allRows){
    const tds = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.innerText||td.textContent||''));
    if (tds.length>=2){
      if (!emitente && /raz[aã]o social|emitente|nome\/raza[oã]/i.test(tds[0])) emitente = tds[1];
      if (!cnpj && /cnpj/i.test(tds[0])) cnpj = tds[1].replace(/\D+/g,'');
      if (!documento && /(cpf.*consumidor|cpf\/cnpj.*consumidor|cpf do consumidor)/i.test(tds[0])) documento = tds[1];
    }
  }
  if (!emitente){
    const topo = doc.querySelector('.txtTopo, #u20, .emitente, header h1, h2');
    emitente = clean(topo?.textContent||'');
  }
  let dataBR = '', hora = '';
  const labels = ['Data de Emissão','Data/Hora da Emissão','Emissão'];
  for (const tr of allRows){
    const tds = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.innerText||td.textContent||''));
    if (tds.length>=2){
      if (labels.some(l=>tds[0].includes(l))){
        const val = tds[1];
        const dm = /(\d{2}\/\d{2}\/\d{4})/.exec(val);
        const hm = /(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/.exec(val);
        if (dm) dataBR = dm[1];
        if (hm) hora = hm[1];
      }
    }
  }
  if (!dataBR){
    const m = /Data\/Hora da Emiss[aã]o[^<]*>\s*([^<]+)/i.exec(html);
    if (m){ const dm = /(\d{2}\/\d{2}\/\d{4})/.exec(m[1]); const hm = /(\d{2}:\d{2}(:\d{2})?)/.exec(m[1]); dataBR = dm?dm[1]:''; hora = hm?hm[1]:''; }
  }
  const dataISO = toISO(dataBR, hora);

  let valorTotal = null;
  for (const tr of allRows){
    const tds = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.innerText||td.textContent||''));
    if (tds.length>=2 && /valor\s*(total|a pagar)/i.test(tds[0])){ valorTotal = brToNumber(tds[1]); break; }
  }
  if (valorTotal==null){
    const nodes = Array.from(doc.querySelectorAll('td, span, div')).map(e=>clean(e.textContent));
    const totalSpan = nodes.find(t=>/^total\s*r\$/i.test(t));
    if (totalSpan){ const num = totalSpan.replace(/[^0-9\.,]/g,''); valorTotal = brToNumber(num); }
  }
  valorTotal = valorTotal ?? 0;

  const items = [];
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const table of tables){
    const headers = Array.from(table.querySelectorAll('th')).map(th=>clean(th.textContent));
    if (headers.length){
      const hasDesc = headers.some(h=>/descri[cç][aã]o|produto/i.test(h));
      const hasVTotal = headers.some(h=>/valor\s*total|vl\.?\s*total/i.test(h));
      if (hasDesc && hasVTotal){
        const trs = Array.from(table.querySelectorAll('tr'));
        for (const tr of trs.slice(1)){
          const cells = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.textContent));
          if (cells.length<2) continue;
          const desc = cells[0]; if (!desc || /\bdescri[cç][aã]o\b/i.test(desc)) continue;
          let qtd = null, un = '', vun = null, vtot = null;
          headers.forEach((h,idx)=>{
            const val = cells[idx] || '';
            if (/qtde|quantidade/i.test(h)) qtd = brToNumber(val);
            if (/unidade|un\b|und/i.test(h)) un = val;
            if (/valor\s*unit|vl\.?\s*unit/i.test(h)) vun = brToNumber(val);
            if (/valor\s*total|vl\.?\s*total/i.test(h)) vtot = brToNumber(val);
          });
          if (vtot==null){ const lastNum = cells.slice().reverse().find(c=>/[\d\.,]/.test(c)); vtot = brToNumber(lastNum); }
          if (qtd==null){ const n = cells.find(c=>/^\d+([\.,]\d+)?$/.test(c)); qtd = brToNumber(n)||1; }
          if (!un){ const u = cells.find(c=>/^(UN|UND|KG|L|UNID|PC|PÇ|G|ML|CX|FD|SC|DZ|M|LT)$/i.test(c)); un = u||''; }
          if (vun==null && vtot!=null && qtd){ vun = (vtot && qtd)? (vtot/qtd) : null; }
          if (desc && vtot!=null && vtot>0) items.push({ descricao: desc, quantidade: qtd||1, unidade: un||'', valor_unitario: vun, valor_total: vtot });
        }
      }
    }
  }
  if (items.length===0){
    const rows = Array.from(doc.querySelectorAll('tr.fixo-prod-serv, .linha-produto, .prod, [role="row"]'));
    for (const row of rows){
      const cells = Array.from(row.querySelectorAll('td, [role="cell"]')).map(e=>clean(e.textContent));
      if (cells.length<3) continue;
      const desc = cells[0];
      const vtot = brToNumber(cells[cells.length-1]);
      const qtd = brToNumber(cells.find(c=>/^\d+([\.,]\d+)?$/.test(c))) || 1;
      const un = (cells.find(c=>/^(UN|UND|KG|L|UNID|PC|PÇ|G|ML|CX|FD|SC|DZ|M|LT)$/i.test(c)) || '');
      const vun = (vtot && qtd) ? vtot/qtd : null;
      if (desc && vtot) items.push({ descricao: desc, quantidade: qtd, unidade: un, valor_unitario: vun, valor_total: vtot });
    }
  }

  const uf = (url.match(/\/\/(\w{2})\./i)||[])[1]?.toUpperCase() || '';
  const chave = (url.match(/chNFe=([\d]{44})/i)||url.match(/p=([\d]{44})/i)||[])[1] || '';

  return { emitente, cnpj: cnpj?.replace(/\D+/g,''), documento, data: toISO(dataBR, hora), data_br: dataBR, hora, uf, chave, valor: valorTotal, items };
}

async function fetchNfceAny(nfceUrl){
  try{ return await fetchViaAppsScript(nfceUrl); }catch(e){ return await fetchHtmlViaProxy(nfceUrl); }
}

async function processNfceUrl(url){
  const html = await fetchNfceAny(url);
  const data = await parseWithDOM(html, url);
  const arr = FinStore.loadReceipts();
  arr.unshift({ id: crypto.randomUUID(), emitente: data.emitente||'', cnpj: data.cnpj||'', documento: data.documento||'', data: data.data || new Date().toISOString(), valor: data.valor||0, uf: data.uf||'', chave: data.chave||'', url, itens: data.items||[] });
  FinStore.saveReceipts(arr);
  return arr[0];
}

document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('btnDbgTest');
  if (!btn) return;
  btn.addEventListener('click', async ()=>{
    const url = (document.getElementById('dbgUrl')?.value||'').trim();
    const outEl = document.getElementById('dbgOut');
    if (!url){ if(outEl) outEl.textContent='Informe a URL.'; return; }
    try{
      const html = await fetchNfceAny(url);
      const data = await parseWithDOM(html, url);
      if (outEl) outEl.textContent = JSON.stringify(data, null, 2).slice(0, 20000);
    }catch(e){ if(outEl) outEl.textContent = 'Erro: '+e.message; }
  });
});
