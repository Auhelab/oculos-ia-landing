# Colaboração em dois — auto-sync via GitHub

Setup para duas pessoas mexerem no projeto ao mesmo tempo, com o GitHub
(`Auhelab/oculos-ia-landing`) se atualizando sozinho a cada 30 min. Cada
pessoa trabalha no **seu próprio branch**; o `main` é o ponto de integração.

## Como funciona

- **`scripts/git-autosync.ps1`** — roda a cada 30 min pelo Agendador de Tarefas.
  A cada rodada: commita seu trabalho → envia seu branch pro GitHub → puxa o
  que já foi integrado no `main`. Em conflito, **para e avisa** (não destrói nada).
  Log em `.autosync.log` (na raiz, não versionado).
- **`scripts/git-publish.ps1`** — você roda quando quiser **compartilhar** seu
  trabalho: mescla seu branch no `main` e envia. O auto-sync da outra pessoa
  puxa o `main` na próxima rodada.

## Regras de convívio

1. **Nunca trabalhe direto no `main`.** Fique sempre no seu branch pessoal.
2. **Divida áreas** quando der (ex.: um no frontend, outro no Supabase) — reduz conflito.
3. Cada máquina tem seu **`.env` local** (não vai pro git — segredos ficam seguros).

## Setup da SEGUNDA pessoa

```powershell
# 1. Clonar (fora do OneDrive!)
cd C:\Users\<voce>\Projetos
git clone https://github.com/Auhelab/oculos-ia-landing.git
cd oculos-ia-landing

# 2. Criar seu branch pessoal
git checkout -b dev/seu-nome
git push -u origin dev/seu-nome

# 3. Instalar deps e criar o .env (peça as chaves ao dono do projeto)
npm install
#   copie o .env.example para .env e preencha

# 4. Registrar o auto-sync a cada 30 min
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\<voce>\Projetos\oculos-ia-landing\scripts\git-autosync.ps1"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "oculos-ia-git-autosync" `
  -Action $action -Trigger $trigger -Force
```

Pronto — a partir daí seu branch se sincroniza sozinho. Para compartilhar, rode
`powershell scripts\git-publish.ps1`.

## Setup no macOS (Henrique)

- Branch pessoal: `dev/henrique`.
- **`scripts/git-autosync.sh`** — versão mac do auto-sync, agendada via launchd
  (`~/Library/LaunchAgents/com.auhelab.oculos-ia.git-autosync.plist`) a cada
  **40 min**. Diferença: além de sincronizar o branch, **publica no `main`
  automaticamente** (push fast-forward). Em conflito, para e avisa.
- Pausar: criar um arquivo `.autosync-pause` na raiz do repo (apagar para
  retomar), ou `launchctl unload ~/Library/LaunchAgents/com.auhelab.oculos-ia.git-autosync.plist`.
