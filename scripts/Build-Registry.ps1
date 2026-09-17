param(
    [string]$OutputPath = "_site"
)

$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$registryPath = Join-Path $repositoryRoot "registry.json"
$outputRoot = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
} else {
    Join-Path $repositoryRoot $OutputPath
}
$registry = Get-Content -Raw $registryPath | ConvertFrom-Json
$serverRecords = @()

foreach ($relativePath in $registry.registries.servers_relative_path) {
    $serverPath = Join-Path $repositoryRoot $relativePath
    $server = Get-Content -Raw $serverPath | ConvertFrom-Json
    $serverRecords += [ordered]@{
        server = $server
    }

    $versionRoot = Join-Path $outputRoot "v0.1/servers/$($server.name)/versions"
    New-Item -ItemType Directory -Force $versionRoot | Out-Null

    $response = [ordered]@{
        server = $server
    } | ConvertTo-Json -Depth 100 -Compress

    Set-Content -NoNewline -Encoding utf8 (Join-Path $versionRoot $server.version) $response
    Set-Content -NoNewline -Encoding utf8 (Join-Path $versionRoot "latest") $response
}

$listRoot = Join-Path $outputRoot "v0.1/servers"
New-Item -ItemType Directory -Force $listRoot | Out-Null

$listResponse = [ordered]@{
    servers = $serverRecords
    metadata = [ordered]@{
        count = $serverRecords.Count
    }
} | ConvertTo-Json -Depth 100 -Compress

Set-Content -NoNewline -Encoding utf8 (Join-Path $listRoot "index.html") $listResponse
Set-Content -NoNewline -Encoding utf8 (Join-Path $outputRoot ".nojekyll") ""
