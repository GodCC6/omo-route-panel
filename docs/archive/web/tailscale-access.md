# Optional Remote Access via Tailscale

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Running a background service or exposing OMO Route Panel over Tailscale is completely optional. For local desktop inspection and editing, the standard `node dist/src/cli.js --project <path>` command in `README.md` is sufficient.

## Architecture & Security Model

```text
https://<host>.<tailnet>.ts.net:9443/
```

In Tailscale remote mode, the application on your macOS host still listens exclusively on `127.0.0.1:4177`. Tailscale Serve terminates private HTTPS on port `9443` and proxies requests to `http://127.0.0.1:4177`. Tailscale Funnel is never enabled, so no public internet listener is exposed, and any existing Serve rules on other ports (such as `443`) remain untouched.

Access is restricted to devices authenticated as the same Tailscale user within your tailnet:

1. You open `https://<host>.<tailnet>.ts.net:9443/` directly without copying a URL fragment token from the host machine.
2. Tailscale Serve injects authenticated identity headers (`Tailscale-User-Login`).
3. The panel verifies the HTTPS origin, loopback proxy boundary, allowed Tailscale login name, and same-origin constraints, then issues an ephemeral bearer token to browser memory via `GET /api/session`.
4. The token never appears in URLs, terminal logs, files, `localStorage`, or `sessionStorage`. Subsequent API calls require both the valid `Authorization: Bearer` header and matching Tailscale user identity.
5. Tag-authenticated client nodes (where Tailscale omits user login identity) are rejected. This mode trusts the local host's loopback proxy and is not designed as a multi-user isolation boundary on a shared machine.

## Installing or Updating the Optional User `launchd` Service

On macOS, `scripts/service.mjs` manages an optional user LaunchAgent (`com.omo-route-panel.web`) with `RunAtLoad` and `KeepAlive` so the service starts at login and recovers automatically after restarts without depending on an interactive terminal session.

**Install or update the service (with editing enabled)**:

```sh
node scripts/service.mjs --project ~/path/to/your-project --edit
```

Omit `--edit` to run the managed service in read-only mode.

**Preview the generated plist without installing**:

```sh
node scripts/service.mjs --project ~/path/to/your-project --print
```

**Uninstall the managed service**:

```sh
node scripts/service.mjs --uninstall
```

**Stop the current run temporarily**:

```sh
launchctl bootout gui/$(id -u)/com.omo-route-panel.web
```

Re-run the install command to start it again. Do not simply `kill` the process PID while the LaunchAgent is loaded, because `KeepAlive` will immediately respawn it.

Service logs are written to `~/Library/Logs/omo-route-panel/` (`0700`), and the agent plist is stored at `~/Library/LaunchAgents/com.omo-route-panel.web.plist` (`0600`). Neither location records access tokens. `scripts/service.mjs` refuses to overwrite a plist that does not carry its management marker.

Under the hood, `scripts/start-tailnet.sh` queries the official Tailscale CLI (`tailscale status --json`) to discover the current node's `DNSName` and active `LoginName`, then launches `dist/src/cli.js --tailscale-origin <origin> --tailscale-user <login> --no-open`. It never reads Tailscale internal state files or OMO authentication files.

The generated service PATH starts with the directory of the Node executable
running `service.mjs`. The launcher uses `OMO_NODE_PATH` when explicitly set,
otherwise `node` from PATH; it does not require Homebrew. To migrate Node,
run the service installer with the intended Node executable. The CLI's
`--node-path` and `--omo-path` overrides remain available for direct startup.

## Configuring Tailscale Serve (One-Time Setup)

Configure Tailscale Serve to proxy port `9443` to local port `4177`:

```sh
"/Applications/Tailscale.app/Contents/MacOS/Tailscale" serve \
  --bg --https=9443 http://127.0.0.1:4177
```

If you customize `--port`, keep the Tailscale Serve target port and `scripts/start-tailnet.sh` origin port aligned. To remove only this Serve rule without disturbing other services on the host:

