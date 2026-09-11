# Run one scenario step on the USB-connected Android phone, then save a real
# screenshot (keyboard + browser chrome included) and the measure.js snapshot to
# docs/mobile-ux/<Site>/<Step>.png / .json.
#
# Tap coordinates are device pixels = pixel coordinates in a previous screenshot.
# adb "input text" is Latin-only; spaces are converted to %s.
#
# Examples:
#   ./capture.ps1 -Site baseline -Step 01-chat-closed
#   ./capture.ps1 -Site baseline -Step 03-input-focused -Tap 540,2050
#   ./capture.ps1 -Site baseline -Step 04-sent -Text "usb c cable 100w" -Enter -WaitMs 8000
#   ./capture.ps1 -Site baseline -Step 06-keyboard-hidden -Back
#   ./capture.ps1 -Site competitors/tidio -Step 03-input-focused -Tap 540,2050 -Match tidio.com
#   ./capture.ps1 -Site competitors/tidio -Step 01-chat-closed -Url https://www.tidio.com/ -Match tidio.com -WaitMs 6000
#   ./capture.ps1 -Site competitors/tidio -Step 03b-input-focused -Match tidio.com `
#     -Setup 'window.__mrSelectors = { shadowHost: "#tidio-chat", window: ".chat", header: "#header", messages: ".conversation", input: ".input-group" }'
param(
  [Parameter(Mandatory)] [string] $Site,
  [Parameter(Mandatory)] [string] $Step,
  [string] $Url,
  [int[]] $Tap,
  [string] $Text,
  [switch] $Enter,
  [switch] $Back,
  [int] $WaitMs = 1500,
  [string] $Match = "informatica.com.ua",
  # JS run in the page before measuring (e.g. set window.__mrSelectors for a competitor widget)
  [string] $Setup = "",
  # Android package of the browser under test (stable Chrome: com.android.chrome)
  [string] $Browser = "com.chrome.beta"
)

$adb = (Get-Command adb -ErrorAction SilentlyContinue).Source ?? "C:\tools\platform-tools\adb.exe"
$root = Resolve-Path "$PSScriptRoot\..\.."
$outDir = Join-Path $root "docs\mobile-ux\$Site"
New-Item -ItemType Directory -Force $outDir | Out-Null

$power = (& $adb shell "dumpsys power | grep mWakefulness=; dumpsys window | grep mDreamingLockscreen") -join "`n"
if ($power -notmatch 'mWakefulness=Awake' -or $power -match 'mDreamingLockscreen=true') {
  Write-Warning "Phone screen is off or locked. Unlock it (tip: Developer options > Stay awake)."
  exit 1
}

if ($Url) {
  & $adb shell am start -a android.intent.action.VIEW -d "'$Url'" $Browser | Out-Null
}

# Each running Chrome flavour gets its own DevTools socket: the first one started
# takes "chrome_devtools_remote", later ones "chrome_devtools_remote_<pid>".
$browserPid = "$(& $adb shell pidof $Browser)".Trim()
$sockets = (& $adb shell "grep -o '@chrome_devtools_remote[_0-9]*' /proc/net/unix") -join "`n"
$socket = if ($browserPid -and $sockets -match "chrome_devtools_remote_$browserPid\b") { "chrome_devtools_remote_$browserPid" } else { "chrome_devtools_remote" }
& $adb forward tcp:9222 localabstract:$socket | Out-Null

if ($Tap) {
  & $adb shell input tap $Tap[0] $Tap[1]
  Start-Sleep -Milliseconds 700
}
if ($Text) { & $adb shell input text ($Text -replace ' ', '%s') }
if ($Enter) { & $adb shell input keyevent 66 }
if ($Back) { & $adb shell input keyevent 4 }
Start-Sleep -Milliseconds $WaitMs

$png = Join-Path $outDir "$Step.png"
& $adb shell screencap -p /sdcard/mr-capture.png
& $adb pull /sdcard/mr-capture.png $png | Out-Null
& $adb shell rm /sdcard/mr-capture.png

$json = Join-Path $outDir "$Step.json"
$snapshot = node (Join-Path $PSScriptRoot "cdp-eval.mjs") $Match 9222 $Setup
if ($LASTEXITCODE -eq 0) {
  $snapshot | Out-File -Encoding utf8 $json
  Write-Host "Saved $png and $json"
} else {
  Write-Warning "Saved $png, but no measurement (is the '$Match' tab on screen in ${Browser}?)"
}
