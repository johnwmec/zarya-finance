
let currentStream=null, currentDeviceId=null, detector=null, zxingReader=null;
const period = { mode:'month', start:null, end:null };

function switchTab(id){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('main section').forEach(s=>s.classList.toggle('active', s.id===id));
  if (id==='reports') renderReports();
}
document.addEventListener('click',(e)=>{
  const t=e.target;
  if (t.matches('nav button')) switchTab(t.dataset.tab);
  if (t.id==='chipMonth'){ period.mode='month'; refreshAll(); }
  if (t.id==='chip30'){ period.mode='last30'; refreshAll(); }
  if (t.id==='chipYear'){ period.mode='year'; refreshAll(); }
});
async function ensureDetector(){ if ('BarcodeDetector' in window){ detector = new BarcodeDetector({ formats: ['qr_code'] }); } else detector=null; return detector; }
const video = ()=>document.getElementById('video'); const scanStatus=()=>document.getElementById('scanStatus'); const result=()=>document.getElementById('result');
async function listCameras(){ const d=await navigator.mediaDevices.enumerateDevices(); return d.filter(x=>x.kind==='videoinput'); }

async function startCam(preferBack=true){
  try{
    await ensureDetector();
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: preferBack?{ideal:'environment'}:{ideal:'user'} }, audio:false });
    const v=video(); v.srcObject=currentStream; await v.play();
    const cams = await listCameras(); const back = cams.find(c=>/back|tr[aá]s|rear/i.test(c.label));
    if (back && preferBack){ await switchToDevice(back.deviceId); }
    scanStatus().textContent = detector ? 'Status: câmera ativa' : 'Status: câmera ativa (sem detector nativo; use Leitor Alternativo)';
    if (detector) loopScan();
  }catch(e){ scanStatus().textContent='Erro: '+e.message; }
}
async function switchToDevice(deviceId){
  stopCam(); currentDeviceId=deviceId;
  try{ currentStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio:false }); const v=video(); v.srcObject=currentStream; await v.play(); }
  catch(e){ scanStatus().textContent = 'Erro ao trocar câmera: '+e.message; }
}
function stopCam(){ if (currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; } scanStatus().textContent='Status: inativo'; }
async function loopScan(){
  const v=video(); if (!detector || !v || v.readyState<2){ requestAnimationFrame(loopScan); return; }
  try{ const bmp=await createImageBitmap(v); const codes=await detector.detect(bmp); if (codes && codes.length){ const raw=codes[0].rawValue; stopCam(); result().textContent='QR detectado: '+raw+'\nProcessando...'; handleQr(raw); return; } }catch(e){}
  requestAnimationFrame(loopScan);
}
// ZXing
async function startZXing(){
  try{
    const { BrowserMultiFormatReader } = window.ZXing;
    zxingReader = new BrowserMultiFormatReader();
    const cams = await zxingReader.listVideoInputDevices();
    let deviceId = cams[0]?.deviceId; const back = cams.find(c=>/back|tr[aá]s|rear/i.test(c.label)); if (back) deviceId=back.deviceId;
    const v=video();
    await zxingReader.decodeFromVideoDevice(deviceId, v, (res,err)=>{
      if (res){ zxingReader.reset(); stopCam(); result().textContent='QR detectado: '+res.getText()+'\nProcessando...'; handleQr(res.getText()); }
    });
    scanStatus().textContent='ZXing: leitor alternativo ativo';
  }catch(e){ scanStatus().textContent='ZXing erro: '+e.message; }
}
document.getElementById('btnStart').addEventListener('click', ()=>startCam(true));
document.getElementById('btnSwitchCam').addEventListener('click', async ()=>{
  const cams = await listCameras(); if (!cams.length) return alert('Nenhuma câmera encontrada');
  const idx = cams.findIndex(c=>c.deviceId===currentDeviceId); const next = cams[(idx+1)%cams.length]; switchToDevice(next.deviceId);
});
document.getElementById('btnZXing').addEventListener('click', startZXing);
document.getElementById('btnStop').addEventListener('click', stopCam);
document.getElementById('btnSnap').addEventListener('click', async ()=>{
  const input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='environment';
  input.onchange=async ()=>{ const file=input.files[0]; if (!file) return;
    const blobUrl=URL.createObjectURL(file); const img=new Image(); img.onload=async ()=>{
      try{ const code=await decodeImageZXing(img); if (code){ result().textContent='QR detectado: '+code+'\nProcessando...'; handleQr(code); URL.revokeObjectURL(blobUrl); return; } }catch(e){}
      if (!('BarcodeDetector' in window)){ result().textContent='Sem ZXing e sem detector nativo. Cole a URL do QR.'; URL.revokeObjectURL(blobUrl); return; }
      const bitmap=await createImageBitmap(img); const codes=await detector.detect(bitmap); URL.revokeObjectURL(blobUrl);
      if (codes && codes.length){ const raw=codes[0].rawValue; result().textContent='QR detectado: '+raw+'\nProcessando...'; handleQr(raw); }
      else result().textContent='Nenhum QR detectado na imagem.';
    }; img.src=blobUrl; };
  input.click();
});
async function decodeImageZXing(img){
  return new Promise((resolve)=>{
    try{
      const { BrowserMultiFormatReader } = window.ZXing; const r = new BrowserMultiFormatReader();
      const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0);
      const ls=r.createLuminanceSource(canvas,0,0,canvas.width,canvas.height); const bb=r.createBinaryBitmap(ls); const res=r.decodeBinaryBitmap(bb); resolve(res.getText());
    }catch(e){ resolve(null); }
  });
}
async function handleQr(url){
  try{ const rec = await processNfceUrl(url); result().textContent='OK! Nota salva:\n'+JSON.stringify(rec,null,2); refreshReceiptsTable(); }
  catch(e){ result().textContent='Falha: '+e.message; }
}
document.getElementById('btnProcessUrl').addEventListener('click', ()=>{ const url=document.getElementById('qrUrl').value.trim(); if(!url){ result().textContent='Informe a URL do QR.'; return;} handleQr(url); });

