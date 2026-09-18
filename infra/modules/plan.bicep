@description('App Service Plan (Flex Consumption) name.')
param name string

@description('Azure region for the plan.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Whether the plan is zone redundant. Not supported in all regions.')
param zoneRedundant bool = false

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
    zoneRedundant: zoneRedundant
  }
}

output id string = plan.id
output name string = plan.name