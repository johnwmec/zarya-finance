
(function(){
  function clean(s){ return String(s||'').replace(/\s+/g,' ').replace(/\u00A0/g,' ').trim(); }
  function brToNumber(txt){ if (txt==null) return null; const s=String(txt).replace(/\u00A0/g,' ').trim(); if(!s) return null; const n=s.replace(/[^\d,\.]/g,'').replace(/\./g,'').replace(',', '.'); const v=parseFloat(n); return isNaN(v)?null:v; }
  function toISO(dateStr, timeStr){ if(!dateStr) return new Date().toISOString(); const m=/(\d{2})\/(\d{2})\/(\d{4})/.exec(dateStr); if(!m) return new Date().toISOString(); const [_,d,mo,y]=m; let hh='00',mm='00',ss='00'; if(timeStr){ const t=/(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeStr); if(t){hh=t[1];mm=t[2];ss=t[3]||'00';}} return `${y}-${mo}-${d}T${hh}:${mm}:${ss}`; }
  async function fetchViaProxy(nfceUrl){ const prox='https://r.jina.ai/http://'+nfceUrl.replace(/^https?:\/\//i,'').replace(/^\/\//,''); const r=await fetch(prox); if(!r.ok) throw new Error('Proxy '+r.status); return await r.text(); }
  async function fetchViaAppsScript(nfceUrl){ const cfg=(window.FinStore&&FinStore.loadCfg&&FinStore.loadCfg())||{}; if(!cfg.endpoint) throw new Error('Defina o endpoint do Apps Script em Config.'); const sep = cfg.endpoint.includes('?') ? '&' : '?'; try{ const r=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:nfceUrl,v:3,raw:true})}); if(!r.ok) throw new Error(String(r.status)); return await r.text(); }catch(e){ const r=await fetch(`${cfg.endpoint}${sep}url=${encodeURIComponent(nfceUrl)}&v=3&raw=true`); if(!r.ok) throw new Error(String(r.status)); return await r.text(); } }
  function parseWithDOM(html, url){
    const doc = new DOMParser().parseFromString(html,'text/html');
    let emitente='', cnpj='', documento='';
    const rows = Array.from(doc.querySelectorAll('table tr'));
    for(const tr of rows){
      const tds = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.innerText||td.textContent||''));
      if (tds.length>=2){
        const k0=tds[0].toLowerCase(), k1=tds[1].toLowerCase();
        if (!emitente && /raz[aã]o social|emitente|nome\/raza[oã]/i.test(tds[0])) emitente = tds[1];
        if (!cnpj && /cnpj/.test(k0)) cnpj = tds[1].replace(/\D+/g,'');
        if (!documento && /(cpf.*consumidor|cpf\/cnpj.*consumidor|cpf do consumidor)/i.test(tds[0])) documento = tds[1];
        if (!emitente && /raz[aã]o social|emitente|nome\/raza[oã]/i.test(tds[1])) emitente = tds[0];
        if (!cnpj && /cnpj/.test(k1)) cnpj = tds[0].replace(/\D+/g,'');
      }
    }
    if (!emitente){ const topo = doc.querySelector('.txtTopo, #u20, .emitente, header h1, h2, .nome-emitente, #nomeEmitente'); emitente = clean(topo?.textContent||''); }
    let dataBR='', hora='';
    for(const tr of rows){
      const tds = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.innerText||td.textContent||''));
      if (tds.length>=2 && /Data\/?Hora|Emiss[aã]o/i.test(tds[0])){
        const dm=/(\d{2}\/\d{2}\/\d{4})/.exec(tds[1]); const hm=/(\d{2}:\d{2}(:\d{2})?)/.exec(tds[1]);
        if (dm) dataBR=dm[1]; if (hm) hora=hm[1];
      }
    }
    const dataISO = toISO(dataBR, hora);
    let valorTotal = null;
    for(const tr of rows){
      const tds = Array.from(tr.querySelectorAll('td')).map(td=>clean(td.innerText||td.textContent||''));
      if (tds.length>=2 && /valor\s*(total|a pagar)/i.test(tds[0])){ valorTotal = brToNumber(tds[1]); break; }
    }
    valorTotal = valorTotal ?? 0;
    const items=[];
    const tables=Array.from(doc.querySelectorAll('table'));
    for(const table of tables){
      const headers=Array.from(table.querySelectorAll('th')).map(th=>clean(th.textContent));
      if (!headers.length) continue;
      const hasDesc=headers.some(h=>/descri[cç][aã]o|produto/i.test(h));
      const hasVTotal=headers.some(h=>/valor\s*total|vl\.?\s*total/i.test(h));
      if (hasDesc && hasVTotal){
        const trs=Array.from(table.querySelectorAll('tr')).slice(1);
        for(const tr of trs){
          const cells=Array.from(tr.querySelectorAll('td')).map(td=>clean(td.textContent));
          if (cells.length<2) continue;
          const desc=cells[0]; if (!desc || /\bdescri[cç][aã]o\b/i.test(desc)) continue;
          let qtd=null, un='', vun=null, vtot=null;
          headers.forEach((h,idx)=>{
            const val=cells[idx]||'';
            if (/qtde|quantidade/i.test(h)) qtd=brToNumber(val);
            if (/unidade|un\b|und/i.test(h)) un=val;
            if (/valor\s*unit|vl\.?\s*unit/i.test(h)) vun=brToNumber(val);
            if (/valor\s*total|vl\.?\s*total/i.test(h)) vtot=brToNumber(val);
          });
          if (vtot==null){ const last=cells.slice().reverse().find(c=>/[\d\.,]/.test(c)); vtot=brToNumber(last); }
          if (qtd==null){ const n=cells.find(c=>/^\d+([\.,]\d+)?$/.test(c)); qtd=brToNumber(n)||1; }
          if (!un){ const u=cells.find(c=>/^(UN|UND|KG|L|UNID|PC|PÇ|G|ML|CX|FD|SC|DZ|M|LT)$/i.test(c)); un=u||''; }
          if (vun==null && vtot!=null && qtd){ vun=(vtot&&qtd)?(vtot/qtd):null; }
          if (desc && vtot!=null && vtot>0) items.push({ descricao: desc, quantidade: qtd||1, unidade: un||'', valor_unitario: vun, valor_total: vtot });
        }
      }
    }
    const uf = (url.match(/\/\/(\w{2})\./i)||[])[1]?.toUpperCase() || ''; const chave = (url.match(/chNFe=([\d]{44})/i)||url.match(/p=([\d]{44})/i)||[])[1] || '';
    return { emitente, cnpj: cnpj.replace(/\D+/g,''), documento, data: dataISO, data_br: dataBR, hora, uf, chave, valor: valorTotal, items };
  }
  async function getHtml(url){ try{ return await fetchViaAppsScript(url); }catch(e){ return await fetchViaProxy(url); } }
  async function processNfceUrl(url){ const html=await getHtml(url); const data=parseWithDOM(html,url); const arr=FinStore.loadReceipts(); arr.unshift({id:crypto.randomUUID(), emitente:data.emitente||'', cnpj:data.cnpj||'', documento:data.documento||'', data:data.data||new Date().toISOString(), valor:data.valor||0, uf:data.uf||'', chave:data.chave||'', url, itens:data.items||[]}); FinStore.saveReceipts(arr); return arr[0]; }
  async function debug(url){ const html=await getHtml(url); return parseWithDOM(html,url); }
  window.NFCE={processNfceUrl, debug};
  // Flag to show scripts executed
  window.__ZARYA_BOOT_OK__ = true;
})();