'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('production PowerShell timeline converter: Chrome negative EndTime, pause, missing data and bounds',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(path.join(__dirname,'../lib/windows-media.ps1'),'utf8');
 const start=source.indexOf('function ReadTimeline('),end=source.indexOf('$manager = Await',start);
 const script=source.slice(start,end)+`
$ErrorActionPreference='Stop'
$at=([datetimeoffset]'2026-10-15T06:21:14Z').UtcDateTime
function Timeline($position,$start,$end,$updated){return [pscustomobject]@{Position=[timespan]::FromSeconds($position);StartTime=[timespan]::FromSeconds($start);EndTime=[timespan]::FromSeconds($end);LastUpdatedTime=[datetimeoffset]$updated}}
function Check($condition,$message){if(-not $condition){throw $message}}
$v=ReadTimeline (Timeline 0.010672 0 -0.000001 ($at.AddSeconds(-10))) $true $at
Check ([Math]::Abs($v.positionSeconds-10.010672) -lt 0.001) 'fresh position must survive missing duration'
Check ($null -eq $v.durationSeconds) 'negative EndTime is not duration'
$v=ReadTimeline (Timeline 30 0 200 ($at.AddSeconds(-67))) $false $at
Check ($v.positionSeconds -eq 30 -and $v.durationSeconds -eq 200) 'paused native clock'
$v=ReadTimeline (Timeline 0 0 0 ([datetime]::SpecifyKind([datetime]::MinValue,[DateTimeKind]::Utc))) $true $at
Check ($null -eq $v.positionSeconds -and $null -eq $v.durationSeconds) 'all-zero timeline absent'
$v=ReadTimeline (Timeline 130 100 300 $at) $false $at
Check ($v.positionSeconds -eq 30 -and $v.durationSeconds -eq 200) 'nonzero StartTime'
$v=ReadTimeline (Timeline 190 0 200 ($at.AddSeconds(-20))) $true $at
Check ($v.positionSeconds -eq 200) 'native duration clamp'
$v=ReadTimeline (Timeline -2 0 300 $at) $false $at
Check ($null -eq $v.positionSeconds -and $v.durationSeconds -eq 300) 'duration independent of bad position'
$v=ReadTimeline (Timeline 330.403561 0 -0.000001 ($at.AddSeconds(-205))) $true $at
Check ($null -eq $v.positionSeconds -and $null -eq $v.durationSeconds) 'stale previous-track position must not run away'
$tl=Timeline 130 100 300 $at
$tl | Add-Member NoteProperty MinSeekTime ([timespan]::FromSeconds(100))
$tl | Add-Member NoteProperty MaxSeekTime ([timespan]::FromSeconds(300))
$info=[pscustomobject]@{Controls=[pscustomobject]@{IsPlaybackPositionEnabled=$true};PlaybackStatus='Paused'}
Check ((SeekTarget $tl $info ([pscustomobject]@{positionSeconds=25}) $at) -eq [timespan]::FromSeconds(125).Ticks) 'seek adds nonzero start offset'
Check ((SeekTarget $tl $info ([pscustomobject]@{positionSeconds=250}) $at) -eq [timespan]::FromSeconds(300).Ticks) 'seek clamps to duration'
foreach($target in @(-1,86400,[double]::NaN,[double]::PositiveInfinity)){$rejected=$false;try{SeekTarget $tl $info ([pscustomobject]@{positionSeconds=$target}) $at}catch{$rejected=$true};Check $rejected 'invalid seek rejected'}
$info.Controls.IsPlaybackPositionEnabled=$false
$rejected=$false;try{SeekTarget $tl $info ([pscustomobject]@{positionSeconds=10}) $at}catch{$rejected=$true};Check $rejected 'unsupported seek rejected'
'NATIVE_TIMELINE_AND_SEEK_CASES_OK'

`;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ga-media-timeline-')),file=path.join(directory,'test.ps1');
 try{fs.writeFileSync(file,script);const run=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/NATIVE_TIMELINE_AND_SEEK_CASES_OK/);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
