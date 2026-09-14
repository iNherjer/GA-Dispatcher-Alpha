param(
    [Parameter(Mandatory=$true)][string]$PackagePath,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'release')
)
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path -LiteralPath $PackagePath).Path
$packageName = 'vfr-multitool-toolbar-panel'
if ((Split-Path $packageRoot -Leaf) -ne $packageName) { throw 'Unexpected package root' }
$manifest = Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw | ConvertFrom-Json
$layout = Get-Content -LiteralPath (Join-Path $packageRoot 'layout.json') -Raw | ConvertFrom-Json
if ($manifest.package_version -ne '0.2.1' -or $manifest.builder -ne 'Microsoft Flight Simulator 2024') { throw 'Unexpected SDK manifest' }
$paths = @{}
foreach ($entry in $layout.content) {
    $relativePath = [string]$entry.path
    if ($relativePath -match '(^/|\\|:|(^|/)\.\.(/|$))' -or $paths.ContainsKey($relativePath)) { throw "Invalid layout path: $relativePath" }
    $file = Get-Item -LiteralPath (Join-Path $packageRoot $relativePath)
    if ($file.Length -ne $entry.size) { throw "Layout size mismatch: $relativePath" }
    $paths[$relativePath] = $true
}
$registration = 'InGamePanels/InGamePanel_VfrMultitool.spb'
if (-not $paths.ContainsKey($registration) -or $paths.Count -ne 5) { throw 'Unexpected package payload' }
$spb = [IO.File]::ReadAllBytes((Join-Path $packageRoot $registration))
if ($spb.Length -lt 100) { throw 'Empty or incomplete SPB' }
foreach ($source in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'PackageSources/html_ui') -Recurse -File) {
    $relative = $source.FullName.Substring((Join-Path $PSScriptRoot 'PackageSources').Length + 1)
    $outputFile = Join-Path $packageRoot $relative
    if ((Get-FileHash -LiteralPath $source.FullName).Hash -ne (Get-FileHash -LiteralPath $outputFile).Hash) { throw "Source mismatch: $relative" }
}
$files = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File)
if ($files.Count -ne 7) { throw 'Unlisted package files found' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$zipPath = Join-Path $OutputDirectory 'vfr-multitool-toolbar-panel-0.2.1-test.zip'
if (Test-Path -LiteralPath $zipPath) { throw 'Refusing to overwrite an existing test archive' }
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($archive.Entries | Where-Object { $_.Name -ne '' })
    if ($entries.Count -ne $files.Count) { throw 'ZIP entry count mismatch' }
    foreach ($entry in $entries) {
        $name = $entry.FullName.Replace('\','/')
        if (-not $name.StartsWith($packageName + '/')) { throw "Unexpected ZIP root: $name" }
        $relative = $name.Substring($packageName.Length + 1)
        $original = Join-Path $packageRoot $relative
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
        finally { $stream.Dispose(); $sha.Dispose() }
        if ($hash -ne (Get-FileHash -LiteralPath $original).Hash) { throw "ZIP hash mismatch: $name" }
    }
} finally { $archive.Dispose() }
$zip = Get-Item -LiteralPath $zipPath
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $($zip.Name)" | Set-Content -LiteralPath ($zipPath + '.sha256') -Encoding ascii
[pscustomobject]@{ archive=$zip.FullName; bytes=$zip.Length; sha256=$hash; files=$files.Count; layoutEntries=$paths.Count } | ConvertTo-Json
