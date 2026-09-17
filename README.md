# 検証用 MCP レジストリ

GitHub Copilot の MCP レジストリ制限機能を検証するための、git-based MCP レジストリ設定です。
このリポジトリは `mcp-registry-template` の形式で定義を管理し、GitHub Actions で
MCP Registry v0.1 API の静的レスポンスを生成して GitHub Pages に公開します。

## 公開 URL

GitHub Pages のデプロイ後、サイトのルート URL は次の通りです。この URL は、
MCP registry URL としてそのまま利用できます。

```text
https://ghec-20260422-main-org.github.io/mcp-registry-sample/
```

GitHub Pages のルートにはサイトの案内ページを配置します。GitHub Copilot の
レジストリ設定には、API のベース URL として次の URL を指定します。

```text
https://ghec-20260422-main-org.github.io/mcp-registry-sample/v0.1/servers
```

検証時は次のエンドポイントが利用できます。

```text
GET /v0.1/servers
GET /v0.1/servers/{serverName}/versions/latest
GET /v0.1/servers/{serverName}/versions/{version}
```

> [!NOTE]
> GitHub Pages はカスタムレスポンスヘッダーを設定できません。通常は
> `Access-Control-Allow-Origin: *` が付与されますが、GitHub がレジストリに要求する
> CORSヘッダー3種を明示制御できないため、この構成は検証用途に限定します。

## 登録サーバー

| サーバー | canonical ID | 接続先 |
| --- | --- | --- |
| GitHub 公式 MCP サーバー | `io.github.github/github-mcp-server` | `https://api.githubcopilot.com/mcp/` |
| Postman 公式 MCP サーバー | `com.postman/postman-mcp-server` | `https://mcp.postman.com/minimal` |

どちらもリモートの Streamable HTTP サーバーです。定義は
[`registry.json`](registry.json) と `mcps/` 配下の `server.json` にあります。
各定義の `1.0.0` は、この検証用レジストリエントリのバージョンです。

## 認証

- GitHub MCP は接続時に GitHub OAuth を使用します。
- Postman MCP は Postman の OAuth または API キーを `Authorization` ヘッダーに設定します。

認証情報や API キーはこのリポジトリに保存しません。クライアント側の MCP 設定で
認証を完了してください。

## デプロイ

1. リポジトリの **Settings > Pages > Build and deployment** で Source を
   **GitHub Actions** に設定します。
2. `main` ブランチへのpush、またはActions画面からの手動実行で
   `Deploy MCP registry to GitHub Pages` Workflowを起動します。
3. Workflowの完了を確認します。

Workflow は [`scripts/Build-Registry.ps1`](scripts/Build-Registry.ps1) を実行し、
`registry.json` が参照する定義から、一覧・latest・指定バージョンのレスポンスを
静的ファイルとして生成します。一覧は `servers/index.html`、個別レスポンスは
拡張子なしのファイルとして配置し、GitHub Pages のパス解決を利用します。

公開後は次のコマンドで確認できます。

```powershell
$baseUrl = "https://ghec-20260422-main-org.github.io/mcp-registry-sample"
curl.exe "$baseUrl/v0.1/servers"
curl.exe "$baseUrl/v0.1/servers/io.github.github/github-mcp-server/versions/latest"
curl.exe "$baseUrl/v0.1/servers/com.postman/postman-mcp-server/versions/latest"
```

## 構成の変更

サーバーを追加・削除する場合は、`registry.json` の
`servers_relative_path` と対応する `mcps/{author}/{name}/server.json` を更新します。
サーバー ID はクライアント側の MCP 設定で使う canonical ID と一致させてください。
`main` への反映後、Workflow が Pages の静的APIを再生成します。
