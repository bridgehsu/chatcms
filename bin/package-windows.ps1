# ChatCMS Windows 打包（PowerShell）
# 用法：
#   powershell -ExecutionPolicy Bypass -File bin/package-windows.ps1
#   powershell -File bin/package-windows.ps1 -Msi
#   powershell -File bin/package-windows.ps1 -DebugBuild
#   powershell -File bin/package-windows.ps1 -NoSign

param(
  [switch]$Msi,
  [switch]$DebugBuild,
  [switch]$NoSign
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if ($env:OS -ne "Windows_NT") {
  Write-Error "package-windows.ps1 只能在 Windows 上运行。"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Error "需要 pnpm"
}
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
  Write-Error "需要 Rust (rustc)"
}

$pkg = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
$Version = $pkg.version
$OutDir = Join-Path $Root "release\windows"
$Bundles = if ($Msi) { "nsis,msi" } else { "nsis" }

Write-Host "==> ChatCMS Windows 打包 v$Version"
Write-Host "    工作目录: $Root"
Write-Host "    bundles: $Bundles"

$tauriArgs = @("exec", "tauri", "build", "--bundles", $Bundles)
if ($DebugBuild) { $tauriArgs += "--debug" }
if ($NoSign) { $tauriArgs += "--no-sign" }

Write-Host "==> pnpm $($tauriArgs -join ' ')"
& pnpm @tauriArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$BundleRoot = if ($DebugBuild) {
  Join-Path $Root "src-tauri\target\debug\bundle"
} else {
  Join-Path $Root "src-tauri\target\release\bundle"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$copied = 0

foreach ($sub in @("nsis", "msi")) {
  $dir = Join-Path $BundleRoot $sub
  if (-not (Test-Path $dir)) { continue }
  Get-ChildItem -Path $dir -File | ForEach-Object {
    Copy-Item $_.FullName -Destination $OutDir -Force
    Write-Host "    已复制: $($_.Name)"
    $copied = 1
  }
}

if ($copied -eq 0) {
  Write-Error "未在 $BundleRoot 找到 nsis/msi 产物。"
}

Write-Host "==> 完成"
Write-Host "    产物目录: $OutDir"
Get-ChildItem $OutDir | Format-Table Name, Length, LastWriteTime
