# PowerShell Bridge

Pilota **Windows PowerShell** da WSL2. Esegue comandi e script su Windows tramite `pwsh.exe` (PowerShell 7) o `powershell.exe` (v5.1 fallback).

## Comandi disponibili

| Comando | Descrizione |
|---------|-------------|
| `exec <comando>` | Esegue un singolo comando PowerShell su Windows |
| `script <path>` | Esegue un file .ps1 su Windows (path Windows o WSL) |
| `info` | Stato connessione, versione PS, hostname Windows, utente |
| `list-modules` | Elenca i moduli PowerShell disponibili su Windows |

## Formato output

Tutti i comandi restituiscono JSON:
```json
{
  "ok": true,
  "command": "Get-Process | Select-Object -First 3",
  "output": "...",
  "engine": "pwsh",
  "version": "7.5.5",
  "durationMs": 234,
  "exitCode": 0
}
```

## Sicurezza

- **Comandi bloccati** (richiedono `--force`): `Remove-Item`, `Stop-Process`, `Stop-Service`, `Remove-Service`, `Disable-NetAdapter`, `Remove-NetFirewallRule`, `Format-Volume`, `Remove-Partition`, `Clear-EventLog`, `Remove-WindowsFeature`
- **Timeout**: default 30s, max 120s (configurabile via `--timeout`)
- **Output**: troncato a 50KB per evitare overflow
- **Path**: automaticamente converte path WSL `/mnt/c/...` ↔ path Windows `C:\...`

## Esempi

```bash
# Info sistema Windows
powershell-bridge ctl info

# Elencare processi
powershell-bridge ctl exec "Get-Process | Select-Object -First 5 Name,CPU,WorkingSet64"

# Copiare un file
powershell-bridge ctl exec "Copy-Item 'C:\\Users\\frede\\doc.txt' 'C:\\Users\\frede\\backup\\'"

# Eseguire uno script
powershell-bridge ctl script "C:\\Users\\frede\\scripts\\maint.ps1"

# Elencare moduli PS
powershell-bridge ctl list-modules
```