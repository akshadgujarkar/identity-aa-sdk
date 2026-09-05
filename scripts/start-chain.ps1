param(
    [int]$Port = 8545,
    [int]$ChainId = 31337,
    [switch]$Background
)

$anvilPath = "anvil"
if (-not (Get-Command "anvil" -ErrorAction SilentlyContinue)) {
    $foundryBin = "$env:USERPROFILE\.foundry\bin\anvil.exe"
    if (Test-Path $foundryBin) {
        $anvilPath = $foundryBin
    } else {
        Write-Error "anvil binary not found in PATH or $foundryBin"
        exit 1
    }
}

$anvilArgs = @("--port", "$Port", "--chain-id", "$ChainId")

if ($Background) {
    Write-Host "Starting Anvil in background on port $Port (chainId: $ChainId)..."
    Start-Process -FilePath $anvilPath -ArgumentList $anvilArgs -WindowStyle Hidden
} else {
    Write-Host "Starting Anvil on port $Port (chainId: $ChainId)..."
    & $anvilPath @anvilArgs
}
