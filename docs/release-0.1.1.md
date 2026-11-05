# 0.1.1 release evidence

Verified: 2026-11-05. This record covers the PR #6 release candidate for
[issue #5](https://github.com/GodCC6/omo-route-panel/issues/5).
Publication is pending owner authentication and final review.

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

Local synthetic evidence is retained outside the published package:
`/tmp/omo-pr6-fixed-qa/{npm,bun}/events.json` and
`/tmp/omo-pr6-npm-diagnosis/events.json`. These temporary paths are local
verification artifacts, not permanent public downloads.