```sh
"/Applications/Tailscale.app/Contents/MacOS/Tailscale" serve --https=9443 off
```

Do not run `tailscale serve reset` if the host runs other Tailscale Serve mappings.

## Migrating an Existing Personal Service Installation

If you previously installed `com.omo-route-panel.web` from an earlier revision or changed your Node, OMO, or project paths:

1. Rebuild the project from a clean output directory: `bun run build`.
2. Re-run `node scripts/service.mjs --project ~/path/to/your-project [--edit]` to update and reload the LaunchAgent plist.
3. On HTTP `401` (such as after a server restart rotates the in-memory token), the browser automatically re-bootstraps its session token once via `/api/session` using the active Tailscale identity while preserving unsaved drafts (marking old previews stale). HTTP `403` responses are not retried.
4. Refresh any browser tab that was left open from an older build once so it loads the current client script.

## Split-DNS Helper for Client Macs with Fake-IP Proxies

On client Macs running proxy/TUN software (such as mihomo or corporate VPN clients that return `198.18.*` fake-IP addresses), system DNS resolution for `<tailnet>.ts.net` may bypass Tailscale's `100.100.100.100` resolver and cause TLS hostname verification to fail, while enabling global Tailscale `accept-dns` can conflict with the proxy's DNS routing.

`scripts/enable-tailnet-dns.sh` installs a scoped macOS resolver file at `/etc/resolver/<tailnet>.ts.net` pointing only that tailnet domain to `100.100.100.100`, backing up any prior file in `/var/db/omo-route-panel-tailnet-dns/`.

**Run the built-in self-test (no root required, uses a temporary sandbox)**:

```sh
bash scripts/enable-tailnet-dns.sh --selftest
```

**Install the scoped resolver on a client Mac (requires `sudo` in an interactive terminal)**:

```sh
sudo /bin/bash scripts/enable-tailnet-dns.sh <tailnet>.ts.net
```

**Roll back to the previous resolver state**:

```sh
sudo /bin/bash scripts/enable-tailnet-dns.sh --rollback <tailnet>.ts.net
```

The script refuses to modify symlinks or overwrite files modified by another tool after installation.

## Remote Verification Helper

`scripts/check-tailnet.rb` verifies a Tailscale HTTPS endpoint using macOS system `curl` and `ruby` without requiring the client machine to clone the repository:

```sh
/usr/bin/ruby scripts/check-tailnet.rb https://<host>.<tailnet>.ts.net:9443
```

The check sends a forged `Tailscale-User-Login` header first to confirm that Tailscale Serve overwrites spoofed identity headers, bootstraps a session via `/api/session`, and fetches `/api/snapshot`. It passes the ephemeral token to `curl` via `stdin` (`--config -`) so the token never enters process arguments, files, or terminal output.

---

## Historical Verification Record (2026-10-25)

*Historical note: The points below record the 2026-10-25 verification run on the initial macOS deployment and are retained as historical evidence rather than current release-candidate proof.*

- Type checking, linting, build, and all 66 tests at that revision passed, including 11 remote authentication and origin-protection regression tests.
- Host Mac and client MacBook verified session bootstrap and snapshot retrieval over `https://<host>.<tailnet>.ts.net:9443` (546 models, 10 categories, 7 agents).
- A clean browser profile connected without a URL fragment; `localStorage` and `sessionStorage` remained empty and all page assets loaded from the same HTTPS origin.
- On a client Mac with fake-IP proxy routing (`198.18.*` vs. Tailscale DNS `100.100.100.100`), installing `/etc/resolver/<tailnet>.ts.net` restored system `getaddrinfo` resolution, spoofed-header replacement, session bootstrap, and authenticated snapshot reads while leaving non-tailnet domains on the existing proxy resolver.
- Both local and remote sandbox self-tests for `scripts/enable-tailnet-dns.sh` passed, covering rollback when the target file was previously absent or present.
- Zero credentials were echoed, zero model inference calls were made, and unrelated services on port 443 and SSH were left untouched.
