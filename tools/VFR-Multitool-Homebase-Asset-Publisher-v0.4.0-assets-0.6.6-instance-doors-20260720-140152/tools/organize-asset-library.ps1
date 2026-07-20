param(
  [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$PublisherRoot = 'C:\RohDaten\VFR-Multitool-Homebase-Asset-Publisher'
)

$ErrorActionPreference = 'Stop'
$dataRoot = Join-Path $PublisherRoot 'Homebase-Asset-Publisher-Data'
$catalogPath = Join-Path $dataRoot 'catalog.json'
$rawRoot = Join-Path $dataRoot 'source\SimObjects\Misc'
$libraryRoot = Join-Path $PublisherRoot 'asset-library'
$legacyBlendRoot = Join-Path $WorkspaceRoot 'blender-models'
$publisherBlendRoot = Join-Path $PublisherRoot 'blender-models'

if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) { throw "Katalog fehlt: $catalogPath" }
if (-not (Test-Path -LiteralPath $rawRoot -PathType Container)) { throw "Publisher-Rohdaten fehlen: $rawRoot" }

function FileRecord([string]$Path, [string]$Role, [string]$Origin) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  $item = Get-Item -LiteralPath $Path
  [ordered]@{
    role = $Role
    name = $item.Name
    origin = $Origin
    bytes = $item.Length
    modifiedUtc = $item.LastWriteTimeUtc.ToString('o')
    sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  }
}

function CopyTracked([string]$Source, [string]$Destination, [string]$Role, [System.Collections.Generic.List[object]]$Records) {
  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { return }
  $parent = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  if ([IO.Path]::GetFullPath($Source) -ne [IO.Path]::GetFullPath($Destination)) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  }
  $record = FileRecord $Destination $Role $Source
  if ($record) { $Records.Add($record) }
}

$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $libraryRoot | Out-Null
$inventory = [System.Collections.Generic.List[object]]::new()
$summary = [System.Collections.Generic.List[object]]::new()

