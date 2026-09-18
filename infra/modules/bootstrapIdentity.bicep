@description('Azure region for the identity resource.')
param location string

@description('Name of the user-assigned managed identity used by GitHub Actions.')
param identityName string

@description('GitHub organization that owns the repository.')
param githubOrg string

@description('GitHub repository name (without org).')
param githubRepo string

@description('Git branch allowed to federate as this identity (e.g. main).')
param githubBranch string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource federatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: identity
  name: 'github-${githubBranch}-branch'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrg}/${githubRepo}:ref:refs/heads/${githubBranch}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Contributor: lets the CI identity deploy/manage resources defined by infra/main.bicep and
// the Function App's code package, scoped to this resource group only.
resource contributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, identity.id, 'Contributor')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// User Access Administrator: lets the CI identity grant the Function App's own managed
// identity the least-privilege storage RBAC roles defined in infra/modules/rbac.bicep,
// scoped to this resource group only (cannot escalate outside the group).
resource userAccessAdminAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, identity.id, 'UserAccessAdministrator')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '18d7d88d-d35e-4fb5-a5c3-7773c20a72d9')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output clientId string = identity.properties.clientId
output principalId string = identity.properties.principalId
output resourceId string = identity.id