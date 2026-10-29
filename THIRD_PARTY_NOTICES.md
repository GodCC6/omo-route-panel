# Third-party notices

Review date: 2026-10-29.

OMO Route Panel's original code and documentation are licensed under the
[MIT License](LICENSE). This does not relicense OMO, Senpi, Pi, or their
dependencies. This project is independently maintained and is not an official
OMO distribution.

## Runtime dependency

`jsonc-parser` 3.3.1 is maintained by Microsoft and licensed under MIT.
It is installed as a dependency, not vendored or bundled into this package.
Its own copyright and license accompany the installed dependency.

## Host-provided terminal helpers

`@earendil-works/pi-tui` is an optional peer with range `"*"`. OMO supplies
its terminal implementation when loading extensions. The development alias
`@code-yeongyu/senpi-tui` is for compilation and isolated tests only; neither
terminal package is included in this extension's npm tarball.

## Native report integration

The extension loads report modules from the user's installed OMO and verifies
that installation before allowing writes. It does not distribute an OMO
executable, runtime installation, model catalog, or provider credentials.
The small source-contract expressions in the background-evidence adapter are
compatibility checks against that installation, not a replacement routing
implementation or a grant of rights to the host.

## License choice

MIT follows the license declared by the maintained same-ecosystem
[`pi-comment-checker`](https://github.com/code-yeongyu/pi-comment-checker/blob/main/package.json)
and [`pi-ast-grep`](https://github.com/code-yeongyu/pi-ast-grep/blob/main/package.json)
extensions, checked on 2026-10-29. Their code is not incorporated here.
These examples inform this project's license choice, not the license of OMO
as a whole.
