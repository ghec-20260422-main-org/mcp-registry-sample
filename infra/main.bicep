// Deploys the Azure Functions v4 (Node.js 22) MCP registry API on a Flex Consumption (FC1)
// plan, with zero always-ready instances, managed-identity-based storage access, and
// Application Insights / Log Analytics monitoring. Deploy this template into an existing
// resource group (see infra/bootstrap.bicep for the one-time subscription-level setup that
// grants a CI identity permission to run this deployment).
targetScope = 'resourceGroup'

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@minLength(1)
@maxLength(16)
@description('Short environment name (e.g. prod, staging) used to build a stable resource token and as a tag.')
param environmentName string = 'prod'

@description('Optional explicit Function App name. When empty, a name is generated from environmentName and a resource-group-scoped hash.')
param functionAppName string = ''

@description('Additional tags merged into every resource.')
param tags object = {}

@minValue(40)
@maxValue(1000)
@description('Maximum number of Flex Consumption instances.')
param maximumInstanceCount int = 40

@allowed([512, 2048, 4096])
@description('Memory size (MB) per Flex Consumption instance.')
param instanceMemoryMB int = 2048

@description('Node.js major version for the Functions runtime.')
param nodeVersion string = '22'

var resourceToken = uniqueString(resourceGroup().id, environmentName)
var baseTags = union(tags, {
  environment: environmentName
  workload: 'mcp-registry'
})

var resolvedFunctionAppName = !empty(functionAppName) ? functionAppName : 'func-mcpregistry-${environmentName}-${resourceToken}'
var storageAccountName = take(toLower(replace('stmcpreg${resourceToken}', '-', '')), 24)
var planName = 'plan-mcpregistry-${environmentName}-${resourceToken}'
var logAnalyticsName = take('log-mcpregistry-${environmentName}-${resourceToken}', 63)
var appInsightsName = take('appi-mcpregistry-${environmentName}-${resourceToken}', 260)
var deploymentContainerName = take('app-package-${take(toLower(resolvedFunctionAppName), 32)}-${take(resourceToken, 7)}', 63)

module logAnalytics 'modules/logAnalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    name: logAnalyticsName
    location: location
    tags: baseTags
  }
}

module appInsights 'modules/appInsights.bicep' = {
  name: 'appInsights'
  params: {
    name: appInsightsName
    location: location
    tags: baseTags
    workspaceResourceId: logAnalytics.outputs.id
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    #disable-next-line BCP334
    name: storageAccountName
    location: location
    tags: baseTags
    deploymentContainerName: deploymentContainerName
  }
}

module plan 'modules/plan.bicep' = {
  name: 'plan'
  params: {
    name: planName
    location: location
    tags: baseTags
  }
}

module functionApp 'modules/functionApp.bicep' = {
  name: 'functionApp'
  params: {
    name: resolvedFunctionAppName
    location: location
    tags: baseTags
    planId: plan.outputs.id
    storageAccountName: storage.outputs.name
    storageBlobEndpoint: storage.outputs.primaryBlobEndpoint
    deploymentContainerName: deploymentContainerName
    appInsightsConnectionString: appInsights.outputs.connectionString
    nodeVersion: nodeVersion
    maximumInstanceCount: maximumInstanceCount
    instanceMemoryMB: instanceMemoryMB
  }
}

module rbac 'modules/rbac.bicep' = {
  name: 'rbac'
  params: {
    storageAccountName: storage.outputs.name
    principalId: functionApp.outputs.systemAssignedIdentityPrincipalId
  }
}

@description('Name of the deployed Function App.')
output functionAppName string = functionApp.outputs.name

@description('Default hostname of the deployed Function App.')
output functionAppHostName string = functionApp.outputs.defaultHostName

@description('Base URL of the deployed MCP registry (registry v0.1 API root).')
output registryUrl string = 'https://${functionApp.outputs.defaultHostName}/v0.1'

@description('Name of the backing storage account.')
output storageAccountName string = storage.outputs.name