# 0.1.1 release evidence

Verified: 2026-11-08. **`omo-route-panel@0.1.1` is published and installable.**
The registry records publication by `cc922` at `2026-11-08T02:59:44.480Z`;
`latest` points to `0.1.1`. Registry integrity matches the tested tarball below.
The same artifact was published after the account hold expired, using npm's
ordinary account staging and owner approval from the maintainer's own device.

`omo install npm:omo-route-panel@0.1.1` completed with exit 0 in a fresh,
account-free HOME; `omo list --no-approve` recognized the installed package.
The production factory from that registry installation passed the complete
standalone OMO `5.1.51` edit/cancel/save/conflict/reload/undo acceptance with zero
failures and no inference. Evidence is retained under ignored
`artifacts/0.1.1/registry-host/`.

This record covers the PR #6 release candidate for
[issue #5](https://github.com/GodCC6/omo-route-panel/issues/5).
Independent gate review approved the candidate with zero blockers. The two base
CI jobs and the native CI job passed. PR #6 merged as
`d7abe207b809a7ac2709b939fb0714f31a17bd3d` at `2026-11-05T02:24:18Z`;
issue #5 closed at `2026-11-05T02:24:19Z`.

## Initial account hold

The authenticated maintainer's initial staging request at
`2026-11-05T02:25:04Z` returned npm `E403`: "Your account has been temporarily
suspended due to a recent security-sensitive action." No 0.1.1 staging or
publication succeeded in that attempt; the public `latest` tag still pointed to `0.1.0`
(verified: 2026-11-05). The maintainer confirmed recovery-code login on
2026-11-05. The hold's exact start and expiry are unknown.

npm's [account recovery documentation](https://docs.npmjs.com/recovering-your-2fa-enabled-account/)
describes an automatic 72-hour publishing hold after recovery-code login, which
cannot be lifted early. No alternate publishing channel or repeated write was
attempted before the conservative resume time `2026-11-08T02:26:04Z`:
72 hours plus one minute after the first denial, a conservative upper bound
rather than an invented hold-start timestamp. A durable session watch resumed
the task at that time. The expired CLI login was renewed through web
authentication; staging, owner approval, integrity verification and isolated
installation then succeeded as recorded above.

## Candidate verification

Toolchain: Node `26.11.1`, Bun `1.3.14`, macOS arm64.

| Check | Result |
| --- | --- |
| Frozen dependency installation | Passed without lockfile changes |
| Documentation links, strict compilation and lint | Passed |
| Isolated base suite | 193 passed, zero failures |
| Native suite, standalone OMO `5.1.51` | 20 passed, zero failures |
| Packed npm and Bun consumers on OMO `5.1.51` | Both complete real-host edit/save/conflict/reload/undo runs passed |
| npm OMO `5.1.60`, original opening scenario | Production panel opened seven times; no host-verification notice or inference event |
| npm OMO `5.1.60`, complete retained TUI suite | Failed at the existing late asynchronous reload scenario; not claimed as complete acceptance |

The npm binding regressions exercise nested and hoisted engines, engine/module/
report rewrites before extension import, preserved mtimes, same-version package
replacement and launcher-link retargeting. The original containment check
accepted stale code or rejected hoisted installations; the final regressions pass.
Standalone mapped-executable verification remains unchanged.

An `--ignore-scripts` npm installation can prepare its engine during its first
launch. If those changes share the engine's startup second, the panel rejects
that process conservatively. Restart after installation or upgrade; the subsequent
unchanged host passes. The [native contract](native-contract.md) states the
ctime assumptions and unsupported layouts.

The tested tarball contains 29 files with integrity:

```text
sha512-7oRyBygB6yY6ctQclXjkvZCK3VvQ5dRxkzL+PGZe3hAZjeIco+b+yJaBLP0zA0mDfgrEZjeWSSlolPTY/tnmZw==
```

The tested tarball and synthetic evidence are retained outside the published
package under ignored `artifacts/0.1.1/`: `omo-route-panel-0.1.1.tgz`,
`omo-pr6-fixed-qa/{npm,bun}/events.json` and
`omo-pr6-npm-diagnosis/events.json`. These local verification artifacts are not
permanent public downloads.
