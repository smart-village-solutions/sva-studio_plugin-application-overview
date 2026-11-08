import { usePluginTranslation } from "@sva/plugin-sdk";
import {
  Button,
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@sva/studio-ui-react";
import type { WorkspaceEditor } from "./use-workspace-editor.js";
export const WorkspaceSaveControls = ({
  editor: e,
}: {
  readonly editor: WorkspaceEditor;
}) => {
  const pt = usePluginTranslation("application-workspace");
  return (
    <>
      {e.message ? (
        <p
          role={e.message === "saved" ? "status" : "alert"}
          className={
            e.message === "saved" ? "text-foreground" : "text-destructive"
          }
        >
          {pt(e.message)}
        </p>
      ) : null}
      {e.blocked ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void e.check()}
            disabled={e.busy}
          >
            {pt("check")}
          </Button>
          {e.latest ? (
            <Button type="button" variant="secondary" onClick={e.reloadLatest}>
              {pt("reload")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {e.canWrite ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!e.editable || (e.draft?.tiles.length ?? 0) >= 100}
            id="workspace-add"
            onClick={e.add}
          >
            {pt("add")}
          </Button>
          <Button type="submit" disabled={!e.editable}>
            {pt("save")}
          </Button>
        </div>
      ) : null}
    </>
  );
};
export const WorkspaceDeleteDialog = ({
  editor: e,
}: {
  readonly editor: WorkspaceEditor;
}) => {
  const pt = usePluginTranslation("application-workspace");
  return (
    <AlertDialog
      open={Boolean(e.pendingDelete)}
      onOpenChange={(open) => {
        if (!open) e.setPendingDelete(null);
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          e.restoreDeleteFocus();
        }}
      >
        <AlertDialogTitle>{pt("deleteTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {pt("deleteDescription")}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{pt("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={e.remove}>
            {pt("remove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
