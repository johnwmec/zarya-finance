
async function parseOFX(text){
  const txs = []; const lines = text.split(/\r?\n/); let cur = {};
  for (let raw of lines){
    const line = raw.trim();
    if (line.startsWith('<STMTTRN>')) cur = {};
    else if (line.startsWith('<TRNTYPE>')) cur.tipo = line.substring(9).toUpperCase().includes('DEBIT')?'DEBITO':'CREDITO';
    else if (line.startsWith('<DTPOSTED>')) cur.data = line.substring(10);
    else if (line.startsWith('<TRNAMT>')) cur.valor = parseFloat(line.substring(8));
    else if (line.startsWith('<MEMO>')) cur.descricao = line.substring(6);
    else if (line.startsWith('</STMTTRN>')) { const iso = ofxDateToISO(cur.data); txs.push({ data: iso, descricao: cur.descricao||'', valor: cur.valor||0, tipo: cur.tipo||'DEBITO' }); cur = {}; }
  }
  return txs;
}
function ofxDateToISO(s){ if (!s) return null; const y=s.slice(0,4),m=s.slice(4,6),d=s.slice(6,8),hh=s.slice(8,10)||'00',mm=s.slice(10,12)||'00',ss=s.slice(12,14)||'00'; return `${y}-${m}-${d}T${hh}:${mm}:${ss}`; }