foreach ($asset in ($catalog.assets | Sort-Object folder)) {
  $assetRoot = Join-Path $libraryRoot $asset.folder
  $editableRoot = Join-Path $assetRoot 'editable-source'
  $backupRoot = Join-Path $assetRoot 'blender-backups'
  $previewRoot = Join-Path $assetRoot 'previews'
  $metadataRoot = Join-Path $assetRoot 'metadata'
  $automationRoot = Join-Path $assetRoot 'automation'
  foreach ($folder in @($editableRoot, $backupRoot, $previewRoot, $metadataRoot, $automationRoot)) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
  }

  $rawAsset = Join-Path $rawRoot $asset.folder
  if (-not (Test-Path -LiteralPath $rawAsset -PathType Container)) { throw "Katalogasset ohne Rohquelle: $($asset.folder)" }
  $gltf = Get-ChildItem -LiteralPath (Join-Path $rawAsset 'model') -Filter '*_LOD00.gltf' -File | Select-Object -First 1
  if (-not $gltf) { throw "LOD00-GLTF fehlt: $($asset.folder)" }
  $baseName = $gltf.BaseName -replace '_LOD00$',''
  $blendNames = @("$baseName.blend")
  if ($asset.folder -eq 'VFRHomebaseHangar') { $blendNames = @('HomebaseTestHangar.blend', "$baseName.blend") }

  $blendCandidates = foreach ($name in $blendNames) {
    Join-Path $editableRoot $name
    Join-Path $legacyBlendRoot $name
    Join-Path $publisherBlendRoot $name
  }
  $blendSource = $blendCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  $records = [System.Collections.Generic.List[object]]::new()
  if ($blendSource) {
    CopyTracked $blendSource (Join-Path $editableRoot ([IO.Path]::GetFileName($blendSource))) 'blender-master' $records
    $blend1 = "$blendSource`1"
    if (Test-Path -LiteralPath $blend1 -PathType Leaf) {
      CopyTracked $blend1 (Join-Path $backupRoot ([IO.Path]::GetFileName($blend1))) 'blender-auto-backup' $records
    }
  }

  foreach ($root in @($legacyBlendRoot, $publisherBlendRoot)) {
    foreach ($preview in (Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.png','.jpg','.jpeg','.webp' -and $_.BaseName -like "$baseName*" })) {
      CopyTracked $preview.FullName (Join-Path $previewRoot $preview.Name) 'preview' $records
    }
  }

  if ($asset.folder -eq 'VFRHomebaseRoundHangar') {
    $script = Join-Path $WorkspaceRoot 'VFR-Multitool-Homebase-Asset-Publisher\tools\create-round-hangar.py'
    CopyTracked $script (Join-Path $automationRoot 'create-round-hangar.py') 'asset-automation' $records
  }

  $sourceLink = Join-Path $assetRoot 'publisher-source'
  if (-not (Test-Path -LiteralPath $sourceLink)) {
    New-Item -ItemType Junction -Path $sourceLink -Target $rawAsset | Out-Null
  }

  $assetJson = $asset | ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText((Join-Path $metadataRoot 'catalog-entry.json'), "$assetJson`n", [Text.UTF8Encoding]::new($false))
  $sourceFiles = Get-ChildItem -LiteralPath $rawAsset -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($rawAsset.Length).TrimStart('\').Replace('\','/')
    [ordered]@{
      relativePath = $relativePath
      bytes = $_.Length
      modifiedUtc = $_.LastWriteTimeUtc.ToString('o')
      sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
  }
  $provenance = [ordered]@{
    schemaVersion = 1
    generatedUtc = [DateTime]::UtcNow.ToString('o')
    key = $asset.key
    folder = $asset.folder
    title = $asset.title
    version = $asset.version
    baseName = $baseName
    blenderSourceFound = [bool]$blendSource
    blenderOriginalPath = $blendSource
    canonicalPublisherSource = $rawAsset
    sourceFiles = @($sourceFiles)
    libraryFiles = @($records)
  }
  [IO.File]::WriteAllText((Join-Path $metadataRoot 'provenance.json'), "$(($provenance | ConvertTo-Json -Depth 20))`n", [Text.UTF8Encoding]::new($false))

  $readme = @"
# $($asset.label)

- Katalog-Key: ``$($asset.key)``
- SimObject-Ordner: ``$($asset.folder)``
- Exakter Titel: ``$($asset.title)``
- Assetversion: ``$($asset.version)``
- GLTF-Basisname: ``$baseName``
- Bearbeitbare Quelle: ``editable-source/``
- Kanonische Publisher-Rohquelle: ``publisher-source/`` (Verzeichnisverknüpfung)
- Metadaten und Hashes: ``metadata/``

Die Blender-Datei ist die bearbeitbare Masterquelle. Der Publisher baut ausschließlich aus der verknüpften kanonischen Rohquelle. Nach einer Blender-Änderung müssen GLTF und BIN gemeinsam exportiert, MSFS-spezifische Erweiterungen geprüft und die Rohquelle über den Publisher ersetzt werden.
"@
  [IO.File]::WriteAllText((Join-Path $assetRoot 'README.md'), $readme, [Text.UTF8Encoding]::new($false))

  foreach ($record in $records) {
    $inventory.Add([pscustomobject][ordered]@{ assetKey=$asset.key; folder=$asset.folder; role=$record.role; name=$record.name; origin=$record.origin; bytes=$record.bytes; sha256=$record.sha256 })
  }
  foreach ($sourceFile in $sourceFiles) {
    $inventory.Add([pscustomobject][ordered]@{ assetKey=$asset.key; folder=$asset.folder; role='publisher-raw'; name=$sourceFile.relativePath; origin=(Join-Path $rawAsset $sourceFile.relativePath); bytes=$sourceFile.bytes; sha256=$sourceFile.sha256 })
  }
  $summary.Add([ordered]@{
    key = $asset.key
    folder = $asset.folder
    title = $asset.title
    version = $asset.version
    blenderSource = if ($blendSource) { [IO.Path]::GetFileName($blendSource) } else { $null }
    rawFileCount = @($sourceFiles).Count
    libraryPath = $assetRoot
  })
}

$shared = Join-Path $libraryRoot '_shared'
New-Item -ItemType Directory -Force -Path $shared | Out-Null
foreach ($name in @('VFR-Multitool-Homebase-Assets.blend','VFR-Multitool-Homebase-Assets.blend1','README.md')) {
  $source = Join-Path $legacyBlendRoot $name
  if (Test-Path -LiteralPath $source -PathType Leaf) { Copy-Item -LiteralPath $source -Destination (Join-Path $shared $name) -Force }
}

[IO.File]::WriteAllText((Join-Path $libraryRoot 'asset-index.json'), "$(($summary | ConvertTo-Json -Depth 10))`n", [Text.UTF8Encoding]::new($false))
$inventory | Export-Csv -LiteralPath (Join-Path $libraryRoot 'file-inventory.csv') -NoTypeInformation -Encoding UTF8

$duplicateGroups = $inventory | Group-Object sha256 | Where-Object Count -gt 1 | ForEach-Object {
  [ordered]@{ sha256=$_.Name; copies=@($_.Group | Select-Object assetKey,folder,role,name,origin) }
}
[IO.File]::WriteAllText((Join-Path $libraryRoot 'duplicate-hashes.json'), "$(($duplicateGroups | ConvertTo-Json -Depth 10))`n", [Text.UTF8Encoding]::new($false))

$rootReadme = @"
# Zentrale Homebase-Assetbibliothek

Diese Bibliothek ordnet jedes katalogisierte Asset nach seinem eindeutigen SimObject-Ordner. Sie wurde nicht-destruktiv aus den vorhandenen Blender-Dateien und den kanonischen Publisher-Rohquellen aufgebaut.

- ``<SimObject-Ordner>/editable-source``: bearbeitbare Blender-Masterdatei
- ``<SimObject-Ordner>/blender-backups``: vorhandene automatische Blender-Sicherung
- ``<SimObject-Ordner>/publisher-source``: direkte Verzeichnisverknüpfung zur kanonischen Publisher-Rohquelle
- ``<SimObject-Ordner>/previews``: vorhandene Vorschauen
- ``<SimObject-Ordner>/automation``: assetspezifische Erzeugungs-/Exportscripte
- ``<SimObject-Ordner>/metadata``: Katalogeintrag, Herkunft, Dateiliste und SHA-256
- ``asset-index.json``: schneller Gesamtindex
- ``file-inventory.csv``: durchsuchbare Datei- und Hashliste
- ``duplicate-hashes.json``: identische Dateien nach SHA-256

Es gibt absichtlich keine zweite kopierte Publisher-Rohdatenbank. ``publisher-source`` zeigt direkt auf ``Homebase-Asset-Publisher-Data/source/SimObjects/Misc`` und verhindert auseinanderlaufende Masterstände.
"@
[IO.File]::WriteAllText((Join-Path $libraryRoot 'README.md'), $rootReadme, [Text.UTF8Encoding]::new($false))

[pscustomobject]@{
  LibraryRoot = $libraryRoot
  AssetCount = $summary.Count
  BlenderSourcesFound = @($summary | Where-Object blenderSource).Count
  MissingBlenderSources = @($summary | Where-Object { -not $_.blenderSource } | ForEach-Object folder)
  InventoryRows = $inventory.Count
  DuplicateHashGroups = @($duplicateGroups).Count
}
