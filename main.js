// Tabs
function switchTab(id){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('main section').forEach(s=>s.classList.toggle('active', s.id===id));
  if (id==='reports') renderReports();
}
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

// -------- Persistência de Config --------
function loadCfgIntoUI(){
  const cfg = FinStore.loadCfg();
  const ep = document.getElementById('endpoint'); if (ep) ep.value = cfg.endpoint||'';
  const uf = document.getElementById('uf'); if (uf) uf.value = cfg.uf||'MG';
}
function saveCfgFromUI(){
  const endpoint = (document.getElementById('endpoint')?.value||'').trim();
  const uf = (document.getElementById('uf')?.value||'MG').trim();
  const cfg = FinStore.loadCfg();
  cfg.endpoint = endpoint; cfg.uf = uf;
  FinStore.saveCfg(cfg);
  toast('Configurações salvas.', 'ok');
}
function clearAllLocal(){
  FinStore.wipe();
  refreshReceiptsTable(); refreshTxs(); renderRulesTable(); renderReports();
  loadCfgIntoUI();
  toast('Todos os dados locais foram apagados.', 'ok');
}
document.getElementById('btnSaveCfg').addEventListener('click', saveCfgFromUI);
document.getElementById('btnClearAll').addEventListener('click', clearAllLocal);

// -------- Regras --------
document.getElementById('btnAddRule').addEventListener('click', ()=>{
  const p = document.getElementById('rulePattern').value.trim();
  const c = document.getElementById('ruleCat').value.trim();
  if (!p || !c) return alert('Preencha padrão e categoria.');
  const rules = FinStore.loadRules(); rules.unshift({pattern:p, categoria:c});
  FinStore.saveRules(rules);
  document.getElementById('rulePattern').value = '';
  document.getElementById('ruleCat').value = '';
  renderRulesTable(); renderReports();
});
function renderRulesTable(){
  const rules = FinStore.loadRules();
  const tb = document.querySelector('#tblRules tbody');
  tb.innerHTML = '';
  rules.forEach((r,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(r.pattern)}</td><td>${esc(r.categoria)}</td>
      <td><button data-i="${idx}" class="btn btnDelRule">Excluir</button></td>`;
    tb.appendChild(tr);
  });
  document.querySelectorAll('.btnDelRule').forEach(b=>b.addEventListener('click',(e)=>{
    const i = Number(e.target.getAttribute('data-i'));
    const arr = FinStore.loadRules(); arr.splice(i,1); FinStore.saveRules(arr);
    renderRulesTable(); renderReports();
  }));
}

// -------- Leitor QR alternativo (html5-qrcode) --------
let qrScanner = null;
async function startHtml5Qrcode(){
  try{
    if (qrScanner){ await qrScanner.stop(); qrScanner=null; }
    const elemId = "qr-reader";
    qrScanner = new Html5Qrcode(elemId);
    const config = { fps: 15, qrbox: { width: 250, height: 250 }, formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ] };
    const cameras = await Html5Qrcode.getCameras();
    const cameraId = cameras?.[0]?.id || undefined;
    await qrScanner.start(
      cameraId,
      config,
      async (decodedText) => {
        setScanStatus('QR detectado. Processando…');
        await handleQr(decodedText);
      },
      (errMsg) => { /* ignore continuous errors */ }
    );
    setScanStatus('Leitor ativo');
  }catch(e){
    setScanStatus('Erro no leitor: '+e.message, true);
  }
}
async function stopHtml5Qrcode(){
  try{
    if (qrScanner){ await qrScanner.stop(); await qrScanner.clear(); qrScanner=null; }
    setScanStatus('Status: inativo');
  }catch(e){
    setScanStatus('Falha ao parar leitor: '+e.message, true);
  }
}
function setScanStatus(msg, isErr=false){
  const el = document.getElementById('scanStatus'); if (!el) return;
  el.innerHTML = (isErr?'<span class="err">':'<span class="ok">')+esc(msg)+'</span>';
}
document.getElementById('btnStartQR').addEventListener('click', startHtml5Qrcode);
document.getElementById('btnStopQR').addEventListener('click', stopHtml5Qrcode);

// -------- Processar URL colada --------
document.getElementById('btnProcessUrl').addEventListener('click', ()=>{
  const url = document.getElementById('qrUrl').value.trim();
  if (!url){ toast('Informe a URL do QR.', 'err'); return; }
  handleQr(url);
});

// -------- Tabelas / CSV --------
function refreshReceiptsTable(){
  const arr = FinStore.loadReceipts();
  const tb = document.querySelector('#tblReceipts tbody');
  const empty = document.getElementById('emptyReceipts');
  tb.innerHTML = '';
  if (!arr.length){ if (empty) empty.style.display='block'; return; }
  if (empty) empty.style.display='none';
  for (const r of arr){
    const tr = document.createElement('tr');
    const itens = (r.itens||[]).length;
    tr.innerHTML = `<td>${fmtDate(r.data)}</td>
      <td>${esc(r.emitente||'')}</td>
      <td>R$ ${Number(r.valor||0).toFixed(2)}</td>
      <td>${itens}</td>
      <td>${r.uf||''}</td>`;
    tb.appendChild(tr);
  }
}
document.getElementById('btnRefreshReceipts').addEventListener('click', refreshReceiptsTable);
document.getElementById('btnExportReceipts').addEventListener('click', ()=>{
  const arr = FinStore.loadReceipts();
  const rows = [['data','emitente','cnpj','valor','uf','chave','url','itens']];
  for (const r of arr){ rows.push([r.data, r.emitente, r.cnpj, r.valor, r.uf, r.chave, r.url, (r.itens||[]).length]); }
  exportCSV('receipts.csv', rows);
});

document.getElementById('btnImportOfx').addEventListener('click', async ()=>{
  const f = document.getElementById('ofx').files[0];
  if (!f){ document.getElementById('ofxStatus').textContent = 'Nenhum arquivo selecionado.'; return; }
  const text = await f.text();
  const txs = await parseOFX(text);
  const cur = FinStore.loadTxs();
  FinStore.saveTxs([...txs, ...cur]);
  document.getElementById('ofxStatus').textContent = `Importadas ${txs.length} transações.`;
  refreshTxs(); renderReports();
});
document.getElementById('btnExportTxs').addEventListener('click', ()=>{
  const arr = FinStore.loadTxs();
  const rows = [['data','descricao','valor','tipo','categoria']];
  for (const t of arr){ rows.push([t.data, t.descricao, t.valor, t.tipo, categorize(t.descricao)]); }
  exportCSV('transacoes.csv', rows);
});
function refreshTxs(){
  const arr = FinStore.loadTxs();
  const tb = document.querySelector('#tblTxs tbody');
  const empty = document.getElementById('emptyTxs');
  tb.innerHTML = '';
  if (!arr.length){ if (empty) empty.style.display='block'; return; }
  if (empty) empty.style.display='none';
  for (const t of arr){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(t.data)}</td>
      <td>${esc(t.descricao||'')}</td>
      <td>R$ ${Number(t.valor||0).toFixed(2)}</td>
      <td>${t.tipo||''}</td>`;
    tb.appendChild(tr);
  }
}

