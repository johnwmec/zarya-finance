/** Parser NFC-e (Apps Script) */
function doPost(e){
  try{
    var data = JSON.parse(e.postData.contents||'{}');
    var url = data.url;
    if (!url) return _json({error:'missing url'}, 400);
    var resp = UrlFetchApp.fetch(url, {method:'get', muteHttpExceptions:true, followRedirects:true,
      headers:{'User-Agent':'Mozilla/5.0 (Zarya Finance Parser)'}});
    var code = resp.getResponseCode();
    if (code !== 200) return _json({error:'fetch failed', status:code}, code);
    var html = resp.getContentText();

    function pick(text, arr){ for (var i=0;i<arr.length;i++){ var m = arr[i].exec(text); if (m && m[1]) return m[1]; } return ''; }
    function clean(s){ return String(s).replace(/\s+/g,' ').trim(); }

    var emitente = pick(html,[/Raz[aã]o Social<\/td>\s*<td[^>]*>([^<]+)/i,/<span[^>]*class="txtTopo"[^>]*>([^<]+)/i,/<span[^>]*id="u20"[^>]*>([^<]+)/i]);
    var cnpj = pick(html,[/CNPJ<\/td>\s*<td[^>]*>([^<]+)/i,/CNPJ:\s*<\/span>\s*<span[^>]*>([^<]+)/i,/<span[^>]*class="txtTopoCNPJ"[^>]*>([^<]+)/i]);
    if (cnpj) cnpj = cnpj.replace(/\D+/g,'');

    var valor = pick(html,[/Valor\s*Total[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,/Valor\s*total\s*R\$\s*([^<]+)/i,/TOTAL\s*R\$\s*([^<]+)/i]);
    if (valor) valor = parseFloat(valor.replace(/\./g,'').replace(',','.'))||0;

    var dataEm = pick(html,[/Data\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,/Data\s*de\s*Emiss[aã]o:\s*<\/span>\s*<span[^>]*>([^<]+)/i,/Emiss[aã]o:\s*<\/span>\s*<span[^>]*>([^<]+)/i]);
    var uf = pick(url,[/\/\/(\w{2})\./i]); if (uf) uf = uf.toUpperCase();
    var chave = pick(url,[/chNFe=([\d]{44})/i,/p=([\d]{44})/i]);

    var items = [];
    try{
      var itemRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/ig;
      var m;
      while ((m=itemRegex.exec(html))!==null){
        var desc=clean(m[1]); var qtd=parseFloat(clean(m[2]).replace(',','.'))||0; var un=clean(m[3]);
        var vtot=parseFloat(clean(m[4]).replace(/\./g,'').replace(',','.'))||0;
        if (desc && vtot>0) items.push({descricao:desc, quantidade:qtd, unidade:un, valor_total:vtot});
      }
    }catch(err){}

    return _json({emitente:clean(emitente||''), cnpj:cnpj||'', valor:valor||0, data:dataEm||new Date().toISOString(), uf:uf||'', chave:chave||'', items:items}, 200);
  }catch(err){ return _json({error:String(err)}, 500); }
}
function _json(obj, status){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
