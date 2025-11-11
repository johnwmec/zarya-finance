
function doPost(e){ var raw=(e && e.parameter && e.parameter.raw)||''; var out=_parseV3(e, raw); return _out(out, raw); }
function doGet(e){ var raw=(e && e.parameter && e.parameter.raw)||''; var out=_parseV3(e, raw); return _out(out, raw); }
function _out(out, raw){ if (raw){ return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.TEXT); } return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON); }
function _parseV3(e, raw){
  try{
    var data={};
    if (e && e.postData && e.postData.contents){ try{ data = JSON.parse(e.postData.contents||'{}'); }catch(err){} }
    if ((!data || !data.url) && e && e.parameter && e.parameter.url){ data = data || {}; data.url = e.parameter.url; }
    var url = data && data.url; if (!url) return raw? '': { error:'missing url' };
    var resp = UrlFetchApp.fetch(url, {method:'get', muteHttpExceptions:true, followRedirects:true, headers:{'User-Agent':'Mozilla/5.0 (Zarya Finance Parser v3)'}});
    var code = resp.getResponseCode(); if (code !== 200) return raw? '' : { error:'fetch failed', status:code };
    var html = resp.getContentText();
    if (raw) return html;
    return { ok:true, note:'Use o parser DOM no cliente (nfce.js) para extrair itens.' };
  }catch(err){ return raw? '' : { error:String(err) }; }
}