// CONFIG
document.getElementById('btnSaveCfg').addEventListener('click', ()=>{
  const endpoint=document.getElementById('endpoint').value.trim(); const uf=document.getElementById('uf').value.trim();
  const mode=document.querySelector('input[name="parserMode"]:checked')?.value || 'apps';
  const cfg=FinStore.loadCfg(); cfg.endpoint=endpoint; cfg.uf=uf; cfg.parserMode=mode; FinStore.saveCfg(cfg);
  document.getElementById('cfgStatus').textContent='Configurações salvas.';
});
document.getElementById('btnClearAll').addEventListener('click', ()=>{ if(!confirm('Apagar todos os dados locais?')) return; FinStore.wipe(); document.getElementById('cfgStatus').textContent='Dados limpos.'; refreshAll(); });

// TABLES & FILTERS
function refreshReceiptsTable(){
  const arr=FinStore.loadReceipts().filter(r=>inPeriod(r.data, period));
  const tb=document.querySelector('#tblReceipts tbody'); tb.innerHTML='';
  for (const r of arr){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmtDate(r.data)}</td><td>${esc(r.emitente||'')}</td><td>R$ ${Number(r.valor||0).toFixed(2)}</td><td>${(r.itens||[]).length}</td><td>${r.uf||''}</td>`;
    tb.appendChild(tr);
  }
}
document.getElementById('btnRefreshReceipts').addEventListener('click', refreshReceiptsTable);
document.getElementById('btnExportReceipts').addEventListener('click', ()=>{
  const arr=FinStore.loadReceipts().filter(r=>inPeriod(r.data, period));
  const rows=[['data','emitente','cnpj','valor','uf','chave','url','itens']]; for (const r of arr){ rows.push([r.data,r.emitente,r.cnpj,r.valor,r.uf,r.chave,r.url,(r.itens||[]).length]); }
  exportCSV('receipts.csv', rows);
});
document.getElementById('btnImportOfx').addEventListener('click', async ()=>{
  const f=document.getElementById('ofx').files[0]; if(!f){ document.getElementById('ofxStatus').textContent='Nenhum arquivo selecionado.'; return; }
  const text=await f.text(); const txs=await parseOFX(text); const cur=FinStore.loadTxs(); FinStore.saveTxs([...txs,...cur]); document.getElementById('ofxStatus').textContent=`Importadas ${txs.length} transações.`; refreshTxs();
});
document.getElementById('btnExportTxs').addEventListener('click', ()=>{
  const arr=FinStore.loadTxs().filter(t=>inPeriod(t.data, period)); const rows=[['data','descricao','valor','tipo','categoria']];
  for (const t of arr){ rows.push([t.data,t.descricao,t.valor,t.tipo,categorize(t.descricao)]); } exportCSV('transacoes.csv', rows);
});
function refreshTxs(){
  const arr=FinStore.loadTxs().filter(t=>inPeriod(t.data, period)); const tb=document.querySelector('#tblTxs tbody'); tb.innerHTML='';
  for (const t of arr){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${fmtDate(t.data)}</td><td>${esc(t.descricao||'')}</td><td>R$ ${Number(t.valor||0).toFixed(2)}</td><td>${t.tipo||''}</td>`; tb.appendChild(tr); }
}
// Reports
let chart1=null, chart2=null;
function renderReports(){
  const ctx1=document.getElementById('chartMes').getContext('2d'); const ctx2=document.getElementById('chartCat').getContext('2d');
  const txs=FinStore.loadTxs().filter(t=>inPeriod(t.data, period));
  const byMonth={}, byCat={};
  txs.forEach(t=>{ if (t.tipo!=='DEBITO') return; const d=new Date(t.data); if (isNaN(d)) return; const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; byMonth[k]=(byMonth[k]||0)+Math.abs(t.valor||0); const cat=categorize(t.descricao); byCat[cat]=(byCat[cat]||0)+Math.abs(t.valor||0); });
  const labelsM=Object.keys(byMonth).sort(); const dataM=labelsM.map(k=>Number(byMonth[k].toFixed(2)));
  const labelsC=Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]); const dataC=labelsC.map(k=>Number(byCat[k].toFixed(2)));
  if (chart1) chart1.destroy(); if (chart2) chart2.destroy();
  chart1=new Chart(ctx1,{type:'bar',data:{labels:labelsM,datasets:[{label:'Despesas por mês (R$)',data:dataM}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
  chart2=new Chart(ctx2,{type:'doughnut',data:{labels:labelsC,datasets:[{data:dataC}]} });
}
// Rules
document.getElementById('btnAddRule').addEventListener('click', ()=>{
  const p=document.getElementById('rulePattern').value.trim(); const c=document.getElementById('ruleCat').value.trim(); if(!p||!c) return alert('Preencha padrão e categoria.');
  const rules=FinStore.loadRules(); rules.unshift({pattern:p, categoria:c}); FinStore.saveRules(rules); document.getElementById('rulePattern').value=''; document.getElementById('ruleCat').value=''; renderRulesTable(); renderReports();
});
function renderRulesTable(){
  const rules=FinStore.loadRules(); const tb=document.querySelector('#tblRules tbody'); tb.innerHTML='';
  rules.forEach((r,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${esc(r.pattern)}</td><td>${esc(r.categoria)}</td><td><button data-i="${idx}" class="btn btnDelRule">Excluir</button></td>`; tb.appendChild(tr); });
  document.querySelectorAll('.btnDelRule').forEach(b=>b.addEventListener('click',(e)=>{ const i=Number(e.target.getAttribute('data-i')); const arr=FinStore.loadRules(); arr.splice(i,1); FinStore.saveRules(arr); renderRulesTable(); renderReports(); }));
});
// helpers
function fmtDate(s){ const d=new Date(s); return isNaN(d)? s : d.toLocaleString(); }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function refreshAll(){ refreshReceiptsTable(); refreshTxs(); if (document.getElementById('reports').classList.contains('active')) renderReports(); }
// init
(function init(){ const cfg=FinStore.loadCfg(); document.getElementById('endpoint').value=cfg.endpoint||''; document.getElementById('uf').value=cfg.uf||'MG'; const mode=cfg.parserMode||'apps'; const radio=document.querySelector(`input[name="parserMode"][value="${mode}"]`); if(radio) radio.checked=true; if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); } refreshAll(); renderRulesTable(); })();
