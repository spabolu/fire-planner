@description('App Service and database region; use a region with subscription quota.')
param location string = 'westus3'
param appName string
param postgresName string
param tenantId string
param ownerObjectId string
@description('Additional tenant user object IDs allowed to access the same shared planner.')
param additionalUserObjectIds array = []
param signInClientId string
param postgresAdmin string = 'planneradmin'
@secure()
param postgresAdminPassword string
@secure()
param databaseUrl string
@secure()
param ynabToken string
@secure()
@description('Entra confidential-client sign-in secret, stored only in App Service settings.')
param signInClientSecret string
var allowedUserObjectIds = union([ownerObjectId], additionalUserObjectIds)

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: 'asp-fire-planner'
  location: location
  kind: 'linux'
  sku: { name: 'B1', tier: 'Basic', capacity: 1 }
  properties: { reserved: true }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '17'
    administratorLogin: postgresAdmin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Disabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}

resource appDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: database
  name: 'fireplanner'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource app 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'node scripts/migrate.mjs && HOSTNAME=0.0.0.0 node server.js'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      healthCheckPath: '/api/health'
      appSettings: [
        { name: 'APP_AUTH_MODE', value: 'azure' }
        { name: 'APP_ALLOWED_PRINCIPAL_IDS', value: join(allowedUserObjectIds, ',') }
        { name: 'APP_ORIGIN', value: 'https://${appName}.azurewebsites.net' }
        { name: 'DATABASE_URL', value: databaseUrl }
        { name: 'YNAB_ACCESS_TOKEN', value: ynabToken }
        { name: 'MICROSOFT_PROVIDER_AUTHENTICATION_SECRET', value: signInClientSecret }
        { name: 'WEBSITE_AUTH_AAD_ALLOWED_TENANTS', value: tenantId }
        { name: 'NEXT_TELEMETRY_DISABLED', value: '1' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
      ]
    }
  }
}

resource auth 'Microsoft.Web/sites/config@2024-11-01' = {
  parent: app
  name: 'authsettingsV2'
  properties: {
    platform: { enabled: true, runtimeVersion: '~1' }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: [ '/api/health' ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: signInClientId
          clientSecretSettingName: 'MICROSOFT_PROVIDER_AUTHENTICATION_SECRET'
          openIdIssuer: '${environment().authentication.loginEndpoint}${tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [ signInClientId, 'api://${signInClientId}' ]
          defaultAuthorizationPolicy: {
            allowedPrincipals: { identities: allowedUserObjectIds }
          }
        }
      }
    }
    login: { tokenStore: { enabled: true } }
    httpSettings: { requireHttps: true }
  }
}

resource scmBasicAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-11-01' = {
  parent: app
  name: 'scm'
  properties: { allow: false }
}
resource ftpBasicAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-11-01' = {
  parent: app
  name: 'ftp'
  properties: { allow: false }
}

output appUrl string = 'https://${app.properties.defaultHostName}'
output postgresHost string = database.properties.fullyQualifiedDomainName
