document.addEventListener('DOMContentLoaded',()=>{ function esc(s){
  const map = {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"};
  return String(s).replace(/[&<>"]/g, ch => map[ch]).replace(/'/g,"&#39;");
} });