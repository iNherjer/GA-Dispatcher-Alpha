$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -Path (Join-Path $PSScriptRoot 'windows-media-volume.cs')
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($operation, $type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
    if (-not $task.Wait(3000)) { throw 'Windows-Medienabfrage dauert zu lange.' }
    return $task.Result
}
function ProcessName($source) {
    if ($source -match '^Spotify(?:\.exe)?$' -or $source -match '^SpotifyAB\.SpotifyMusic_') { return 'Spotify' }
    if ($source -match '^Microsoft\.ZuneMusic_8wekyb3d8bbwe!') { return 'Microsoft.Media.Player' }
    if ($source -match '^([A-Za-z0-9_. -]+)\.exe$') { return $Matches[1] }
    # Chromium may expose its desktop ID as a bare process name.
    if ($source -match '^[A-Za-z0-9_. -]+$') { return $source }
    return ''
}
function ReadTimeline($timeline, $playing, $at = [DateTime]::UtcNow) {
    $positionSeconds = $null; $durationSeconds = $null
    $updated = $timeline.LastUpdatedTime.UtcDateTime
    $raw = @{ position=$timeline.Position.TotalSeconds; start=$timeline.StartTime.TotalSeconds; end=$timeline.EndTime.TotalSeconds; updated=$updated.Ticks; updatedAtMs=($updated.Ticks / 10000 - 62135596800000) }
    # A Playing session can retain a previous song's anchor indefinitely.
    # Prefer an explicitly estimated local clock over extrapolating stale native data.
    $age = ($at - $updated).TotalSeconds
    if ($playing -and $updated.Year -gt 1970 -and ($age -gt 30 -or $age -lt -2)) {
        return @{positionSeconds=$null; durationSeconds=$null; timeline=$raw}
    }
    $duration = ($timeline.EndTime - $timeline.StartTime).TotalSeconds
    if ($duration -gt 0 -and $duration -lt 86400) { $durationSeconds = $duration }
    $position = ($timeline.Position - $timeline.StartTime).TotalSeconds
    # All-zero/default timelines are absent, not a confirmed position of zero.
    if ($position -ge 0 -and $position -lt 86400 -and ($null -ne $durationSeconds -or $updated.Year -gt 1970 -or $position -gt 0)) {
        $positionSeconds = $position
        if ($playing -and $updated.Year -gt 1970) {
            $elapsed = ($at - $updated).TotalSeconds
            if ($elapsed -gt 0 -and $elapsed -lt 86400) { $positionSeconds += $elapsed }
        }
        if ($null -ne $durationSeconds) { $positionSeconds = [Math]::Min($durationSeconds, $positionSeconds) }
    }
    return @{positionSeconds=$positionSeconds; durationSeconds=$durationSeconds; timeline=$raw}
}
function SeekTarget($timeline, $info, $request, $at = [DateTime]::UtcNow) {
    if (-not $info.Controls.IsPlaybackPositionEnabled) { throw 'Dieser Player unterstützt kein Spulen.' }
    $target = [double]$request.positionSeconds
    if ([double]::IsNaN($target) -or [double]::IsInfinity($target) -or $target -lt 0 -or $target -ge 86400) { throw 'Ungültige Wiedergabeposition.' }
    $reading = ReadTimeline $timeline ($info.PlaybackStatus.ToString() -eq 'Playing') $at
    if ($null -eq $reading.positionSeconds -or $null -eq $reading.durationSeconds) { throw 'Keine verlässliche Zeitleiste zum Spulen verfügbar.' }
    $target = [Math]::Min($target, $reading.durationSeconds)
    $absolute = $timeline.StartTime + [TimeSpan]::FromSeconds($target)
    if ($absolute -lt $timeline.MinSeekTime -or $absolute -gt $timeline.MaxSeekTime) { throw 'Diese Position liegt außerhalb des spulbaren Bereichs.' }
    return [long]$absolute.Ticks
}
$manager = Await ($managerType::RequestAsync()) $managerType
$volume = New-Object GAMedia.SessionVolume
$source = ''; $enabled = $true; $factor = 0.2; $duckUntil = [DateTime]::MinValue; $releaseAt = [DateTime]::MinValue
$holdUntil = [DateTime]::MinValue; $holdFactor = 0.2
$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
$read = $reader.ReadLineAsync()
try {
    while ($true) {
        # This lease is enforced in the native helper, even if Electron freezes.
        $now = [DateTime]::UtcNow
        $effective = 1.0
        if ($enabled -and ($now -lt $duckUntil -or $now -lt $releaseAt)) { $effective = $factor }
        # Radio hold has its own lease and level, independent of the announcement ducking switch.
        if ($now -lt $holdUntil -and $holdFactor -lt $effective) { $effective = $holdFactor }
        # Mixer access must not terminate the independent transport/metadata helper.
        try { $volume.Tick([single]$effective, [single]-1) } catch { $volume.Restore() }
        if (-not $read.IsCompleted) { Start-Sleep -Milliseconds 100; continue }
        $line = $read.Result
        if ($null -eq $line) { break }
        $read = $reader.ReadLineAsync()
        $request = $null
        try {
            $request = $line | ConvertFrom-Json
            $sessions = @($manager.GetSessions())
            $session = $sessions | Where-Object { $_.SourceAppUserModelId -eq $source } | Select-Object -First 1
            if (-not $source -and $request.action -eq 'snapshot') {
                $session = $sessions | Where-Object { $_.SourceAppUserModelId -match 'Spotify' } | Select-Object -First 1
                if ($null -eq $session) { $session = $manager.GetCurrentSession() }
                if ($null -ne $session) { $source = $session.SourceAppUserModelId; $volume.Select((ProcessName $source)) }
            }
            switch ($request.action) {
                'select' {
                    $candidate = $sessions | Where-Object { $_.SourceAppUserModelId -eq $request.source } | Select-Object -First 1
                    if ($null -eq $candidate) { throw 'Dieser Player ist nicht mehr geöffnet.' }
                    $source = $request.source; $session = $candidate; $volume.Select((ProcessName $source)); $volume.Tick([single]$effective, [single]-1)
                }
                { $_ -in 'play','pause','playPause','next','previous' } {
                    if ($null -eq $session) { throw 'Bitte den Windows-Player öffnen und einen Titel starten.' }
                    $operation = switch ($request.action) {
                        'play' { $session.TryPlayAsync() }
                        'pause' { $session.TryPauseAsync() }
                        'playPause' { $session.TryTogglePlayPauseAsync() }
                        'next' { $session.TrySkipNextAsync() }
                        'previous' { $session.TrySkipPreviousAsync() }
                    }
                    if (-not (Await $operation ([bool]))) { throw 'Der Player unterstützt diesen Befehl derzeit nicht.' }
                }
                'seek' {
                    if ($null -eq $session -or $request.source -ne $source) { throw 'Der ausgewählte Player hat sich geändert.' }
                    $ticks = SeekTarget ($session.GetTimelineProperties()) ($session.GetPlaybackInfo()) $request
                    if (-not (Await ($session.TryChangePlaybackPositionAsync($ticks)) ([bool]))) { throw 'Der Player hat das Spulen abgelehnt.' }
                }
                'volume' {
                    if ($null -eq $session -or -not $volume.Available) { throw 'Für diesen Player ist keine Windows-Audiositzung verfügbar.' }
                    $volume.Tick([single]$effective, [single]$request.volume)
                }
                'settings' { $enabled = $request.enabled -eq $true; $factor = [double]$request.factor }
                'duck' {
                    if ($request.active -eq $true) { $duckUntil = $now.AddSeconds(5); $releaseAt = [DateTime]::MinValue }
                    else { $duckUntil = [DateTime]::MinValue; $releaseAt = $now.AddMilliseconds(350) }
                }
                'hold' {
                    if ($request.active -eq $true) { $holdUntil = $now.AddSeconds(5); $holdFactor = [double]$request.factor }
                    else { $holdUntil = [DateTime]::MinValue }
                }
                'snapshot' { }
                default { throw 'Ungültiger Medienbefehl.' }
            }
            # Heartbeats must not wait for metadata or obstruct urgent release.
            if ($request.action -eq 'duck' -or $request.action -eq 'hold') {
                [Console]::WriteLine((@{ id=$request.id; ok=$true } | ConvertTo-Json -Compress))
                continue
            }
            $title = ''; $artist = ''; $playing = $false
            $controls = @{ play=$false; pause=$false; playPause=$false; next=$false; previous=$false; seek=$false }
            $positionSeconds = $null; $durationSeconds = $null; $timelineData = $null; $album = ''; $trackNumber = 0
            if ($null -ne $session) {
                $properties = Await ($session.TryGetMediaPropertiesAsync()) $propertiesType
                $title = $properties.Title; $artist = $properties.Artist
                $album = $properties.AlbumTitle; $trackNumber = $properties.TrackNumber
                $info = $session.GetPlaybackInfo(); $playing = $info.PlaybackStatus.ToString() -eq 'Playing'
                $controls = @{ play=$info.Controls.IsPlayEnabled; pause=$info.Controls.IsPauseEnabled; playPause=$info.Controls.IsPlayPauseToggleEnabled; next=$info.Controls.IsNextEnabled; previous=$info.Controls.IsPreviousEnabled; seek=$false }
                # A missing/failed timeline must not disable otherwise valid transport controls.
                try {
                    $reading = ReadTimeline ($session.GetTimelineProperties()) $playing
                    $positionSeconds = $reading.positionSeconds; $durationSeconds = $reading.durationSeconds; $timelineData = $reading.timeline
                    $controls.seek = $info.Controls.IsPlaybackPositionEnabled -and $null -ne $positionSeconds -and $null -ne $durationSeconds
                } catch { $positionSeconds = $null; $durationSeconds = $null; $timelineData = $null }
            }
            $result = @{ id=$request.id; ok=$true; source=$source; title=$title; artist=$artist; playing=$playing;
                players=@($sessions | ForEach-Object {
                    $name = ProcessName $_.SourceAppUserModelId
                    if (-not $name) { $name = $_.SourceAppUserModelId }
                    @{ source=$_.SourceAppUserModelId; name=$name }
                });
                controls=$controls; positionSeconds=$positionSeconds; durationSeconds=$durationSeconds; timeline=$timelineData; album=$album; trackNumber=$trackNumber;
                volumeAvailable=($null -ne $session -and $volume.Available); volume=$volume.Volume;
                duckEnabled=$enabled; duckFactor=$factor; ducking=($enabled -and ([DateTime]::UtcNow -lt $duckUntil -or [DateTime]::UtcNow -lt $releaseAt)) }
            [Console]::WriteLine(($result | ConvertTo-Json -Depth 5 -Compress))
        } catch {
            [Console]::WriteLine((@{ id=$request.id; ok=$false; error=$_.Exception.Message } | ConvertTo-Json -Compress))
        }
    }
} finally { $volume.Dispose(); $reader.Dispose() }
