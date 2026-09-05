param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ForgeArgs
)

$forgePath = "forge"
if (-not (Get-Command "forge" -ErrorAction SilentlyContinue)) {
    $foundryBin = "$env:USERPROFILE\.foundry\bin\forge.exe"
    if (Test-Path $foundryBin) {
        $forgePath = $foundryBin
    } else {
        Write-Error "forge binary not found in PATH or $foundryBin"
        exit 1
    }
}

& $forgePath @ForgeArgs
exit $LASTEXITCODE
