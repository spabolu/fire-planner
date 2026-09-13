param postgresName string
param appOutboundIps array
@description('Temporary administration IP; delete its firewall rule after initialization.')
param adminIp string

resource database 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: postgresName
}
resource appRules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [for (ip, index) in appOutboundIps: {
  parent: database
  name: 'app-egress-${index}'
  properties: { startIpAddress: ip, endIpAddress: ip }
}]
resource adminRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: database
  name: 'temporary-initialization'
  properties: { startIpAddress: adminIp, endIpAddress: adminIp }
}
