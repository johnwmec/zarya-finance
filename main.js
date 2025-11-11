
document.addEventListener('DOMContentLoaded', function(){
  try{
    let currentStream=null, currentDeviceId=null, detector=null, zxingReader=null;
    const period = { mode:'month', start:null, end:null };

    function safeSel(id){ return document.getElementById(id); }
    function ensure(el){ if(!el) throw new Error('Elemento não encontrado'); return el; }

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
    const video = ()=>safeSel('video'); const scanStatus=()=>safeSel('scanStatus'); const result=()=>safeSel('result');
    async function listCameras(){ const d=await navigator.mediaDevices.enumerateDevices(); return d.filter(x=>x.kind==='videoinput'); }

    async function startCam(preferBack=true){
      try{
        await ensureDetector();
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: preferBack?{ideal:'environment'}:{ideal:'user'} }, audio:false });
        const v=video(); if(!v) return; v.srcObject=currentStream; await v.play();
        const cams = await listCameras(); const back = cams.find(c=>/back|tr[aá]s|rear/i.test(c.label));
        if (back && preferBack){ await switchToDevice(back.deviceId); }
        if (scanStatus()) scanStatus().textContent = detector ? 'Status: câmera ativa' : 'Status: câmera ativa (sem detector nativo; use Leitor Alternativo)';
        if (detector) loopScan();
      }catch(e){ if (scanStatus()) scanStatus().textContent='Erro: '+e.message; throw e; }
    }
    async function switchToDevice(deviceId){
      stopCam(); currentDeviceId=deviceId;
      try{ currentStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio:false }); const v=video(); if(!v) return; v.srcObject=currentStream; await v.play(); }
      catch(e){ if (scanStatus()) scanStatus().textContent = 'Erro ao trocar câmera: '+e.message; }
    }
    function stopCam(){ if (currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; } if (scanStatus()) scanStatus().textContent='Status: inativo'; }
    async function loopScan(){
      const v=video(); if (!detector || !v || v.readyState<2){ requestAnimationFrame(loopScan); return; }
      try{ const bmp=await createImageBitmap(v); const codes=await detector.detect(bmp); if (codes && codes.length){ const raw=codes[0].rawValue; stopCam(); if (result()) result().textContent='QR detectado: '+raw+'\\nProcessando...'; handleQr(raw); return; } }catch(e){}
      requestAnimationFrame(loopScan);
    }
    async function startZXing(){
      try{
        const ZX = window.ZXing; if (!ZX) throw new Error('Biblioteca ZXing não carregou');
        const { BrowserMultiFormatReader } = ZX;
        zxingReader = new BrowserMultiFormatReader();
        const cams = await zxingReader.listVideoInputDevices();
        let deviceId = cams[0]?.deviceId; const back = cams.find(c=>/back|tr[aá]s|rear/i.test(c.label)); if (back) deviceId=back.deviceId;
        const v=video(); if (!v) return;
        await zxingReader.decodeFromVideoDevice(deviceId, v, (res,err)=>{
          if (res){ zxingReader.reset(); stopCam(); if (result()) result().textContent='QR detectado: '+res.getText()+'\\nProcessando...'; handleQr(res.getText()); }
        });
        if (scanStatus()) scanStatus().textContent='ZXing: leitor alternativo ativo';
      }catch(e){ if (scanStatus()) scanStatus().textContent='ZXing erro: '+e.message; }
    }

    const qs = (sel)=>Array.from(document.querySelectorAll(sel));
    const e_btnStart = safeSel('btnStart');
    const e_btnSwitch = safeSel('btnSwitchCam');
    const e_btnZXing = safeSel('btnZXing');
    const e_btnStop = safeSel('btnStop');
    const e_btnSnap = safeSel('btnSnap');
    const e_btnProcessUrl = safeSel('btnProcessUrl');

    e_btnStart && e_btnStart.addEventListener('click', ()=>startCam(true));
    e_btnSwitch && e_btnSwitch.addEventListener('click', async ()=>{
      const cams = await listCameras(); if (!cams.length) return alert('Nenhuma câmera encontrada');
      const idx = cams.findIndex(c=>c.deviceId===currentDeviceId); const next = cams[(idx+1+cams.length)%cams.length]; switchToDevice(next.deviceId);
    });
    e_btnZXing && e_btnZXing.addEventListener('click', startZXing);
    e_btnStop && e_btnStop.addEventListener('click', stopCam);
    e_btnSnap && e_btnSnap.addEventListener('click', async ()=>{
      const input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='environment';
      input.onchange=async ()=>{ const file=input.files[0]; if (!file) return;
        const blobUrl=URL.createObjectURL(file); const img=new Image(); img.onload=async ()=>{
          try{
            const ZX = window.ZXing; if (ZX){
              const { BrowserMultiFormatReader } = ZX; const r = new BrowserMultiFormatReader();
              const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
              const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0);
              try{ const ls=r.createLuminanceSource(canvas,0,0,canvas.width,canvas.height); const bb=r.createBinaryBitmap(ls); const res=r.decodeBinaryBitmap(bb); if (res){ if (result()) result().textContent='QR detectado: '+res.getText()+'\\nProcessando...'; handleQr(res.getText()); URL.revokeObjectURL(blobUrl); return; } }catch(err){}
            }
            if (!('BarcodeDetector' in window)){ if (result()) result().textContent='Sem ZXing e sem detector nativo. Cole a URL do QR.'; URL.revokeObjectURL(blobUrl); return; }
            const bitmap=await createImageBitmap(img); const codes=await detector.detect(bitmap); URL.revokeObjectURL(blobUrl);
            if (codes && codes.length){ const raw=codes[0].rawValue; if (result()) result().textContent='QR detectado: '+raw+'\\nProcessando...'; handleQr(raw); }
            else if (result()) result().textContent='Nenhum QR detectado na imagem.';
          }catch(e){ if (result()) result().textContent='Erro: '+e.message; }
        }; img.src=blobUrl;
      };
      input.click();
    });
    e_btnProcessUrl && e_btnProcessUrl.addEventListener('click', ()=>{
      const q = document.getElementById('qrUrl').value.trim(); if (!q){ if (result()) result().textContent='Informe a URL do QR.'; return; } handleQr(q);
    });

    async function handleQr(url){
      try{ const rec = await processNfceUrl(url); if (result()) result().textContent='OK! Nota salva:\\n'+JSON.stringify(rec,null,2); refreshReceiptsTable(); }
      catch(e){ if (result()) result().textContent='Falha: '+e.message; throw e; }
    }

    // CONFIG
    const e_btnSaveCfg = safeSel('btnSaveCfg');
    const e_btnClearAll = safeSel('btnClearAll');
    e_btnSaveCfg && e_btnSaveCfg.addEventListener('click', ()=>{
      const endpoint=document.getElementById('endpoint').value.trim(); const uf=document.getElementById('uf').value.trim();
      const mode=document.querySelector('input[name="parserMode"]:checked')?.value || 'apps';
      const cfg=FinStore.loadCfg(); cfg.endpoint=endpoint; cfg.uf=uf; cfg.parserMode=mode; FinStore.saveCfg(cfg);
      const s=document.getElementById('cfgStatus'); if (s) s.textContent='Configurações salvas.';
    });
    e_btnClearAll && e_btnClearAll.addEventListener('click', ()=>{
      if(!confirm('Apagar todos os dados locais?')) return; FinStore.wipe();
      const s=document.getElementById('cfgStatus'); if (s) s.textContent='Dados limpos.'; refreshAll();
    });

    // TABLES & FILTERS
    function refreshReceiptsTable(){
      const arr=FinStore.loadReceipts().filter(r=>inPeriod(r.data, period));
      const tb=document.querySelector('#tblReceipts tbody'); if (!tb) return; tb.innerHTML='';
      for (const r of arr){
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${fmtDate(r.data)}</td><td>${esc(r.emitente||'')}</td><td>R$ ${Number(r.valor||0).toFixed(2)}</td><td>${(r.itens||[]).length}</td><td>${r.uf||''}</td>`;
        tb.appendChild(tr);
      }
    }
    const e_btnRefRec = safeSel('btnRefreshReceipts');
    const e_btnExpRec = safeSel('btnExportReceipts');
    e_btnRefRec && e_btnRefRec.addEventListener('click', refreshReceiptsTable);
    e_btnExpRec && e_btnExpRec.addEventListener('click', ()=>{
      const arr=FinStore.loadReceipts().filter(r=>inPeriod(r.data, period));
      const rows=[['data','emitente','cnpj','valor','uf','chave','url','itens']]; for (const r of arr){ rows.push([r.data,r.emitente,r.cnpj,r.valor,r.uf,r.chave,r.url,(r.itens||[]).length]); }
      exportCSV('receipts.csv', rows);
    });

    const e_btnImp = safeSel('btnImportOfx');
    const e_btnExpTxs = safeSel('btnExportTxs');
    e_btnImp && e_btnImp.addEventListener('click', async ()=>{
      const f=document.getElementById('ofx').files[0]; const st=document.getElementById('ofxStatus'); if(!f){ if(st) st.textContent='Nenhum arquivo selecionado.'; return; }
      const text=await f.text(); const txs=await parseOFX(text); const cur=FinStore.loadTxs(); FinStore.saveTxs([...txs,...cur]); if(st) st.textContent=`Importadas ${txs.length} transações.`; refreshTxs();
    });
    e_btnExpTxs && e_btnExpTxs.addEventListener('click', ()=>{
      const arr=FinStore.loadTxs().filter(t=>inPeriod(t.data, period)); const rows=[['data','descricao','valor','tipo','categoria']];
      for (const t of arr){ rows.push([t.data,t.descricao,t.valor,t.tipo,categorize(t.descricao)]); } exportCSV('transacoes.csv', rows);
    });

    function refreshTxs(){
      const arr=FinStore.loadTxs().filter(t=>inPeriod(t.data, period)); const tb=document.querySelector('#tblTxs tbody'); if(!tb) return; tb.innerHTML='';
      for (const t of arr){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${fmtDate(t.data)}</td><td>${esc(t.descricao||'')}</td><td>R$ ${Number(t.valor||0).toFixed(2)}</td><td>${t.tipo||''}</td>`; tb.appendChild(tr); }
    }

    // Reports
    let chart1=null, chart2=null;
    function renderReports(){
      const c1=document.getElementById('chartMes'); const c2=document.getElementById('chartCat'); if(!c1||!c2) return;
      const ctx1=c1.getContext('2d'); const ctx2=c2.getContext('2d');
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
    const e_btnAddRule = safeSel('btnAddRule');
    e_btnAddRule && e_btnAddRule.addEventListener('click', ()=>{
      const p=document.getElementById('rulePattern').value.trim(); const c=document.getElementById('ruleCat').value.trim(); if(!p||!c) return alert('Preencha padrão e categoria.');
      const rules=FinStore.loadRules(); rules.unshift({pattern:p, categoria:c}); FinStore.saveRules(rules); document.getElementById('rulePattern').value=''; document.getElementById('ruleCat').value=''; renderRulesTable(); renderReports();
    });
    function renderRulesTable(){
      const rules=FinStore.loadRules(); const tb=document.querySelector('#tblRules tbody'); if(!tb) return; tb.innerHTML='';
      rules.forEach((r,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${esc(r.pattern)}</td><td>${esc(r.categoria)}</td><td><button data-i="${idx}" class="btn btnDelRule">Excluir</button></td>`; tb.appendChild(tr); });
      document.querySelectorAll('.btnDelRule').forEach(b=>b.addEventListener('click',(e)=>{ const i=Number(e.target.getAttribute('data-i')); const arr=FinStore.loadRules(); arr.splice(i,1); FinStore.saveRules(arr); renderRulesTable(); renderReports(); }));
    }

    // helpers
    function fmtDate(s){ const d=new Date(s); return isNaN(d)? s : d.toLocaleString(); }
    function esc(s){ return String(s).replace(/[&<>\"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;' }[m])); }
    function refreshAll(){ try{ refreshReceiptsTable(); refreshTxs(); if (document.getElementById('reports')?.classList.contains('active')) renderReports(); }catch(e){ console.error(e); } }

    // init
    (function init(){
      try{
        const cfg=FinStore.loadCfg(); const ep=document.getElementById('endpoint'); if (ep) ep.value=cfg.endpoint||'';
        const uf=document.getElementById('uf'); if (uf) uf.value=cfg.uf||'MG';
        const mode=cfg.parserMode||'apps'; const radio=document.querySelector(`input[name="parserMode"][value="${mode}"]`); if(radio) radio.checked=true;
        if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
        refreshAll(); renderRulesTable();
      }catch(e){ console.error(e); }
    })();
  }catch(err){ console.error(err); throw err; }
});
