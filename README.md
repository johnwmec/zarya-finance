# Zarya Finance (PWA) — com Relatórios
- Scanner NFC-e (QR) + importação OFX (Santander/Bradesco)
- Relatórios: **Despesas por mês** (barra) e **por categoria** (pizza), com regras (regex)
- Armazenamento local + exportação CSV
- Parser NFC-e via **Google Apps Script** (grátis)

## Publicar no GitHub Pages
### Método rápido (site)
1. Crie um repositório público (ex.: `zarya-finance`).
2. Faça upload de **todos os arquivos** desta pasta.
3. Settings → Pages → Source: *Deploy from a branch* → Branch: `main` (root).
4. Abra a URL gerada e instale como PWA no celular.

### Método via terminal
```bash
git init
git add .
git commit -m "Zarya Finance PWA (reports)"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/zarya-finance.git
git push -u origin main
```
Depois, ative o Pages como acima.

## Google Apps Script (parser NFC-e)
1. Acesse https://script.google.com → projeto em branco.
2. Cole `apps_script_parser.gs`.
3. **Implantar como App da Web**: Executar como *Você*; Acesso: *Qualquer pessoa com o link*.
4. Cole a URL no app (aba **Config**).

## Exemplos de regras
- `mercado|super|carrefour` → **Supermercado**
- `posto|ipiranga|shell` → **Combustível**
- `ifood|ubereats` → **Delivery**
- `farmacia|drogasil` → **Saúde**
