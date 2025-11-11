#!/usr/bin/env bash
set -e
REPO=${1:-zarya-finance}
USER=${2:-SEU-USUARIO}
rm -rf .git
git init
git add .
git commit -m 'Zarya Finance PWA (reports)'
git branch -M main
git remote add origin https://github.com/$USER/$REPO.git
git push -u origin main
