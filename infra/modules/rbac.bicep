@description('Name of the storage account the Function App identity needs access to.')
param storageAccountName string

@description('Principal ID of the Function App system-assigned managed identity.')
param principalId string

// Built-in role definition IDs (least privilege, data-plane only, scoped to this storage account).
var roleDefinitionIds = {
  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  storageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  storageTableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// Required for Flex Consumption identity-based deployment package access (blob container).
resource blobDataOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, roleDefinitionIds.storageBlobDataOwner)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionIds.storageBlobDataOwner)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Required for identity-based AzureWebJobsStorage (host runtime state, triggers).
resource queueDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, roleDefinitionIds.storageQueueDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionIds.storageQueueDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Required for identity-based AzureWebJobsStorage (host runtime state, timers/leases).
resource tableDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, roleDefinitionIds.storageTableDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionIds.storageTableDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}