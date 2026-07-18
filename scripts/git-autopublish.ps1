# git-autopublish.ps1 — sincroniza o SEU branch pessoal e PUBLICA no main a cada 40 min.
# Nunca destroi trabalho: em conflito ao integrar o main, aborta e apenas avisa.
# Pausar: crie um arquivo  .autosync-pause  na raiz do repo (apague para retomar).
#
# Registrado no Agendador de Tarefas como "oculos-ia-git-autopublish" (sem
# -ExecutionPolicy Bypass: a politica RemoteSigned ja roda script local).
# Portavel: descobre a raiz do repo pela propria localizacao do script (scripts/).

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$logFile = Join-Path $RepoRoot ".autosync.log"
function Log([string]$m) {
  "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) $m" | Tee-Object -FilePath $logFile -Append | Out-Null
}

# Pausa manual: enquanto houver .autosync-pause na raiz, nao publica (util quando
# ha algo pela metade que nao pode ir para o main). Apague o arquivo para retomar.
if (Test-Path (Join-Path $RepoRoot ".autosync-pause")) {
  Log "[autosync] pausado (.autosync-pause presente) - pulei esta rodada."
  exit 0
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
if (git status --porcelain) {
  git commit -q -m "wip: autosync $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))"
  Log "[autosync] commit local em '$branch'."
}

# 2) Publica o seu branch (backup).
git push -q -u origin $branch
if ($LASTEXITCODE -ne 0) { Log "[autosync] ERRO no push de '$branch' - verifique credenciais/rede."; exit 1 }
Log "[autosync] push de '$branch'."

# 3) Integra o main sem destruir nada.
git fetch -q origin main
git merge --no-edit origin/main
if ($LASTEXITCODE -ne 0) {
  git merge --abort
  Log "[autosync] CONFLITO ao integrar o main - resolva manualmente. Seu trabalho JA foi enviado em '$branch'."
  exit 1
}

# 4) Re-publica o seu branch ja com o main integrado.
git push -q origin $branch

# 5) Publica no main (fast-forward garantido: o branch ja contem o origin/main).
git push -q origin "HEAD:main"
if ($LASTEXITCODE -eq 0) {
  Log "[autosync] OK - '$branch' sincronizado e publicado no main."
} else {
  Log "[autosync] push pro main rejeitado (main mudou agora) - a proxima rodada integra."
}