// -------- RELATÓRIOS --------
let chart1=null, chart2=null;
function renderReports(){
  const ctx1 = document.getElementById('chartMes')?.getContext('2d');
  const ctx2 = document.getElementById('chartCat')?.getContext('2d');
  if (!ctx1 || !ctx2) return;
  const txs = FinStore.loadTxs();

  const byMonth = {};
  txs.forEach(t=>{
    if (t.tipo!=='DEBITO') return;
    const d = new Date(t.data); if (isNaN(d)) return;
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    byMonth[k] = (byMonth[k]||0) + Math.abs(t.valor||0);
  });
  const labelsM = Object.keys(byMonth).sort();
  const dataM = labelsM.map(k=>Number(byMonth[k].toFixed(2)));

  const byCat = {};
  txs.forEach(t=>{
    if (t.tipo!=='DEBITO') return;
    const cat = categorize(t.descricao);
    byCat[cat] = (byCat[cat]||0) + Math.abs(t.valor||0);
  });
  const labelsC = Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]);
  const dataC = labelsC.map(k=>Number(byCat[k].toFixed(2)));

  if (chart1) chart1.destroy();
  if (chart2) chart2.destroy();
  chart1 = new Chart(ctx1, { type:'bar', data:{ labels: labelsM, datasets:[{ label:'Despesas por mês (R$)', data: dataM }] }, options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }});
  chart2 = new Chart(ctx2, { type:'doughnut', data:{ labels: labelsC, datasets:[{ data: dataC }] }, options:{} });
}

// -------- QR → Parser --------
async function handleQr(url){
  try{
    const rec = await processNfceUrl(url);
    document.getElementById('result').textContent = 'OK! Nota salva:\n'+JSON.stringify(rec, null, 2);
    refreshReceiptsTable();
    toast('Nota importada com sucesso!', 'ok');
  }catch(e){
    document.getElementById('result').textContent = 'Falha: '+e.message;
    toast('Erro ao processar QR/URL: '+e.message, 'err');
  }
}

// -------- Helpers comuns --------
function fmtDate(s){ const d = new Date(s); return isNaN(d)? s : d.toLocaleString(); }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function toast(msg, mode='ok'){
  const p = document.createElement('div');
  p.textContent = msg;
  p.style.position='fixed'; p.style.bottom='16px'; p.style.left='50%'; p.style.transform='translateX(-50%)';
  p.style.padding='10px 14px'; p.style.borderRadius='12px'; p.style.zIndex='9999';
  p.style.border='1px solid ' + (mode==='ok'?'#2c7a2c':'#7a2c2c');
  p.style.background= mode==='ok'?'rgba(26,40,26,.95)':'rgba(40,26,26,.95)';
  p.style.color= '#fff'; p.style.boxShadow='0 10px 30px rgba(0,0,0,.35)';
  document.body.appendChild(p); setTimeout(()=>p.remove(), 2200);
}

// -------- Init --------
(function init(){
  if ('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
  loadCfgIntoUI();
  renderRulesTable();
  refreshReceiptsTable();
  refreshTxs();
})();
