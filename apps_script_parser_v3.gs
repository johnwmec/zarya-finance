/** Parser NFC-e — v3 (robusto, multi-portal)
 * Extrai: emitente, cnpj, documento consumidor (CPF/CNPJ), data, hora, uf, chave, valor total e itens detalhados.
 * Normaliza números PT-BR e retorna JSON.
 */
function doPost(e){ var out=_parseV3(e); return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e){ var out=_parseV3(e); return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON); }

function _parseV3(e){
  try{
    var data={};
    if (e && e.postData && e.postData.contents){ try{ data = JSON.parse(e.postData.contents||'{}'); }catch(err){} }
    if ((!data || !data.url) && e && e.parameter && e.parameter.url){ data = data || {}; data.url = e.parameter.url; }
    var url = data && data.url;
    if (!url) return { error:'missing url' };

    var resp = UrlFetchApp.fetch(url, {method:'get', muteHttpExceptions:true, followRedirects:true, headers:{'User-Agent':'Mozilla/5.0 (Zarya Finance Parser v3)'}});
    var code = resp.getResponseCode();
    if (code !== 200) return { error:'fetch failed', status:code };
    var html = resp.getContentText();

    function clean(s){ return String(s||'').replace(/\s+/g,' ').replace(/\u00A0/g,' ').trim(); }
    function pick(text, arr){ for (var i=0;i<arr.length;i++){ var m = arr[i].exec(text); if (m && m[1]) return m[1]; } return ''; }
    function brToNumber(txt){
      if (txt==null) return null;
      var s = String(txt).replace(/\u00A0/g,' ').trim();
      if (!s) return null;
      var n = s.replace(/\./g,'').replace(',','.');
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

    var emitente = clean(pick(html,[
      /Raz[aã]o Social[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /Emitente[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /<span[^>]*class="txtTopo"[^>]*>([^<]+)/i
    ]));

    var cnpj = pick(html,[
      /CNPJ[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /CNPJ:\s*<\/span>\s*<span[^>]*>([^<]+)/i,
      /CNPJ:\s*<\/td>\s*<td[^>]*>([^<]+)/i
    ]);
    cnpj = cnpj ? cnpj.replace(/\D+/g,'') : '';

    var documento = clean(pick(html,[
      /CPF\/CNPJ do Consumidor[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /CPF do Consumidor[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /CPF:\s*<\/td>\s*<td[^>]*>([^<]+)/i
    ])) || '';

    var dataEm = clean(pick(html,[
      /Data\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})/i,
      /Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})/i,
      /Data\/Hora da Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})/i
    ]));
    var horaEm = clean(pick(html,[
      /Hora\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/i,
      /Data\/Hora da Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/i
    ]));
    var dataISO = toISO(dataEm, horaEm);

    var totalRaw = pick(html,[
      /Valor\s*Total[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /Valor a Pagar[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,
      /TOTAL\s*R\$\s*([^<]+)/i,
      /Valor\s*Total\s*da\s*Nota[^<]*<\/td>\s*<td[^>]*>([^<]+)/i
    ]);
    var valorTotal = brToNumber(totalRaw) || 0;

    var uf = (url.match(/\/\/(\w{2})\./i) || [])[1] || '';
    uf = uf ? uf.toUpperCase() : '';
    var chave = (url.match(/chNFe=([\d]{44})/i) || url.match(/p=([\d]{44})/i) || [])[1] || '';

    var items = [];
    try{
      // recorta a partir do cabeçalho "Descrição"
      var headerIdx = html.search(/Descri[cç][aã]o/i);
      var slice = headerIdx>0 ? html.slice(headerIdx) : html;
      var rowRe = /<tr[^>]*>\s*(?:<td[^>]*>)+([\s\S]*?)<\/tr>/ig, m;
      while ((m = rowRe.exec(slice))!==null){
        var rowHtml = m[1];
        var cells = []; var cRe = /<td[^>]*>([\s\S]*?)<\/td>/ig, mm;
        while ((mm = cRe.exec(rowHtml))!==null){ cells.push(clean(mm[1])); }
        if (cells.length<4 || cells.length>8) continue;
        var valorCand = null;
        for (var i=cells.length-1;i>=0;i--){
          if (/[\d,\.]/.test(cells[i])) { valorCand = cells[i]; break; }
        }
        var vtot = brToNumber((valorCand||'').replace(/[^\d\.,]/g,''));
        if (vtot==null || vtot<=0) continue;
        // descrição = mais longa
        var desc = cells.slice().sort(function(a,b){ return b.length-a.length; })[0];
        // quantidade
        var qtdCand = null; for (var j=0;j<cells.length;j++){ if (/^\d+([\.,]\d+)?$/.test(cells[j].replace(',','.'))) { qtdCand = cells[j]; break; } }
        var q = brToNumber(qtdCand) || 1;
        // unidade
        var unCand = ''; for (var k=0;k<cells.length;k++){ if (/^(UN|UND|KG|L|UNID|PC|PÇ|G|ML|CX|FD|SC|DZ|METRO|M|LT)$/i.test(cells[k])) { unCand = cells[k]; break; } }
        // vl unitário
        var vuCand = null; for (var u=0;u<cells.length;u++){ if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cells[u])) { vuCand = cells[u]; break; } }
        var vu = brToNumber(vuCand) || (q>0? (vtot/q): null);
        items.push({ descricao: desc, quantidade: q, unidade: unCand, valor_unitario: vu, valor_total: vtot });
      }
    }catch(err){}

    return { emitente:emitente, cnpj:cnpj, documento:documento, data:dataISO, data_br:dataEm, hora:horaEm, uf:uf, chave:chave, valor:valorTotal, items:items };
  }catch(err){ return { error:String(err) }; }
}
