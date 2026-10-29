# Security Policy

Maintained contract updated: 2026-10-29. OMO Route Panel is a local extension
inside OMO's native TUI. It has no HTTP/SSE endpoint, browser token bootstrap or
remote service. Archived Web and Tailscale records are not deployment guidance.

## Reporting a vulnerability

GitHub private vulnerability reporting is enabled for
[GodCC6/omo-route-panel](https://github.com/GodCC6/omo-route-panel), verified
through the repository API on 2026-10-29. Use **Security > Report a vulnerability**
to contact the maintainer privately.

Use that private reporting action, not a public issue or pull
request. If it is unavailable, do not publish exploit details or private data;
use the repository's public issue tracker only to request a private reporting
channel, without disclosing the vulnerability. No reporting email is currently
designated.

Include the affected extension/OMO versions, platform, relevant boundary, impact
and minimal reproduction using a temporary HOME and synthetic configuration.
Never attach tokens, auth files, private hostnames, personal configuration,
session transcripts or raw environment dumps. Non-sensitive bugs belong in the
[issue tracker](https://github.com/GodCC6/omo-route-panel/issues).

## Host and data boundaries

- OMO owns the active model registry, terminal and extension lifecycle. Read the
  host's available models without inference, session creation, attachment or
  current-session model changes. No independent catalog runtime is installed.
- The extension does not read provider credentials, private keys, MCP
  configuration or session transcripts. Only sanitized model metadata crosses
  the host seam; raw transport errors and credential-shaped fields do not reach
  the UI.
- Native reports are the routing oracle. Verify installation identity, report
  structure and real/mirror equivalence. Missing reports or failed registry
  reads are failures, never fabricated routes or empty catalogs.
- Node report workers have restricted permissions and a controlled environment.
  These protect trusted local report code against accidental access; they are
  not a hostile-code sandbox. Background source evidence reads only the selected
  installation's bounded, relevant artifact. Do not modify upstream code or
  installed generated files.

## Write and recovery boundaries

Browsing does not change routing configuration. Explicit Apply authorizes
supported edits to one user-level native file, even in Current project
interpretation. Host settings remain read-only dependencies. Validate models,
allowlisted fields and native results; recheck file, registry, installation and
context dependencies before commit. Reject stale writes instead of auto-merging
or silently rebasing.

Preserve JSONC comments, unrelated nodes, safe ownership and permissions.
Single-writer locks and atomic replacement do not guarantee compare-and-swap
against unrelated editors. Prevent duplicate submission; close, reload and
shutdown retire unapplied buffers so an ended editor cannot save later.

Persist only the minimal last-Apply undo record with private permissions, not
full configuration backups or drafts. Undo requires inspection and explicit
Apply, refuses changed saved fields and preserves unrelated external edits.
Report a completed save even if subsequent host reload fails.

See the [native contract](docs/native-contract.md),
[transaction API](docs/api.md) and [registry contract](docs/metadata-contract.md)
for implementation boundaries and [CONTRIBUTING](CONTRIBUTING.md) for isolated
validation.
