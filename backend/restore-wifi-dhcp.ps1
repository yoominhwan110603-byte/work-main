$ErrorActionPreference = 'Continue'
Set-NetIPInterface -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -Dhcp Enabled
Set-DnsClientServerAddress -InterfaceAlias 'Wi-Fi' -ResetServerAddresses
Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -PrefixOrigin Manual -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false
ipconfig /release "Wi-Fi"
ipconfig /renew "Wi-Fi"
ipconfig /flushdns
