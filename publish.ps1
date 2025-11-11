param([string]$Repo='zarya-finance',[string]$User='SEU-USUARIO')
if (Test-Path .git) { Remove-Item .git -Recurse -Force }
git init
git add .
git commit -m 'Zarya Finance PWA (reports)'
git branch -M main
git remote add origin https://github.com/$User/$Repo.git
git push -u origin main
