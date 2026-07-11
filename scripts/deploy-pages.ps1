param(
  [string] $ProjectName = "ninefold-studio",
  [string] $ProductionBranch = "main"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Import-DotEnvFile {
  param([string] $Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $name = $line.Substring(0, $i).Trim()
    $val = $line.Substring($i + 1).Trim()
    if ($val -ne "") {
      Set-Item -Path "env:$name" -Value $val
    }
  }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Import-DotEnvFile (Join-Path $root "config\cloudflare.env")
}
if (-not $env:CLOUDFLARE_API_TOKEN) {
  $shared = Resolve-Path (Join-Path $root "..\s2-ecosystem-v2\config\cloudflare.env") -ErrorAction SilentlyContinue
  if ($shared) { Import-DotEnvFile $shared.Path }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Error @"
CLOUDFLARE_API_TOKEN is not set.
Set it for this session:
  `$env:CLOUDFLARE_API_TOKEN = '<token>'
Or add config/cloudflare.env (see s2-ecosystem-v2/config/cloudflare.env.example).
"@
  exit 1
}

Write-Host "Deploying Ninefold Studio AI Lab to Cloudflare Pages: $ProjectName"
Write-Host "Production URL: https://ninefold-studio.s2artslab.com"

$visibility = Join-Path (Resolve-Path (Join-Path $root "..\..\shared\s2-visibility")) "Invoke-S2Visibility.ps1"
& $visibility -Surface ninefoldStudio -WebDir $root

if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
  $env:CLOUDFLARE_ACCOUNT_ID = "28971ca36b16ff54bd6811fe911d296e"
}

npx --yes wrangler@3 pages deploy . --project-name=$ProjectName --branch=$ProductionBranch --commit-dirty=true
