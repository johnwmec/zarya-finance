let currentStream = null;
let detector = null;

function switchTab(id){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('main section').forEach(s=>s.classList.toggle('active', s.id===id));
  if (id==='reports') renderReports();
}

document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

async function ensureDetector(){
  if ('BarcodeDetector' in window){ detector = new BarcodeDetector({ formats: ['qr_code'] }); }
  else detector = null;
  return detector;
}

const video = document.getElementById('video');
const scanStatus = document.getElementById('scanStatus');
const result = document.getElementById('result');

async function startCam(){
  try{
    await ensureDetector();
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = currentStream; await video.play();
    scanStatus.textContent = detector ? 'Status: câmera ativa' : 'Status: câmera ativa (sem detector nativo; use foto/cole URL)';
    if (detector) loopScan();
  }catch(e){ scanStatus.textContent = 'Erro: '+e.message; }
}

function stopCam(){
  if (currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; }
  scanStatus.textContent = 'Status: inativo';
}

async function loopScan(){
  if (!detector || !video || video.readyState < 2) { requestAnimationFrame(loopScan); return; }
  try{
    const bitmap = await createImageBitmap(video);
    const codes = await detector.detect(bitmap);
    if (codes && codes.length){
      const raw = codes[0].rawValue; stopCam();
      result.textContent = 'QR detectado: '+raw+'\nProcessando...'; handleQr(raw); return;
    }
  }catch(e){}
  requestAnimationFrame(loopScan);
}

async function handleQr(url){
  try{ const rec = await processNfceUrl(url);
    result.textContent = 'OK! Nota salva:\n'+JSON.stringify(rec, null, 2);
    refreshReceiptsTable();
  }catch(e){ result.textContent = 'Falha: '+e.message; }
}

document.getElementById('btnStart').addEventListener('click', startCam);
document.getElementById('btnStop').addEventListener('click', stopCam);

document.getElementById('btnSnap').addEventListener('click', async ()=>{
  try{
    const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='environment';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      if (!('BarcodeDetector' in window)){ result.textContent='Navegador sem detector nativo. Cole a URL do QR.'; return; }
      const blobUrl = URL.createObjectURL(file);
      const img = new Image(); img.onload = async () => {
        const bitmap = await createImageBitmap(img);
        const codes = await detector.detect(bitmap); URL.revokeObjectURL(blobUrl);
        if (codes && codes.length){ const raw = codes[0].rawValue; result.textContent='QR detectado: '+raw+'\nProcessando...'; handleQr(raw); }
        else result.textContent = 'Nenhum QR detectado na imagem.';
      }; img.src = blobUrl;
    };
    input.click();
  }catch(e){ result.textContent = 'Erro ao capturar imagem: '+e.message; }
});

document.getElementById('btnProcessUrl').addEventListener('click', ()=>{
  const url = document.getElementById('qrUrl').value.trim();
  if (!url){ result.textContent = 'Informe a URL do QR.'; return; }
  handleQr(url);
});

function refreshReceiptsTable(){
  const arr = FinStore.loadReceipts();
  const tb = document.querySelector('#tblReceipts tbody');
  tb.innerHTML = '';
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
  refreshTxs();
});

document.getElementById('btnExportTxs').addEventListener('click', ()=>{
  const arr = FinStore.loadTxs();
  const rows = [['data','descricao','valor','tipo','categoria']];
  for (const t of arr){
    rows.push([t.data, t.descricao, t.valor, t.tipo, categorize(t.descricao)]);
  }
  exportCSV('transacoes.csv', rows);
});

function refreshTxs(){
  const arr = FinStore.loadTxs();
  const tb = document.querySelector('#tblTxs tbody');
  tb.innerHTML = '';
  for (const t of arr){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(t.data)}</td>
      <td>${esc(t.descricao||'')}</td>
      <td>R$ ${Number(t.valor||0).toFixed(2)}</td>
      <td>${t.tipo||''}</td>`;
    tb.appendChild(tr);
  }
}

// Reports
let chart1=null, chart2=null;
function renderReports(){
  const ctx1 = document.getElementById('chartMes').getContext('2d');
  const ctx2 = document.getElementById('chartCat').getContext('2d');
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

// Rules
document.getElementById('btnAddRule').addEventListener('click', ()=>{
  const p = document.getElementById('rulePattern').value.trim();
  const c = document.getElementById('ruleCat').value.trim();
  if (!p || !c) return alert('Preencha padrão e categoria.');
  const rules = FinStore.loadRules(); rules.unshift({pattern:p, categoria:c});
  FinStore.saveRules(rules);
  document.getElementById('rulePattern').value='';
  document.getElementById('ruleCat').value='';
  renderRulesTable();
  renderReports();
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

// helpers
function fmtDate(s){ const d = new Date(s); return isNaN(d)? s : d.toLocaleString(); }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

(function init(){
  const cfg = FinStore.loadCfg();
  const ep = document.getElementById('endpoint'); if (ep) ep.value = cfg.endpoint||'';
  const uf = document.getElementById('uf'); if (uf) uf.value = cfg.uf||'MG';
  if ('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
  refreshReceiptsTable(); refreshTxs(); renderRulesTable();
})();
