
function brToNumber(txt){
  if (txt == null) return null;
  const s = String(txt).replace(/\u00A0/g,' ').trim();
  if (!s) return null;
  // remove milhares ".", troca "," por "."
  const n = s.replace(/\./g,'').replace(',','.');
  const v = parseFloat(n);
  return isNaN(v) ? null : v;
}
function toISO(dateStr, timeStr){
  // aceita "dd/mm/aaaa" e hora "hh:mm(:ss)"
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

async function fetchNfceViaAppsScriptV3(nfceUrl){
  const cfg = FinStore.loadCfg();
  if(!cfg.endpoint) throw new Error('Defina o endpoint do Apps Script em Config.');
  // aceita tanto POST (corpo JSON) quanto GET (?url=...)
  const tryPost = async() => {
    const resp = await fetch(cfg.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: nfceUrl, v:3 }) });
    if (!resp.ok) throw new Error('Falha no parser ('+resp.status+')');
    return await resp.json();
  };
  try {
    return await tryPost();
  } catch(e){
    const sep = cfg.endpoint.includes('?') ? '&' : '?';
    const resp = await fetch(`${cfg.endpoint}${sep}url=${encodeURIComponent(nfceUrl)}&v=3`);
    if (!resp.ok) throw new Error('Falha no parser GET ('+resp.status+')');
    return await resp.json();
  }
}

async function fetchNfceViaProxy(nfceUrl){
  const proxied = 'https://r.jina.ai/http://'+ nfceUrl.replace(/^https?:\/\//i,'').replace(/^\/\//,'');
  const resp = await fetch(proxied);
  if (!resp.ok) throw new Error('Proxy falhou ('+resp.status+')');
  const html = await resp.text();
  return parseNfceHtmlRobusto(html, nfceUrl);
}

function parseNfceHtmlRobusto(html, url){
  // Utiliza múltiplos padrões por portal
  function pick(text, arr){ for (let re of arr){ const m = re.exec(text); if (m && m[1]) return m[1]; } return ''; }
  function clean(s){ return String(s||'').replace(/\s+/g,' ').replace(/\u00A0/g,' ').trim(); }
  const emitente = clean(pick(html,[
    /Raz[aã]o Social[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /Emitente[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /<span[^>]*class="txtTopo"[^>]*>([^<]+)/i
  ]));
  const cnpjRaw = pick(html,[
    /CNPJ[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /CNPJ:\s*<\/span>\s*<span[^>]*>([^<]+)/i,
    /CNPJ:\s*<\/td>\s*<td[^>]*>([^<]+)/i
  ]);
  const cnpj = (cnpjRaw||'').replace(/\D+/g,'');

  const documento = clean(pick(html,[
    /CPF\/CNPJ do Consumidor[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /CPF do Consumidor[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /CPF:\s*<\/td>\s*<td[^>]*>([^<]+)/i
  ])) || '';

  const dataEm = clean(pick(html,[
    /Data\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})/i,
    /Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})/i,
    /Data\/Hora da Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})/i
  ]));
  const horaEm = clean(pick(html,[
    /Hora\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/i,
    /Data\/Hora da Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/i
  ]));
  const dataISO = toISO(dataEm, horaEm);

  // Valor total (padrões variados)
  const totalRaw = pick(html,[
    /Valor\s*Total[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /Valor a Pagar[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
    /TOTAL\s*R\$\s*([^<]+)/i,
    /Valor\s*Total\s*da\s*Nota[^<]*<\/td>\s*<td[^>]*>([^<]+)/i
  ]);
  const valorTotal = brToNumber(totalRaw) ?? 0;

  const uf = (url.match(/\/\/(\w{2})\./i)||[])[1]?.toUpperCase() || '';
  const chave = (url.match(/chNFe=([\d]{44})/i)||url.match(/p=([\d]{44})/i)||[])[1] || '';

  // Itens — tenta tabela com cabeçalhos comuns; se falhar, usa regex genérica de 4 ou 5 colunas
  const items = [];
  try{
    // Captura blocos <tr> entre seções com "Descrição" e "Vl. Total"
    const headerIdx = html.search(/Descri[cç][aã]o/i);
    const slice = headerIdx>0 ? html.slice(headerIdx) : html;
    const rowRe = /<tr[^>]*>\s*(?:<td[^>]*>)+([\s\S]*?)<\/tr>/ig;
    let m; 
    while ((m = rowRe.exec(slice))!==null){
      const rowHtml = m[1];
      // extrai todas as células
      const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/ig)).map(mm=>clean(mm[1]));
      if (cells.length<4 || cells.length>8) continue;
      // Heurística: descrição = célula com mais letras; valor total = última célula com "R$" ou número
      const valorCand = cells.slice().reverse().find(c=>/[\d,\.]/.test(c));
      const vtot = brToNumber((valorCand||'').replace(/[^\d\.,]/g,''));
      if (vtot==null || vtot<=0) continue;
      const desc = cells.sort((a,b)=>b.length-a.length)[0];
      // quantidade e unidade: procure por números e siglas curtas
      const qtdCand = cells.find(c=>/^(\d+([\.,]\d+)?)$/.test(c)) || cells.find(c=>/^\d+([\.,]\d+)?$/.test(c.replace(',','.')));
      const unCand = cells.find(c=>/^(UN|UND|KG|L|UNID|PC|PÇ|G|ML|CX|FD|SC|DZ|METRO|M|LT)$/i.test(c)) || '';
      const vlUnitCand = cells.find(c=>/^\d{1,3}(\.\d{3})*,\d{2}$/.test(c));
      const q = brToNumber(qtdCand)||1;
      const vu = brToNumber(vlUnitCand) || (q>0? (vtot/q): null);
      items.push({ descricao: desc, quantidade: q, unidade: unCand, valor_unitario: vu, valor_total: vtot });
    }
  }catch(e){}

  return {
    emitente, cnpj, documento, data: dataISO, data_br: dataEm, hora: horaEm,
    uf, chave, valor: valorTotal, items
  };
}

async function processNfceUrl(url){
  let data=null, err1=null;
  try{ data = await fetchNfceViaAppsScriptV3(url); }catch(e){ err1=e; }
  if (!data){
    try{ data = await fetchNfceViaProxy(url); }catch(e){ throw new Error((err1? err1.message+'; ':'') + e.message); }
  }
  // normaliza e salva
  const arr = FinStore.loadReceipts();
  arr.unshift({
    id: crypto.randomUUID(),
    emitente: data.emitente||'',
    cnpj: data.cnpj||'',
    documento: data.documento||'',
    data: data.data || new Date().toISOString(),
    valor: data.valor||0,
    uf: data.uf||'',
    chave: data.chave||'',
    url,
    itens: data.items||data.itens||[]
  });
  FinStore.saveReceipts(arr);
  return arr[0];
}
