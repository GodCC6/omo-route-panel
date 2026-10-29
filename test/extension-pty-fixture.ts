/** Bun's builtin PTY supplies the real interactive host; Node owns the assertions. */
interface Terminal {
  write(data: Uint8Array): number;
  close(): void;
}
declare const Bun: {
  spawn(args: readonly string[], options: {
    readonly env: NodeJS.ProcessEnv;
    readonly terminal: { readonly cols: number; readonly rows: number; readonly data: (terminal: Terminal, data: Uint8Array) => void };
  }): { readonly pid: number; readonly terminal?: Terminal; readonly exited: Promise<number>; kill(signal: string): void };
};
const child = Bun.spawn(process.argv.slice(2), {
  env: process.env,
  terminal: { cols: Number(process.env["TUI_COLS"] ?? 120), rows: Number(process.env["TUI_ROWS"] ?? 40), data: (_terminal, data) => { process.stdout.write(data); } },
});
const terminal = child.terminal;
if (!terminal) throw new Error("Bun PTY unavailable.");
process.send?.({ type: "host-pid", pid: child.pid });
process.stdin.on("data", (data: Buffer) => terminal.write(data));
process.once("SIGTERM", () => child.kill("SIGTERM"));
const code = await child.exited;
terminal.close();
process.exit(code);
