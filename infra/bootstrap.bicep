// One-time, manually-run bootstrap for GitHub Actions OIDC deployment access. Run this once
// (e.g. `az deployment sub create --location <region> --template-file infra/bootstrap.bicep
// --parameters resourceGroupName=<rg>`) with a privileged account before infra/main.bicep and
// .github/workflows/deploy-functions.yml are used. It creates (or reuses) the target resource
// group, a user-assigned managed identity federated to this repository's `main` branch via
// GitHub OIDC (no client secret is ever stored), and the minimum role assignments -- scoped
// only to that resource group -- needed for subsequent `infra/main.bicep` deployments and
// Function code deployment. Re-running is safe (idempotent).
targetScope = 'subscription'

@description('Azure region for the resource group and identity.')
param location string

@description('Name of the resource group that will host the MCP registry Function App. Created if it does not already exist.')
param resourceGroupName string

@description('Name of the user-assigned managed identity used by GitHub Actions.')
param identityName string = 'id-mcpregistry-deploy'

@description('GitHub organization that owns the repository.')
param githubOrg string = 'ghec-20260422-main-org'

@description('GitHub repository name (without org).')
param githubRepo string = 'mcp-registry-sample'

@description('Git branch allowed to federate as this identity.')
param githubBranch string = 'main'

@description('Tags applied to the resource group.')
param tags object = {}

resource rg 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module bootstrapIdentity 'modules/bootstrapIdentity.bicep' = {
  name: 'bootstrapIdentity'
  scope: rg
  params: {
    location: location
    identityName: identityName
    githubOrg: githubOrg
    githubRepo: githubRepo
    githubBranch: githubBranch
  }
}

@description('Client (application) ID to set as the AZURE_CLIENT_ID repository variable.')
output clientId string = bootstrapIdentity.outputs.clientId

@description('Tenant ID to set as the AZURE_TENANT_ID repository variable.')
output tenantId string = subscription().tenantId

@description('Subscription ID to set as the AZURE_SUBSCRIPTION_ID repository variable.')
output subscriptionId string = subscription().subscriptionId

@description('Resource group name to set as the AZURE_RESOURCE_GROUP repository variable.')
output resourceGroupName string = rg.name