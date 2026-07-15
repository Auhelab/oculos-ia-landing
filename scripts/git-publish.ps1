# git-publish.ps1
# Leva o SEU trabalho do branch pessoal para o main (integracao deliberada).
# Rode quando chegar a um ponto bom para compartilhar com a outra pessoa.
# O auto-sync dela puxara o main automaticamente na proxima rodada.

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -eq "main") {
  Write-Host "Voce ja esta no 'main' - nada a publicar. Va para o seu branch pessoal primeiro."
  exit 0
}

# Garante que o trabalho atual esta commitado e enviado.
git add -A
$dirty = git status --porcelain
if ($dirty) { git commit -q -m "checkpoint: $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))" }
git push -q -u origin $branch

# Atualiza o main e mescla o seu branch nele.
git fetch -q origin
git checkout -q main
git pull -q origin main
git merge --no-edit $branch
if ($LASTEXITCODE -ne 0) {
  Write-Host "CONFLITO ao mesclar '$branch' em main."
  Write-Host "Resolva os arquivos em conflito, entao rode:"
  Write-Host "  git add -A; git commit; git push origin main; git checkout $branch; git merge main"
  exit 1
}
git push -q origin main

# Volta para o seu branch e traz o main integrado de volta.
git checkout -q $branch
git merge --no-edit main | Out-Null
Write-Host "Publicado: '$branch' -> main. Voce esta de volta em '$branch', ja sincronizado."
