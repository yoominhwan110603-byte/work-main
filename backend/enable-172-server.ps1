$ErrorActionPreference = 'Continue'
$ip = Get-NetIPAddress -AddressFamily IPv4 -IPAddress '172.30.14.95' -ErrorAction SilentlyContinue
if (-not $ip) {
  New-NetIPAddress -InterfaceAlias 'Wi-Fi' -IPAddress '172.30.14.95' -PrefixLength 24
}
$rule = Get-NetFirewallRule -DisplayName 'VinylCheck FastAPI 8000' -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -DisplayName 'VinylCheck FastAPI 8000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Any
}
