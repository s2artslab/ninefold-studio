# Attach ninefold-studio.s2artslab.com to the ninefold-studio Pages project.
# Run after first `pages deploy`. Also ensures proxied CNAME DNS exists.
#
# Requires CLOUDFLARE_API_TOKEN with Account → Cloudflare Pages → Edit and Zone → DNS → Edit.

param(
  [string] $AccountId = "28971ca36b16ff54bd6811fe911d296e",
  [string] $ZoneId = "753c9c347511381f91509f38c295cfea",
  [string] $Project = "ninefold-studio",
  [string] $Domain = "ninefold-studio.s2artslab.com",
  [string] $DnsName = "ninefold-studio",
  [string] $PagesTarget = "ninefold-studio.pages.dev"
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
    if ($val -ne "") { Set-Item -Path "env:$name" -Value $val }
  }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Import-DotEnvFile (Join-Path $root "config\cloudflare.env")
}
if (-not $env:CLOUDFLARE_API_TOKEN) {
  $shared = Resolve-Path (Join-Path $root "..\s2-ecosystem-v2\config\cloudflare.env") -ErrorAction SilentlyContinue
  if ($shared) { Import-DotEnvFile $shared.Path }
}

$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) {
  Write-Error "CLOUDFLARE_API_TOKEN not set."
  exit 1
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type"  = "application/json"
}

# --- Pages custom domain ---
$domainUri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$Project/domains"
Write-Host "Attaching Pages custom domain: $Domain"
try {
  $resp = Invoke-RestMethod -Method Post -Uri $domainUri -Headers $headers -Body (@{ name = $Domain } | ConvertTo-Json)
  if ($resp.success) {
    Write-Host "  OK status=$($resp.result.status)" -ForegroundColor Green
  }
} catch {
  if ($_.ErrorDetails.Message -match "already exists") {
    Write-Host "  Already attached" -ForegroundColor Green
  } else {
    Write-Warning $_.ErrorDetails.Message
    throw
  }
}

$list = Invoke-RestMethod -Uri $domainUri -Headers $headers
$list.result | ForEach-Object { Write-Host "  Pages: $($_.name) -> $($_.status)" }

# --- DNS CNAME ---
$fqdn = "$DnsName.s2artslab.com"
$listDnsUri = "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records?type=CNAME&name=$fqdn"
$dnsBody = @{
  type    = "CNAME"
  name    = $DnsName
  content = $PagesTarget
  proxied = $true
  ttl     = 1
} | ConvertTo-Json

Write-Host "DNS CNAME: $fqdn -> $PagesTarget (proxied)"
$listDns = Invoke-RestMethod -Uri $listDnsUri -Headers $headers
$existing = @($listDns.result | Where-Object { $_.name -eq $fqdn })

if ($existing.Count -gt 0) {
  $rec = $existing[0]
  if ($rec.content -eq $PagesTarget -and $rec.proxied) {
    Write-Host "  DNS OK" -ForegroundColor Green
  } else {
    $null = Invoke-RestMethod -Method Patch -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records/$($rec.id)" -Headers $headers -Body $dnsBody
    Write-Host "  DNS updated" -ForegroundColor Yellow
  }
} else {
  $created = Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Headers $headers -Body $dnsBody
  if (-not $created.success) { throw "DNS create failed" }
  Write-Host "  DNS created" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Live: https://$Domain (may take 1-5 min to activate)" -ForegroundColor Green
