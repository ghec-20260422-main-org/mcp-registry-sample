# Azure Functions MCP Registry

GitHub CopilotのMCP Registry制限機能を検証するための、読み取り専用MCP Registry v0.1 APIです。TypeScript／Node.js 22のAzure Functions v4アプリケーションとして実装し、低アクセス時のコストを抑えるためFlex Consumption（FC1、always-readyなし）へデプロイします。

## API

GitHub Copilotが要求する3つのエンドポイントと、Generic Registry APIのバージョン一覧を実装しています。

```text
GET /v0.1/servers
GET /v0.1/servers/{serverName}/versions
GET /v0.1/servers/{serverName}/versions/latest
GET /v0.1/servers/{serverName}/versions/{version}
```

補助エンドポイントも利用できます。

```text
GET /             # API情報
GET /v0.1/health  # liveness
```

`/v0.1/servers`配下では`OPTIONS`に応答し、すべての成功・エラーレスポンスで次の要件を満たします。

```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

一覧では`search`、`version`、`limit`、`cursor`、`updated_since`、`include_deleted`を利用できます。現在登録しているサーバーは次の2件です。

| サーバー | canonical ID | 接続先 |
| --- | --- | --- |
| GitHub MCP Server | `io.github.github/github-mcp-server` | `https://api.githubcopilot.com/mcp/` |
| Postman MCP Server | `com.postman/postman-mcp-server` | `https://mcp.postman.com/minimal` |

定義を変更するときは[`src/registry-data.ts`](src/registry-data.ts)を編集します。認証情報やAPIキーはレジストリに保存しません。

## ローカル開発

Node.js 22を使用します。

```powershell
npm ci
npm run check
npm test
npm run build
```

Azure Functions Core Tools v4がインストールされている環境では、ビルド後にローカルホストを起動できます。

```powershell
npm run build
npm start
```

## Azure構成

[`infra/main.bicep`](infra/main.bicep)は専用Resource Group内に次のリソースを作成します。

- Node.js 22 Azure Function App
- Flex Consumption（FC1）App Service Plan
- Functionsホストと非公開デプロイパッケージ用Storage Account
- Log Analytics WorkspaceとApplication Insights
- Function AppのManaged Identityに必要なStorageデータプレーンRBAC

Function AppはHTTPSのみ、TLS 1.2以上、FTPS無効で構成されます。Storageの共有キーとBlobの匿名公開も無効です。Function AppからStorageへはManaged Identityで接続します。

### 1. OIDCを一度だけ初期構築する

GitHub ActionsがAzureへ接続するための信頼関係は、それ自身では作成できません。Azure CLIでサインインした権限のある運用者が、最初の一度だけ[`infra/bootstrap.bicep`](infra/bootstrap.bicep)を実行します。

```powershell
$location = "japaneast"
$resourceGroup = "rg-mcp-registry-prod"

az login
az account set --subscription "<subscription-id>"
az deployment sub create `
  --name "bootstrap-mcp-registry" `
  --location $location `
  --template-file infra/bootstrap.bicep `
  --parameters location=$location resourceGroupName=$resourceGroup `
  --query properties.outputs
```

このデプロイは次を作成します。

- 専用Resource Group
- GitHub Actions用User Assigned Managed Identity
- `ghec-20260422-main-org/mcp-registry-sample`の`main`ブランチだけを信頼するFederated Credential
- 対象Resource Groupに限定した`Contributor`と`User Access Administrator`

`User Access Administrator`は、WorkflowがFunction AppのManaged IdentityへStorageロールを割り当てるために必要です。権限は専用Resource Group外には及びません。

### 2. GitHub Repository Variablesを設定する

bootstrapの出力を、リポジトリの **Settings > Secrets and variables > Actions > Variables** に登録します。

| Variable | 値 |
| --- | --- |
| `AZURE_CLIENT_ID` | `clientId`出力 |
| `AZURE_TENANT_ID` | `tenantId`出力 |
| `AZURE_SUBSCRIPTION_ID` | `subscriptionId`出力 |
| `AZURE_RESOURCE_GROUP` | `resourceGroupName`出力 |
| `AZURE_ENV_NAME` | 任意。省略時は`prod` |
| `AZURE_FUNCTIONAPP_NAME` | 任意。省略時はBicepが一意名を生成 |

client secretや発行プロファイルは使用しません。GitHub Actionsの`id-token: write`とAzure Workload Identity Federationで認証します。

### 3. デプロイする

`main`へのpush、またはActions画面から **Deploy MCP registry to Azure Functions** を手動実行します。Workflowは次を順番に実施します。

1. 型チェックを含むビルドと自動テスト
2. Bicepの検証とAzureリソースの更新
3. production依存関係を含むFunctionパッケージのデプロイ
4. ルート、health、一覧、CORSプリフライト、URLエンコード済みserver IDのライブスモークテスト

デプロイ後にMCP Registry URLとして設定する値は次の形式です。

```text
https://<function-app-name>.azurewebsites.net/v0.1/servers
```

## 切り替えと旧GitHub Pagesの停止

旧GitHub PagesのWorkflowと静的生成資産はこの実装で削除しています。既存URLを利用中の場合は、次の順番で切り替えてダウンタイムを避けます。

1. Azure Functions Workflowが成功したことを確認する。
2. Actionsのスモークテスト結果とAzure URLのレスポンスを確認する。
3. GitHub Enterprise／OrganizationのMCP Registry URLを新しい`/v0.1/servers` URLへ変更する。
4. クライアントでサーバー一覧と接続制限が反映されることを確認する。
5. リポジトリの **Settings > Pages > Build and deployment** で公開を無効化する。

PagesはAzure側の検証が終わる前に無効化しないでください。

## コストと撤去

Flex Consumptionはalways-readyインスタンスを構成していないため、Function実行量とメモリ使用量に応じて課金されます。この小規模なRegistryでは、API Center Standardの固定時間課金より大幅に低コストになる想定です。別途、少量のStorageとApplication Insights／Log Analyticsの使用料が発生する可能性があります。

すべてのAzureリソースは専用Resource Groupに配置されます。検証を終了するときはResource Groupを削除すると一括撤去できます。

```powershell
az group delete --name "rg-mcp-registry-prod" --yes
```

削除後はGitHub Repository Variablesも削除してください。
