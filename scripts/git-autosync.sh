#!/bin/bash
# git-autosync.sh — versao macOS do git-autosync.ps1 (branch pessoal do Henrique).
# Roda a cada 40 min via launchd (~/Library/LaunchAgents/com.auhelab.oculos-ia.git-autosync.plist).
#
# Diferenca pro .ps1: alem de sincronizar o branch pessoal, PUBLICA no main
# automaticamente (push fast-forward, sem tocar no working tree).
# Em conflito, PARA e avisa — nunca destroi trabalho. Log em .autosync.log.
#
# Pausar: crie um arquivo .autosync-pause na raiz do repo, ou
#   launchctl unload ~/Library/LaunchAgents/com.auhelab.oculos-ia.git-autosync.plist

set -u
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
LOG="$REPO_ROOT/.autosync.log"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG"; }

if [ -f "$REPO_ROOT/.autosync-pause" ]; then
  log "[autosync] pausado (.autosync-pause presente) - pulei esta rodada."
  exit 0
fi

# Nao mexe se ha um merge/rebase pela metade (evita bagunca automatica).
if [ -f .git/MERGE_HEAD ] || [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  log "[autosync] merge/rebase em andamento - pulei esta rodada."
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "main" ]; then
  log "[autosync] voce esta no 'main' - pulei. Use um branch pessoal (ex.: dev/henrique)."
  exit 0
fi

# 1) Commit do trabalho local (se houver algo).
git add -A
if [ -n "$(git status --porcelain)" ]; then
  git commit -q -m "wip: autosync $(date '+%Y-%m-%d %H:%M')"
  log "[autosync] commit local feito."
fi

# 2) Publica o branch pessoal (backup + compartilhamento).
git push -q -u origin "$BRANCH" || { log "[autosync] ERRO no push de '$BRANCH' - verifique credenciais/rede."; exit 1; }
log "[autosync] push de '$BRANCH'."

# 3) Integra as atualizacoes ja consolidadas no main, sem destruir nada.
git fetch -q origin main
if ! git merge --no-edit origin/main >/dev/null 2>&1; then
  git merge --abort
  log "[autosync] CONFLITO ao integrar o main - resolva manualmente. Seu trabalho JA foi enviado em '$BRANCH'."
  exit 1
fi

# 4) Re-publica o branch ja com o main integrado.
git push -q origin "$BRANCH"

# 5) Publica no main (fast-forward garantido: origin/main acabou de ser integrado).
if git push -q origin "HEAD:main"; then
  log "[autosync] OK - '$BRANCH' sincronizado e publicado no main."
else
  log "[autosync] push pro main rejeitado (main mudou agora ha pouco) - a proxima rodada integra."
fi
