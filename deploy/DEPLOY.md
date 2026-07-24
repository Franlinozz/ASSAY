# Assay — deploy runbook (P7 + P8)

Live host: a shared Xyndicate VPS (already fronts Occestra via Caddy). Assay is **strictly additive**.

- **Domain:** `assayed.xyz` (apex + www = the public Assay Office; `assayed.xyz/docs` = Fumadocs; `api.assayed.xyz` = MCP).
- **Ports:** MCP `8422` · web `3100` · docs `3101` (8402 was taken on this box).
- **Deploy dir:** `/opt/assay` (git clone). **Data:** `/var/lib/assay`. **Secrets:** `/etc/assay/env`, `/etc/assay/web.env`, `/etc/assay/docs.env` (chmod 600).

## Redeploy (P8 web + docs)

```bash
cd /opt/assay && git pull && npm install
npm run build -w @xyndicate/mcp-server && systemctl restart assay-mcp   # toolspec/server changes
npm run build -w @xyndicate/web  && systemctl restart assay-web         # prebuild regenerates the Standard
npm run build -w @xyndicate/docs && systemctl restart assay-docs        # prebuild regenerates tools/standard MDX
```

`apps/web/lib/demo-run.generated.json` (the /evaluation content) is a committed **real pipeline run**, not rebuilt at deploy — regenerate it deliberately with `ASY_PROVIDER_MODE=live node apps/web/scripts/gen-demo.mjs` when the pipeline changes.

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

## 5. Services

```bash
NODE=$(command -v node)
for svc in assay-mcp assay-web assay-docs; do
  sed "s#/usr/bin/node#$NODE#" deploy/$svc.service > /etc/systemd/system/$svc.service
done
# web/docs env (chmod 600): PORT + HOSTNAME=127.0.0.1; web also ASY_API_URL=http://127.0.0.1:8422
systemctl daemon-reload && systemctl enable --now assay-mcp assay-web assay-docs
curl -s localhost:8422/health && curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/ localhost:3101/docs
```

## 6. Caddy (after DNS resolves)

Replace the box's `assayed.xyz` block with `deploy/Caddyfile.assay` (web `:3100`, `/docs*` → `:3101`,
`api.assayed.xyz` → `:8422`), then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`.

## 7. External verification (from a different network)

```
curl https://api.assayed.xyz/health
curl https://api.assayed.xyz/.well-known/assay.json
# unpaid paid-tool call → 402 advertising eip155:196; pay for real → 200 + settlement; anchor lands the leaf.
```
