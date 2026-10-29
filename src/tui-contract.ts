import type { FileChange, FileGroup, Json, Operation } from "./types.js";
import type { PresentedRoute } from "./presentation.js";
import type { NativeCatalog, NativeInspection, NativeResolution } from "./native/index.js";
import type { BackgroundRoute } from "./types.js";

export type Scope = "user" | "project";
export type PanelView = {
  readonly scope: Scope;
  readonly registryContext: string;
  readonly inspection: NativeInspection;
  readonly resolution: NativeResolution;
  readonly catalog: Extract<NativeCatalog, { readonly status: "ok" }>;
  readonly routes: readonly PresentedRoute[];
  readonly background: readonly BackgroundRoute[];
  readonly fields: Readonly<Record<string, Json>>;
  readonly files: Readonly<Record<FileGroup, string>>;
  readonly canUndo: boolean;
  readonly undoUnavailableReason?: string;
};
export type EditorView = {
  readonly group: "native";
  readonly path: string;
  readonly operations: readonly Operation[];
  readonly changes: readonly FileChange[];
  readonly routes: readonly PresentedRoute[];
  readonly background: readonly BackgroundRoute[];
  readonly fields: Readonly<Record<string, Json>>;
  readonly modelProfile: Json;
  readonly undo: boolean;
};
export type SaveOutcome = {
  readonly status: "saved" | "saved-reload-failed";
  readonly message: string;
};
export interface PanelController {
  readonly view: PanelView | null;
  readonly editor: EditorView | null;
  read(scope: Scope): Promise<void>;
  begin(group?: "native"): void;
  change(operations: readonly Operation[]): Promise<void>;
  undo(): Promise<void>;
  apply(): Promise<SaveOutcome>;
  cancel(): void;
  close(): void;
}
