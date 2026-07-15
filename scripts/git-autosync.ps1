# git-autosync.ps1
# Sincroniza o SEU branch pessoal com o GitHub. Pensado para rodar via
# Agendador de Tarefas do Windows a cada 30 min. NUNCA destroi trabalho:
# em caso de conflito ao integrar o main, aborta e apenas avisa.
#
# Portavel: descobre a raiz do repo pela propria localizacao do script,
# entao a segunda pessoa so precisa clonar e registrar a tarefa.

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$logFile = Join-Path $RepoRoot ".autosync.log"
function Log([string]$m) {
  "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) $m" | Tee-Object -FilePath $logFile -Append
}

# Nao mexe se ha um merge/rebase pela metade (evita bagunca automatica).
if ((Test-Path ".git/MERGE_HEAD") -or (Test-Path ".git/rebase-merge") -or (Test-Path ".git/rebase-apply")) {
  Log "[autosync] merge/rebase em andamento - pulei esta rodada."
  exit 0
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -eq "main") {
  Log "[autosync] voce esta no 'main' - pulei. Use um branch pessoal (ex.: dev/seu-nome)."
  exit 0
}

# 1) Commit do trabalho local (se houver algo).
git add -A
$dirty = git status --porcelain
if ($dirty) {
  git commit -q -m "wip: autosync $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))"
  Log "[autosync] commit local feito."
}

# 2) Publica o seu branch (backup + compartilhamento).
git push -q -u origin $branch
Log "[autosync] push de '$branch'."

# 3) Integra as atualizacoes ja consolidadas no main, sem destruir nada.
git fetch -q origin main
git merge --no-edit origin/main
if ($LASTEXITCODE -ne 0) {
  git merge --abort
  Log "[autosync] CONFLITO ao integrar o main - resolva manualmente. Seu trabalho JA foi enviado em '$branch'."
  exit 1
}

# 4) Re-publica o seu branch ja com o main integrado.
git push -q origin $branch
Log "[autosync] OK - '$branch' sincronizado com o main."
