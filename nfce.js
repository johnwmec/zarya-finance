
(function(){
  function clean(s){ return String(s||'').replace(/\s+/g,' ').replace(/\xA0/g,' ').trim(); }
  function brToNumber(txt){
    if (txt == null) return null;
    var s = String(txt).replace(/\xA0/g,' ').trim();
    if (!s) return null;
    var cleaned = s.replace(/[R$\s]/gi,'');
    var n = cleaned.replace(/\./g,'').replace(',', '.');
    var v = parseFloat(n);
    return isNaN(v) ? null : v;
  }
  function toISO(dateStr, timeStr){
    if (!dateStr) return new Date().toISOString();
    var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dateStr);
    if (!m) return new Date().toISOString();
    var d=m[1], mo=m[2], y=m[3];
    var hh='00', mm='00', ss='00';
    if (timeStr){
      var t = /(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeStr);
      if (t){ hh=t[1]; mm=t[2]; ss=t[3]||'00'; }
    }
    return y+'-'+mo+'-'+d+'T'+hh+':'+mm+':'+ss;
  }
  async function fetchViaProxy(nfceUrl){
    var _url = (nfceUrl||'').trim(); if (!/^https?:\/\//i.test(_url)) _url = 'https://' + _url;
    var proxied = 'https://r.jina.ai/' + _url;
    var resp = await fetch(proxied);
    if (!resp.ok) throw new Error('Proxy fail ('+resp.status+')');
    return await resp.text();
  }
  async function fetchViaAppsScript(nfceUrl){
    var cfg = (window.FinStore && window.FinStore.loadCfg && window.FinStore.loadCfg()) || {};
    if (!cfg.endpoint) throw new Error('Set Apps Script endpoint in Config.');
    var sep = cfg.endpoint.indexOf('?')>=0 ? '&' : '?';
    var resp = await fetch(cfg.endpoint + sep + 'url='+encodeURIComponent(nfceUrl)+'&v=3&raw=true');
    if (!resp.ok) throw new Error('Parser fail ('+resp.status+')');
    return await resp.text();
  }
  function mdNumberBR(s){
    if (!s) return null; s=String(s);
    var cleaned = s.replace(/[R$\s]/gi,'').replace(/\./g,'').replace(',', '.');
    var v = parseFloat(cleaned); return isNaN(v)?null:v;
  }
  function parseFromMarkdown(md, url){
    var text = md;
    var emitente = '';
    var cnpj = '';
    var dataBR = '';
    var hora = '';
    var valorTotal = null;
    var uf = '';
    var items = [];

    var mEmit = /####\s*\*\*([^*\n]+)\*\*/i.exec(text);
    if (mEmit) emitente = (mEmit[1]||'').trim();
    if (!emitente){
      var mEmit2 = /\|\s*Nome\s*\/\s*Raz\w+\s*\|[\s\S]*?\|\s*([^|\n]+?)\s*\|\s*\d{8,}\s*\|/i.exec(text);
      if (mEmit2) emitente = (mEmit2[1]||'').trim();
    }

    var mCNPJ = /CNPJ:\s*([\d\.\/-]+)/i.exec(text);
    if (mCNPJ) cnpj = mCNPJ[1].replace(/\D+/g,'');

    var mUF = /\|\s*UF\s*\|[\s\S]*?\|\s*([A-Z]{2})\s*\|/i.exec(text);
    if (!mUF){
      mUF = /(,\s*([A-Z]{2}))\s*-?\s*\d{5}-\d{3}/m.exec(text);
    }
    uf = (mUF && (mUF[1]||mUF[2])) ? (mUF[1]||mUF[2]).toUpperCase() : '';

    var mData = /\|\s*Modelo\s*\|\s*S[ée]rie\s*\|\s*N[úu]mero\s*\|\s*Data Emiss[aã]o\s*\|[\s\S]*?\|\s*\d+\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}(?::\d{2})?)?\s*\|/i.exec(text);
    if (!mData){
      mData = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/.exec(text);
    }
    if (mData){ dataBR = mData[1]; hora = (mData[2]||'').trim(); }

    var mV1 = /\*\*Valor total R\$\*\*[\s\S]*?\*\*\s*([0-9\.,]+)\s*\*\*/i.exec(text);
    if (mV1) valorTotal = mdNumberBR(mV1[1]);
    if (valorTotal==null){
      var mV2 = /Valor\s*total\s*R\$\s*:?\s*R\$\s*([0-9\.,]+)/i.exec(text);
      if (mV2) valorTotal = mdNumberBR(mV2[1]);
    }
    if (valorTotal==null){
      var mV3 = /Valor\s*pago\s*R\$[\s\S]*?\*\*\s*([0-9\.,]+)\s*\*\*/i.exec(text);
      if (mV3) valorTotal = mdNumberBR(mV3[1]);
    }

    var reItem = /(.*?)\(Co?digo:[^)]+\)\s*Qtde total de [^:]+:\s*([0-9\.,]+)\s*UN:\s*([A-Z]+)\s*Valor total R\$\s*:\s*R\$\s*([0-9\.,]+)/gi;
    var im;
    while ((im = reItem.exec(text))){
      var desc = (im[1]||'').replace(/\s+/g,' ').trim();
      var qtd = mdNumberBR(im[2])||1;
      var un = (im[3]||'').trim();
      var vtot = mdNumberBR(im[4])||0;
      var vun = (qtd && vtot)? vtot/qtd : null;
      if (desc && vtot>0) items.push({ descricao: desc, quantidade: qtd, unidade: un, valor_unitario: vun, valor_total: vtot });
    }

    var chm = ( /chNFe=([\d]{44})/i.exec(url) || /p=([\d]{44})/i.exec(url) );
    var chave = chm? chm[1] : '';
    var dataISO = toISO(dataBR, hora);

    return { emitente: emitente||'', cnpj: (cnpj||'').replace(/\D+/g,''), documento:'', data: dataISO, data_br: dataBR||'', hora: hora||'', uf: uf||'', chave: chave||'', valor: valorTotal||0, items: items, _mode:'markdown' };
  }
  function parseWithDOM(html, url){
    var looksLikeMarkdown = (!/<!doctype|<html[\s>]/i.test(html)) && (/Markdown Content:|\*\*|^#|\|\s*-{3,}\s*\|/m.test(html));
    if (looksLikeMarkdown) return parseFromMarkdown(html, url);

    var doc = new DOMParser().parseFromString(html, 'text/html');
    var emitente='', cnpj='', documento='';
    var allRows = Array.prototype.slice.call(doc.querySelectorAll('table tr'));
    for(var i=0;i<allRows.length;i++){
      var tr = allRows[i];
      var tds = Array.prototype.slice.call(tr.querySelectorAll('td')).map(function(td){ return clean(td.innerText||td.textContent||''); });
      if (tds.length>=2){
        if (!emitente && /razao social|emitente|nome\/razao/i.test(tds[0])) emitente = tds[1];
        if (!cnpj && /cnpj/i.test(tds[0])) cnpj = tds[1].replace(/\D+/g,'');
        if (!documento && /(cpf.*consumidor|cpf\/cnpj.*consumidor|cpf do consumidor)/i.test(tds[0])) documento = tds[1];
        if (!emitente && /razao social|emitente|nome\/razao/i.test(tds[1])) emitente = tds[0];
        if (!cnpj && /cnpj/i.test(tds[1])) cnpj = tds[0].replace(/\D+/g,'');
      }
    }
    if (!emitente){
      var topo = doc.querySelector('.txtTopo, #u20, .emitente, header h1, h2, .nome-emitente, #nomeEmitente, [id*=\"emitente\" i], [id*=\"Razao\" i], [id*=\"razao\" i], [id*=\"xNome\" i]');
      emitente = clean(topo && topo.textContent || '');
    }
    var dataBR = '', hora = '';
    var labels = ['Data de Emissao','Data/Hora da Emissao','Emissao'];
    for (var j=0;j<allRows.length;j++){
      var tr2 = allRows[j];
      var tds2 = Array.prototype.slice.call(tr2.querySelectorAll('td')).map(function(td){ return clean(td.innerText||td.textContent||''); });
      if (tds2.length>=2){
        for (var k=0;k<labels.length;k++){ if (tds2[0].indexOf(labels[k])>=0){
          var dm = /(\d{2}\/\d{2}\/\d{4})/.exec(tds2[1]);
          var hm = /(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/.exec(tds2[1]);
          if (dm) dataBR = dm[1];
          if (hm) hora = hm[1];
        }}
      }
    }
    if (!dataBR){
      var m = /Data\/Hora da Emiss[aã]o[^<]*>\s*([^<]+)/i.exec(html);
      if (m){ var dm2 = /(\d{2}\/\d{2}\/\d{4})/.exec(m[1]); var hm2 = /(\d{2}:\d{2}(?::\d{2})?)/.exec(m[1]); dataBR = dm2?dm2[1]:''; hora = hm2?hm2[1]:''; }
    }
    var dataISO = toISO(dataBR, hora);
    var valorTotal = null;
    for (var z=0; z<allRows.length; z++){
      var tds3 = Array.prototype.slice.call(allRows[z].querySelectorAll('td')).map(function(td){ return clean(td.innerText||td.textContent||''); });
      if (tds3.length>=2 && /valor\s*(total|a pagar)/i.test(tds3[0])){ valorTotal = brToNumber(tds3[1]); break; }
    }
    if (valorTotal==null){
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('td, th, span, div, b, strong')).map(function(e){ return clean(e.textContent); });
      var totalLine = nodes.find(function(t){ return /valor\s*(a\s*)?pagar/i.test(t); });
      if (!totalLine) totalLine = nodes.find(function(t){ return /^total\s*r\$/i.test(t); });
      if (totalLine){ var num = totalLine.replace(/[^0-9\.,]/g,''); valorTotal = brToNumber(num); }
    }
    if (valorTotal==null) valorTotal = 0;
    var items = []; // MG page provides items only in text; markdown fallback covers it
    var ufm = /\/\/(\w{2})\./i.exec(url); var uf = (ufm && ufm[1]) ? ufm[1].toUpperCase() : '';
    var chm = ( /chNFe=([\d]{44})/i.exec(url) || /p=([\d]{44})/i.exec(url) ); var chave = chm ? chm[1] : '';
    return { emitente: emitente, cnpj: (cnpj||'').replace(/\D+/g,''), documento: documento, data: dataISO, data_br: dataBR, hora: hora, uf: uf, chave: chave, valor: valorTotal, items: items, _mode:'html' };
  }
  async function getHtml(url){
    var cfg = (window.FinStore && window.FinStore.loadCfg && window.FinStore.loadCfg()) || {};
    if (cfg.parserMode==='proxy' || !cfg.endpoint){ try{ return await fetchViaProxy(url); }catch(e){ return await fetchViaAppsScript(url); } }
    try{ return await fetchViaAppsScript(url); }catch(e){ return await fetchViaProxy(url); }
  }
  async function processNfceUrl(url){
    var html = await getHtml(url);
    var data = parseWithDOM(html, url);
    var arr = (window.FinStore && window.FinStore.loadReceipts ? window.FinStore.loadReceipts() : []) || [];
    arr.unshift({ id: String(Date.now()), emitente: data.emitente||'', cnpj: data.cnpj||'', documento: data.documento||'', data: data.data || new Date().toISOString(), valor: data.valor||0, uf: data.uf||'', chave: data.chave||'', url: url, itens: data.items||[] });
    if (window.FinStore && window.FinStore.saveReceipts) window.FinStore.saveReceipts(arr);
    return arr[0];
  }
  async function debugRaw(url){
    var html = await getHtml(url); var parsed = parseWithDOM(html, url);
    var title=(/<title>([^<]*)<\/title>/i.exec(html)||[])[1]||'';
    return { parsed: parsed, title: title, length: html.length, mode: parsed._mode||'unknown', head: html.slice(0, 8000), tail: html.slice(-6000) };
  }
  window.NFCE = { processNfceUrl: processNfceUrl, debugRaw: debugRaw };
})();
