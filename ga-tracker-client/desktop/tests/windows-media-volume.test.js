'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('native Core Audio matching accepts Apple helper only from the same running Apple Music package',{skip:process.platform!=='win32'},()=>{
 const source=path.join(__dirname,'../lib/windows-media-volume.cs').replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop'
Add-Type -Path '${source}'
$method=[GAMedia.SessionVolume].GetMethod('MatchesAudioProcess',[Reflection.BindingFlags]'NonPublic,Static')
function Match($selected,$name,$file,[string[]]$owners){return $method.Invoke($null,[object[]]@($selected,$name,$file,$owners))}
function Check($value,$message){if(-not $value){throw $message}}
$dir='C:\\Program Files\\WindowsApps\\AppleInc.AppleMusicWin_1.0_x64__vendor'
$owner=$dir+'\\AppleMusic.exe';$agent=$dir+'\\AMPLibraryAgent.exe'
Check (Match 'AppleMusic' 'AMPLibraryAgent' $agent @($owner)) 'real package helper'
Check (Match 'applemusic' 'amplibraryagent' $agent @($owner)) 'case insensitive'
Check (-not (Match 'AppleMusic' 'AMPLibraryAgent' $agent @())) 'missing owner rejected'
Check (-not (Match 'AppleMusic' 'AMPLibraryAgent' $agent @('C:\\Other\\AppleMusic.exe'))) 'other package rejected'
Check (-not (Match 'AppleMusic' 'AMPLibraryAgent' 'C:\\Other\\AMPLibraryAgent.exe' @('C:\\Other\\AppleMusic.exe'))) 'unrecognized package rejected'
Check (-not (Match 'chrome' 'AMPLibraryAgent' $agent @($owner))) 'other selected player rejected'
Check (Match 'chrome' 'chrome' '' @()) 'existing browser mapping preserved'
Check (Match 'AppleMusic' 'AppleMusic' '' @()) 'direct Apple audio preserved'
'VOLUME_MATCH_CASES_OK:8'
`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ga-volume-test-')),file=path.join(dir,'test.ps1');
 try{fs.writeFileSync(file,script);const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/VOLUME_MATCH_CASES_OK/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
