/** State transitions for the settings form; writes are never retried implicitly. */
import {
  useEffect,
  useState,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  readWorkspaceConfiguration,
  WorkspaceValidationError,
  type ApplicationTile,
  type TileText,
  type WorkspaceConfiguration,
} from "./contract.js";
import type { useWorkspace } from "./use-workspace.js";
type WorkspaceApi = ReturnType<typeof useWorkspace>;
const emptyText: TileText = { name: "", description: "", cta: "" };
type EditorState = {
  draft: WorkspaceConfiguration | null;
  locale: string;
  busy: boolean;
  message: string;
  invalid: string;
  pendingDelete: string | null;
  blocked: boolean;
  latest: WorkspaceConfiguration | null;
};
type UpdateState = (patch: Partial<EditorState>) => void;
type SetEditorState = Dispatch<SetStateAction<EditorState>>;
const initialState: EditorState = {
  draft: null,
  locale: "de",
  busy: false,
  message: "",
  invalid: "",
  pendingDelete: null,
  blocked: false,
  latest: null,
};
const moveTile = (
  current: WorkspaceConfiguration | null,
  index: number,
  direction: number,
) => {
  if (!current) return current;
  const tiles = [...current.tiles];
  const target = index + direction;
  if (target < 0 || target >= tiles.length) return current;
  const item = tiles[index],
    other = tiles[target];
  if (!item || !other) return current;
  [tiles[index], tiles[target]] = [other, item];
  return { ...current, tiles };
};
const saveDraft = async (draft: WorkspaceConfiguration, api: WorkspaceApi) => {
  let validated: WorkspaceConfiguration;
  try {
    validated = readWorkspaceConfiguration(draft);
  } catch (error) {
    return {
      message: "invalid",
      invalid: error instanceof WorkspaceValidationError ? error.field : "",
      blocked: false,
    };
  }
  try {
    return {
      message: "saved",
      draft: await api.save(validated),
      invalid: "",
      blocked: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    return {
      message:
        reason === "conflict"
          ? "conflict"
          : reason === "invalid"
            ? "invalid"
            : "saveError",
      invalid: "",
      blocked: reason !== "invalid",
    };
  }
};
const saveEditor = async (
  api: WorkspaceApi,
  state: EditorState,
  editable: boolean,
  update: UpdateState,
) => {
  if (!state.draft || !editable) return;
  update({ busy: true, message: "", invalid: "" });
  try {
    update(await saveDraft(state.draft, api));
  } finally {
    update({ busy: false });
  }
};
const checkEditor = async (state: EditorState, update: UpdateState) => {
  update({ busy: true });
  try {
    const response = await fetch(
      "/api/v1/plugins/application-workspace/settings",
      { credentials: "include" },
    );
    if (!response.ok) throw Error("unavailable");
    const payload = (await response.json()) as { data?: unknown };
    const stored = readWorkspaceConfiguration(payload.data);
    update({ latest: stored });
    if (
      state.draft &&
      JSON.stringify(stored.tiles) === JSON.stringify(state.draft.tiles)
    )
      update({ draft: stored, blocked: false, message: "saved" });
    else if (stored.version === state.draft?.version)
      update({ blocked: false, message: "" });
    else update({ message: "conflict" });
  } catch {
    update({ message: "saveError" });
  } finally {
    update({ busy: false });
  }
};
const createDraftActions = (
  state: EditorState,
  setState: SetEditorState,
  editable: boolean,
) => {
  const setDraft = (
    change: (
      draft: WorkspaceConfiguration | null,
    ) => WorkspaceConfiguration | null,
  ) => setState((current) => ({ ...current, draft: change(current.draft) }));
  const update = (id: string, change: Partial<ApplicationTile>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            tiles: current.tiles.map((tile) =>
              tile.id === id ? { ...tile, ...change } : tile,
            ),
          }
        : current,
    );
  return {
    update,
    changeText: (tile: ApplicationTile, field: keyof TileText, value: string) =>
      update(tile.id, {
        texts: {
          ...tile.texts,
          [state.locale]: {
            ...(tile.texts[state.locale] ?? emptyText),
            [field]: value,
          },
        },
      }),
    move: (index: number, direction: number) =>
      setDraft((current) => moveTile(current, index, direction)),
    add: () =>
      setDraft((draft) =>
        draft
          ? {
              ...draft,
              tiles: [
                ...draft.tiles,
                {
                  id: crypto.randomUUID(),
                  icon: "app-window",
                  url: "",
                  texts: { de: { ...emptyText } },
                },
              ],
            }
          : draft,
      ),
    remove: () => {
      if (editable)
        setDraft((current) =>
          current
            ? {
                ...current,
                tiles: current.tiles.filter(
                  (tile) => tile.id !== state.pendingDelete,
                ),
              }
            : current,
        );
      setState((current) => ({ ...current, pendingDelete: null }));
    },
  };
};
export const useWorkspaceEditor = (api: WorkspaceApi) => {
  const [state, setState] = useState(initialState);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const updateState: UpdateState = (patch) =>
    setState((current) => ({ ...current, ...patch }));
  useEffect(() => {
    if (api.configuration)
      setState((current) => ({ ...current, draft: api.configuration }));
  }, [api.configuration]);
  const canWrite =
    api.session.unscopedPermissionActions.includes(
      "application-workspace.settings.read",
    ) &&
    api.session.unscopedPermissionActions.includes(
      "application-workspace.settings.update",
    );
  const editable = canWrite && !state.busy && !state.blocked;
  return {
    ...state,
    canWrite,
    editable,
    ...createDraftActions(state, setState, editable),
    setLocale: (locale: string) => updateState({ locale }),
    setPendingDelete: (
      pendingDelete: string | null,
      trigger?: HTMLButtonElement,
    ) => {
      if (trigger) deleteTrigger.current = trigger;
      updateState({ pendingDelete });
    },
    restoreDeleteFocus: () => {
      const target = deleteTrigger.current?.isConnected
        ? deleteTrigger.current
        : document.getElementById("workspace-add");
      target?.focus();
    },
    save: () => saveEditor(api, state, editable, updateState),
    check: () => checkEditor(state, updateState),
    reloadLatest: () =>
      updateState({
        ...(state.latest ? { draft: state.latest } : {}),
        blocked: false,
        message: "",
        invalid: "",
      }),
  };
};
export type WorkspaceEditor = ReturnType<typeof useWorkspaceEditor>;
