
document.addEventListener('DOMContentLoaded', function(){
  try{
    var boot = document.getElementById('boot'); if (boot) boot.textContent = 'Zarya Finance v2.6.0 — pronto';
    var currentStream=null, currentDeviceId=null, detector=null, zxingReader=null;
    var period = { mode:'month' };

    function switchTab(id){
      document.querySelectorAll('nav button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===id); });
      document.querySelectorAll('main section').forEach(function(s){ s.classList.toggle('active', s.id===id); });
    }
    document.addEventListener('click', function(e){
      var t=e.target;
      if (t.matches && t.matches('nav button')) switchTab(t.getAttribute('data-tab'));
      if (t.id==='chipMonth'){ period.mode='month'; refreshReceiptsTable(); }
      if (t.id==='chip30'){ period.mode='last30'; refreshReceiptsTable(); }
      if (t.id==='chipYear'){ period.mode='year'; refreshReceiptsTable(); }
    });

    function ensureDetector(){ if ('BarcodeDetector' in window){ detector = new BarcodeDetector({ formats: ['qr_code'] }); } else detector=null; return detector; }
    function video(){ return document.getElementById('video'); }
    function scanStatus(){ return document.getElementById('scanStatus'); }
    function result(){ return document.getElementById('result'); }

    function listCameras(){ return navigator.mediaDevices.enumerateDevices().then(function(d){ return d.filter(function(x){ return x.kind==='videoinput'; }); }); }
    function stopCam(){ if (currentStream){ currentStream.getTracks().forEach(function(t){ t.stop(); }); currentStream=null; } var st=scanStatus(); if (st) st.textContent='Status: inativo'; }

    function loopScan(){
      var v=video(); if (!detector || !v || v.readyState<2){ requestAnimationFrame(loopScan); return; }
      createImageBitmap(v).then(function(bmp){
        detector.detect(bmp).then(function(codes){
          if (codes && codes.length){ var raw=codes[0].rawValue; stopCam(); if (result()) result().textContent='QR: '+raw+'\nProcessando...'; handleQr(raw); }
          else requestAnimationFrame(loopScan);
        }).catch(function(){ requestAnimationFrame(loopScan); });
      }).catch(function(){ requestAnimationFrame(loopScan); });
    }

    function startCam(preferBack){
      if (preferBack===undefined) preferBack=true;
      ensureDetector();
      navigator.mediaDevices.getUserMedia({ video: { facingMode: preferBack?{ideal:'environment'}:{ideal:'user'} }, audio:false }).then(function(stream){
        currentStream=stream; var v=video(); if(!v) return; v.srcObject=stream; v.play().then(function(){
          listCameras().then(function(cams){
            var back = cams.find(function(c){ return /rear|back/i.test(c.label); });
            if (back && preferBack){ switchToDevice(back.deviceId); }
          });
          var st=scanStatus(); if (st) st.textContent = detector ? 'Status: camera ativa' : 'Status: camera ativa (sem detector nativo; use Leitor Alternativo)';
          if (detector) loopScan();
        });
      }).catch(function(e){ var st=scanStatus(); if (st) st.textContent='Erro: '+e.message; });
    }
    function switchToDevice(deviceId){
      stopCam(); currentDeviceId=deviceId;
      navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio:false }).then(function(stream){
        currentStream=stream; var v=video(); if(!v) return; v.srcObject=stream; v.play();
      }).catch(function(e){ var st=scanStatus(); if (st) st.textContent='Erro ao trocar camera: '+e.message; });
    }
    function startZXing(){
      try{
        var ZX = window.ZXing; if (!ZX) throw new Error('Biblioteca ZXing nao carregou');
        var Reader = ZX.BrowserMultiFormatReader;
        zxingReader = new Reader();
        zxingReader.listVideoInputDevices().then(function(cams){
          var deviceId = cams[0] && cams[0].deviceId; var back = cams.find(function(c){ return /rear|back/i.test(c.label); }); if (back) deviceId=back.deviceId;
          var v=video(); if (!v) return;
          zxingReader.decodeFromVideoDevice(deviceId, v, function(res,err){
            if (res){ zxingReader.reset(); stopCam(); if (result()) result().textContent='QR: '+res.getText()+'\nProcessando...'; handleQr(res.getText()); }
          });
          var st=scanStatus(); if (st) st.textContent='ZXing: leitor alternativo ativo';
        });
      }catch(e){ var st=scanStatus(); if (st) st.textContent='ZXing erro: '+e.message; }
    }

    var btnStart = document.getElementById('btnStart');
    var btnSwitch = document.getElementById('btnSwitchCam');
    var btnZXing = document.getElementById('btnZXing');
    var btnStop = document.getElementById('btnStop');
    var btnProcessUrl = document.getElementById('btnProcessUrl');
    if (btnStart) btnStart.addEventListener('click', function(){ startCam(true); });
    if (btnSwitch) btnSwitch.addEventListener('click', function(){
      listCameras().then(function(cams){ if (!cams.length) return alert('Nenhuma camera encontrada'); var idx = cams.findIndex(function(c){ return c.deviceId===currentDeviceId; }); var next = cams[(idx+1+cams.length)%cams.length]; switchToDevice(next.deviceId); });
    });
    if (btnZXing) btnZXing.addEventListener('click', startZXing);
    if (btnStop) btnStop.addEventListener('click', stopCam);
    if (btnProcessUrl) btnProcessUrl.addEventListener('click', function(){
      var q = document.getElementById('qrUrl').value.trim(); if (!q){ if (result()) result().textContent='Informe a URL do QR.'; return; } handleQr(q);
    });

    function handleQr(url){
      window.NFCE.processNfceUrl(url).then(function(rec){
        if (result()) result().textContent='OK! Nota salva:\n'+JSON.stringify(rec,null,2); refreshReceiptsTable();
      }).catch(function(e){ if (result()) result().textContent='Falha: '+e.message; });
    }

    // DEBUG
    var dbgBtn = document.getElementById('btnDbgTest');
    if (dbgBtn) dbgBtn.addEventListener('click', function(){
      var url = (document.getElementById('dbgUrl') && document.getElementById('dbgUrl').value || '').trim();
      var outEl = document.getElementById('dbgOut');
      if (!url){ if(outEl) outEl.textContent='Informe a URL.'; return; }
      window.NFCE.debugRaw(url).then(function(pack){
        if (outEl) outEl.textContent = JSON.stringify(pack, null, 2);
      }).catch(function(e){ if(outEl) outEl.textContent = 'Erro: '+e.message; });
    });

    // CONFIG
    var btnSaveCfg = document.getElementById('btnSaveCfg');
    var btnClearAll = document.getElementById('btnClearAll');
    if (btnSaveCfg) btnSaveCfg.addEventListener('click', function(){
      var endpoint=document.getElementById('endpoint').value.trim(); var uf=document.getElementById('uf').value.trim();
      var mode=(document.querySelector('input[name=\"parserMode\"]:checked') && document.querySelector('input[name=\"parserMode\"]:checked').value) || 'proxy';
      var cfg=FinStore.loadCfg(); cfg.endpoint=endpoint; cfg.uf=uf; cfg.parserMode=mode; FinStore.saveCfg(cfg);
      var s=document.getElementById('cfgStatus'); if (s) s.textContent='Configuracoes salvas.';
    });
    if (btnClearAll) btnClearAll.addEventListener('click', function(){
      if(!confirm('Apagar todos os dados locais?')) return; FinStore.wipe();
      var s=document.getElementById('cfgStatus'); if (s) s.textContent='Dados limpos.'; refreshReceiptsTable();
    });

    function refreshReceiptsTable(){
      var arr=FinStore.loadReceipts().filter(function(r){ return FinUtil.inPeriod(r.data, period); });
      var tb=document.querySelector('#tblReceipts tbody'); if (!tb) return; tb.innerHTML='';
      arr.forEach(function(r){
        var tr=document.createElement('tr');
        tr.innerHTML='<td>'+new Date(r.data).toLocaleString()+'</td><td>'+ (r.emitente||'') +'</td><td>R$ '+Number(r.valor||0).toFixed(2)+'</td><td>'+((r.itens||[]).length)+'</td><td>'+(r.uf||'')+'</td>';
        tb.appendChild(tr);
      });
    }
    document.getElementById('btnRefreshReceipts').addEventListener('click', refreshReceiptsTable);
    document.getElementById('btnExportReceipts').addEventListener('click', function(){
      var arr=FinStore.loadReceipts().filter(function(r){ return FinUtil.inPeriod(r.data, period); });
      var rows=[['data','emitente','cnpj','documento','valor','uf','chave','url','itens']];
      arr.forEach(function(r){ rows.push([r.data,r.emitente,r.cnpj,r.documento||'',r.valor,r.uf,r.chave,r.url,(r.itens||[]).length]); });
      FinCSV.export('receipts.csv', rows);
    });

    // SW
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(function(){}); }
  }catch(err){
    console.error(err);
    var el=document.getElementById('err'); var pre=document.getElementById('errlog');
    if (el && pre){ pre.textContent=String(err && err.stack || err); el.style.display='block'; }
  }
});
