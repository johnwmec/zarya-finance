/** Parser NFC-e — v2.1 (idêntico ao v2) */
function doPost(e){ var out=_parse(e); return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e){ var out=_parse(e); return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON); }
function _parse(e){
  try{
    var data={}; if(e&&e.postData&&e.postData.contents){ data=JSON.parse(e.postData.contents||'{}'); } else if(e&&e.parameter&&e.parameter.url){ data.url=e.parameter.url; }
    var url=data.url; if(!url) return {error:'missing url'};
    var resp=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':'Mozilla/5.0 (Zarya Finance Parser)'}});
    var code=resp.getResponseCode(); if(code!==200) return {error:'fetch failed',status:code}; var html=resp.getContentText();
    function pick(text,arr){ for (var i=0;i<arr.length;i++){ var m=arr[i].exec(text); if(m&&m[1]) return m[1]; } return ''; }
    function clean(s){ return String(s).replace(/\s+/g,' ').trim(); }
    var emitente=pick(html,[/Raz[aã]o Social<\/td>\s*<td[^>]*>([^<]+)/i,/<span[^>]*class="txtTopo"[^>]*>([^<]+)/i]);
    var cnpj=pick(html,[/CNPJ<\/td>\s*<td[^>]*>([^<]+)/i,/CNPJ:\s*<\/span>\s*<span[^>]*>([^<]+)/i]); if(cnpj) cnpj=cnpj.replace(/\D+/g,'');
    var valor=pick(html,[/Valor\s*Total[^<]*<\/td>\s*<td[^>]*>([^<]+)/i,/TOTAL\s*R\$\s*([^<]+)/i]); if(valor) valor=parseFloat(valor.replace(/\./g,'').replace(',','.'))||0;
    var dataEm=pick(html,[/Data\s*de\s*Emiss[aã]o[^<]*<\/td>\s*<td[^>]*>([^<]+)/i]);
    var uf=pick(url,[/\/\/(\w{2})\./i]); if(uf) uf=uf.toUpperCase();
    var chave=pick(url,[/chNFe=([\d]{44})/i,/p=([\d]{44})/i]);
    var items=[]; try{ var re=/<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/ig; var m; while((m=re.exec(html))!==null){ var desc=clean(m[1]); var qtd=parseFloat(clean(m[2]).replace(',','.'))||0; var un=clean(m[3]); var v=parseFloat(clean(m[4]).replace(/\./g,'').replace(',','.'))||0; if(desc&&v>0) items.push({descricao:desc, quantidade:qtd, unidade:un, valor_total:v}); } }catch(err){}
    return {emitente:clean(emitente||''), cnpj:cnpj||'', valor:valor||0, data:dataEm||new Date().toISOString(), uf:uf||'', chave:chave||'', items:items};
  }catch(err){ return {error:String(err)}; }
}
