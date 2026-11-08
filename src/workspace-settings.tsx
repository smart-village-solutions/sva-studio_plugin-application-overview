/** Instanzweite Kachelverwaltung mit Sprachpflege und konfliktgeprüftem Speichern. */
import { readPluginLocales, usePluginTranslation } from "@sva/plugin-sdk";
import { Button, StudioPageTitle } from "@sva/studio-ui-react";
import { useWorkspace } from "./use-workspace.js";
import {
  useWorkspaceEditor,
  type WorkspaceEditor,
} from "./use-workspace-editor.js";
import { WorkspaceTileEditor } from "./workspace-tile-editor.js";
import {
  WorkspaceSaveControls,
  WorkspaceDeleteDialog,
} from "./workspace-settings-controls.js";
type WorkspaceApi = ReturnType<typeof useWorkspace>;
const WorkspaceLanguage = ({
  editor: e,
}: {
  readonly editor: WorkspaceEditor;
}) => {
  const pt = usePluginTranslation("application-workspace");
  const { locale, supportedLocales } = readPluginLocales();
  return (
    <div className="grid gap-2">
      <label htmlFor="workspace-locale">{pt("language")}</label>
      <select
        id="workspace-locale"
        value={e.locale}
        onChange={(event) => e.setLocale(event.target.value)}
        className="min-h-11 rounded-md border border-input bg-surface-inset px-3"
      >
        {supportedLocales.map((code) => (
          <option key={code} value={code}>
            {new Intl.DisplayNames([locale], { type: "language" }).of(code) ??
              code}
          </option>
        ))}
      </select>
      <p className="text-sm text-muted-foreground">{pt("fallback")}</p>
    </div>
  );
};
const WorkspaceForm = ({ editor: e }: { readonly editor: WorkspaceEditor }) => {
  const pt = usePluginTranslation("application-workspace");
  if (!e.draft) return null;
  return (
    <>
      <article className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">{pt("studioName")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{pt("fixed")}</p>
      </article>
      <WorkspaceLanguage editor={e} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void e.save();
        }}
        className="space-y-5"
        noValidate
      >
        {!e.draft.tiles.length ? <p>{pt("empty")}</p> : null}
        {e.draft.tiles.map((tile, index) => (
          <WorkspaceTileEditor
            key={tile.id}
            {...e}
            tile={tile}
            index={index}
            count={e.draft!.tiles.length}
          />
        ))}
        <WorkspaceSaveControls editor={e} />
      </form>
    </>
  );
};
const SettingsEditor = ({ api }: { readonly api: WorkspaceApi }) => {
  const pt = usePluginTranslation("application-workspace");
  const editor = useWorkspaceEditor(api);
  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6"
      aria-busy={editor.busy || api.loading}
    >
      <header className="space-y-2">
        <StudioPageTitle>{pt("settings")}</StudioPageTitle>
        <p className="text-muted-foreground">{pt("settingsDescription")}</p>
      </header>
      {api.loading ? <p role="status">{pt("loading")}</p> : null}
      {api.error ? (
        <div role="alert">
          <p>{pt("error")}</p>
          <Button variant="secondary" onClick={api.reload}>
            {pt("retry")}
          </Button>
        </div>
      ) : null}
      <WorkspaceForm editor={editor} />
      <WorkspaceDeleteDialog editor={editor} />
    </section>
  );
};
export const WorkspaceSettingsPage = () => {
  const api = useWorkspace(true);
  return <SettingsEditor key={api.key} api={api} />;
};
