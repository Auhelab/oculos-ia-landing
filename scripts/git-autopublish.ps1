# git-autopublish.ps1
# Publica automaticamente o SEU branch pessoal no 'main' a cada rodada
# (pensado para o Agendador de Tarefas do Windows, a cada 40 min).
#
# A cada rodada:
#   1) commita seu trabalho local (se houver)
#   2) envia seu branch pessoal (backup)
#   3) integra o main atual (trabalho do parceiro) sem destruir nada
#   4) mescla seu branch no main e envia o main
#   5) volta para o seu branch, ja sincronizado com o main
#
# SEGURANCA: em qualquer conflito, aborta o merge, volta para o seu branch e
# apenas avisa no log. NUNCA deixa o repo no meio de um merge nem preso no main.
#
# Portavel: descobre a raiz do repo pela propria localizacao do script.

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$logFile = Join-Path $RepoRoot ".autopublish.log"
function Log([string]$m) {
  "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) $m" | Tee-Object -FilePath $logFile -Append | Out-Null
}

# Nao mexe se ha um merge/rebase pela metade (evita bagunca automatica).
if ((Test-Path ".git/MERGE_HEAD") -or (Test-Path ".git/rebase-merge") -or (Test-Path ".git/rebase-apply")) {
  Log "[autopublish] merge/rebase em andamento - pulei esta rodada."
  exit 0
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -eq "main") {
  # Ja esta no main: so garante que o trabalho local esta commitado e enviado.
  git add -A
  if (git status --porcelain) {
    git commit -q -m "wip: autopublish $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))"
  }
  git pull -q --no-edit origin main
  if ($LASTEXITCODE -ne 0) { git merge --abort 2>$null; Log "[autopublish] CONFLITO ao atualizar o main - resolva manualmente."; exit 1 }
  git push -q origin main
  Log "[autopublish] OK - main atualizado (voce estava no main)."
  exit 0
}

try {
  # 1) Commit do trabalho local (se houver algo).
  git add -A
  if (git status --porcelain) {
    git commit -q -m "wip: autopublish $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))"
    Log "[autopublish] commit local em '$branch'."
  }

  # 2) Publica o seu branch (backup + compartilhamento).
  git push -q -u origin $branch
  if ($LASTEXITCODE -ne 0) { Log "[autopublish] falha ao enviar '$branch' - abortei esta rodada."; exit 1 }

  # 3) Atualiza o main local com o remoto (trabalho ja consolidado do parceiro).
  git fetch -q origin
  git checkout -q main
  git pull -q --ff-only origin main
  if ($LASTEXITCODE -ne 0) {
    Log "[autopublish] main local divergiu do remoto - resolva manualmente. Voltando ao branch."
    git checkout -q $branch
    exit 1
  }

  # 4) Mescla o seu branch no main.
  git merge --no-edit $branch
  if ($LASTEXITCODE -ne 0) {
    git merge --abort
    git checkout -q $branch
    Log "[autopublish] CONFLITO ao mesclar '$branch' em main - resolva com scripts\git-publish.ps1. Seu trabalho JA esta salvo em '$branch'."
    exit 1
  }
  git push -q origin main
  if ($LASTEXITCODE -ne 0) { Log "[autopublish] falha ao enviar o main (talvez o parceiro tenha empurrado). Tento na proxima rodada."; git checkout -q $branch; exit 1 }

  # 5) Volta para o seu branch e traz o main integrado de volta.
  git checkout -q $branch
  git merge --no-edit main | Out-Null
  git push -q origin $branch
  Log "[autopublish] OK - '$branch' publicado no main e sincronizado."
}
finally {
  # Garante que nunca terminamos presos no 'main'.
  $now = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($now -eq "main" -and $branch -ne "main") {
    git checkout -q $branch 2>$null
    Log "[autopublish] (finally) voltei para '$branch'."
  }
}
