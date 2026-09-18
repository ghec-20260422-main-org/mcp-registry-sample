@description('Function App name.')
param name string

@description('Azure region for the Function App.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Resource ID of the Flex Consumption (FC1) App Service Plan.')
param planId string

@description('Name of the storage account backing this Function App.')
param storageAccountName string

@description('Blob endpoint of the backing storage account, e.g. https://<account>.blob.core.windows.net/.')
param storageBlobEndpoint string

@description('Name of the blob container used for Flex Consumption deployment packages.')
param deploymentContainerName string

@description('Connection string of the linked Application Insights component.')
@secure()
param appInsightsConnectionString string

@description('Node.js major version for the Functions runtime, e.g. 22.')
param nodeVersion string = '22'

@minValue(40)
@maxValue(1000)
@description('Maximum number of Flex Consumption instances.')
param maximumInstanceCount int = 40

@allowed([512, 2048, 4096])
@description('Memory size (MB) per Flex Consumption instance.')
param instanceMemoryMB int = 2048

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: 'https://${storageAccountName}.blob.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: 'https://${storageAccountName}.queue.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: 'https://${storageAccountName}.table.${environment().suffixes.storage}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageBlobEndpoint}${deploymentContainerName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
        // Explicit empty array = zero always-ready instances (pure pay-per-use scaling).
        alwaysReady: []
      }
      runtime: {
        name: 'node'
        version: nodeVersion
      }
    }
  }
}

output id string = functionApp.id
output name string = functionApp.name
output defaultHostName string = functionApp.properties.defaultHostName
output systemAssignedIdentityPrincipalId string = functionApp.identity.principalId