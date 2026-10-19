$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -Path (Join-Path $PSScriptRoot 'windows-input.cs')
# Line protocol over stdin/stdout; the helper ends when Electron closes stdin.
[GAInput.Helper]::Run()
