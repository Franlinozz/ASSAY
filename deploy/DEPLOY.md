# Assay — deploy runbook (P7)

Live host: a shared Xyndicate VPS (already fronts Occestra via Caddy). Assay is **strictly additive**.

- **Domain:** `assayed.xyz` (apex + www = holding page; `api.assayed.xyz` = MCP).
- **MCP port:** `8422` (8402 was taken on this box).
- **Deploy dir:** `/opt/assay` (git clone). **Data:** `/var/lib/assay`. **Secrets:** `/etc/assay/env` (chmod 600).

## 1. DNS (Namecheap → Advanced DNS)

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `62.171.182.75` | Automatic |
| A | `www` | `62.171.182.75` | Automatic |
| A | `api` | `62.171.182.75` | Automatic |

Remove the default parking `CNAME`/`URL Redirect` records. Caddy issues TLS automatically once these resolve.

## 2. Code + build (on the VPS)

```bash
git clone https://github.com/Franlinozz/ASSAY.git /opt/assay && cd /opt/assay
npm install                     # builds better-sqlite3 for this node; installs esbuild
npm run build -w @xyndicate/mcp-server   # → packages/mcp-server/dist/main.js
npx playwright install chromium # for the dossier job's PDF rendering (live mode)
```

## 3. Secrets + data

```bash
install -d -m 700 /etc/assay /var/lib/assay
install -m 600 /dev/null /etc/assay/env
# fill /etc/assay/env from deploy/env.example (real values; ASY_SIGNING_SECRET=$(openssl rand -hex 32))
```

## 4. Mainnet registry

```bash
ASY_DEPLOYER_PK=0x… npx tsx packages/contracts/scripts/deploy.ts mainnet
# → records address + deployTx + sealTx; put the address in ASY_REGISTRY.
```

## 5. Service

```bash
sed "s#__NODE__#$(command -v node)#" deploy/assay-mcp.service > /etc/systemd/system/assay-mcp.service
systemctl daemon-reload && systemctl enable --now assay-mcp
curl -s localhost:8422/health    # ok:true
```

## 6. Caddy (after DNS resolves)

Append `deploy/Caddyfile.assay` blocks into the box's `/etc/caddy/Caddyfile`, then
`caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`.

## 7. External verification (from a different network)

```
curl https://api.assayed.xyz/health
curl https://api.assayed.xyz/.well-known/assay.json
# unpaid paid-tool call → 402 advertising eip155:196; pay for real → 200 + settlement; anchor lands the leaf.
```
