
document.addEventListener('DOMContentLoaded', function(){
  try{
    const boot = document.getElementById('bootStatus');
    if (boot) boot.textContent = 'Scripts ativos. Versão 2.3.4.';

    // Bind diagnóstico
    const dbgBtn = document.getElementById('btnDbgTest');
    if (dbgBtn){
      dbgBtn.addEventListener('click', async ()=>{
        const url = (document.getElementById('dbgUrl')?.value||'').trim();
        const outEl = document.getElementById('dbgOut');
        if (!url){ if(outEl) outEl.textContent='Informe a URL.'; return; }
        try{ const data = await window.NFCE.debug(url); if (outEl) outEl.textContent = JSON.stringify(data,null,2); }
        catch(e){ if(outEl) outEl.textContent = 'Erro: '+e.message; }
      });
    }
  }catch(err){ console.error(err); }
});
