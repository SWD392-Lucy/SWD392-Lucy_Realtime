param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AccessToken = "",
  [string]$LucyToken = "",
  [string]$JoinAccessToken = ""
)

$ErrorActionPreference = "Stop"

function New-TestToken {
  param(
    [string]$UserId,
    [string]$Role,
    [bool]$IsAnonymous
  )

  $anonymous = if ($IsAnonymous) { "true" } else { "false" }
  return node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({sub:'$UserId',role:'$Role',isAnonymous:$anonymous}, 'LOCAL_DEV_SECRET_CHANGE_BEFORE_PRODUCTION_32_BYTES', {algorithm:'HS256',issuer:'lucy.identity',audience:'lucy.clients',expiresIn:'1h'}));"
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
  $AccessToken = New-TestToken -UserId "11111111-1111-1111-1111-111111111111" -Role "Pro" -IsAnonymous $false
}

if ([string]::IsNullOrWhiteSpace($LucyToken)) {
  $LucyToken = New-TestToken -UserId "22222222-2222-2222-2222-222222222222" -Role "Lucy" -IsAnonymous $true
}

Write-Step "Health"
$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/health"
$health | Format-List

Write-Step "Create room as Pro"
$roomBody = @{
  title = "Manual Smoke Room"
  language = "ENGLISH"
  level = 1
  maxParticipants = 50
} | ConvertTo-Json

$room = Invoke-RestMethod -Method Post `
  -Uri "$BaseUrl/api/rooms" `
  -Headers @{ Authorization = "Bearer $AccessToken" } `
  -ContentType "application/json" `
  -Body $roomBody

$room | Format-List
$roomId = $room.id

Write-Step "List rooms"
Invoke-RestMethod -Method Get `
  -Uri "$BaseUrl/api/rooms" `
  -Headers @{ Authorization = "Bearer $AccessToken" } | Format-Table id,title,status,activeMemberCount

Write-Step "Get room detail"
Invoke-RestMethod -Method Get `
  -Uri "$BaseUrl/api/rooms/$roomId" `
  -Headers @{ Authorization = "Bearer $AccessToken" } | Format-List

Write-Step "Lucy cannot create room"
try {
  Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/rooms" `
    -Headers @{ Authorization = "Bearer $LucyToken" } `
    -ContentType "application/json" `
    -Body $roomBody | Out-Null
  throw "Expected Lucy create room to fail, but it succeeded."
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 403) {
    throw
  }
  Write-Host "PASS: Lucy create room returned 403." -ForegroundColor Green
}

if (-not [string]::IsNullOrWhiteSpace($JoinAccessToken)) {
  Write-Step "Join room with real Identity token"
  $join = Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/rooms/$roomId/join" `
    -Headers @{ Authorization = "Bearer $JoinAccessToken" }
  $join | Format-List

  Write-Step "Unmute mic"
  Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/rooms/$roomId/mic" `
    -Headers @{ Authorization = "Bearer $JoinAccessToken" } `
    -ContentType "application/json" `
    -Body (@{ muted = $false } | ConvertTo-Json) | Format-List

  Write-Step "Raise hand"
  Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/rooms/$roomId/hand" `
    -Headers @{ Authorization = "Bearer $JoinAccessToken" } `
    -ContentType "application/json" `
    -Body (@{ raised = $true } | ConvertTo-Json) | Format-List

  Write-Step "Leave room"
  Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/rooms/$roomId/leave" `
    -Headers @{ Authorization = "Bearer $JoinAccessToken" } | Format-List
} else {
  Write-Step "Join/mic/hand skipped"
  Write-Host "Pass -JoinAccessToken with a real Identity token after setting Agora env to test join/mic/hand/leave." -ForegroundColor Yellow
}

Write-Step "Done"
Write-Host "Created room id: $roomId" -ForegroundColor Green
