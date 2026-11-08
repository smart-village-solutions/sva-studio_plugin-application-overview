import { usePluginTranslation } from "@sva/plugin-sdk";
import { Button, Input, IconPicker } from "@sva/studio-ui-react";
import type { ApplicationTile, TileText } from "./contract.js";
const emptyText: TileText = { name: "", description: "", cta: "" };
export type WorkspaceTileEditorProps = Readonly<{
  tile: ApplicationTile;
  index: number;
  count: number;
  locale: string;
  editable: boolean;
  canWrite: boolean;
  invalid: string;
  update: (id: string, change: Partial<ApplicationTile>) => void;
  changeText: (
    tile: ApplicationTile,
    field: keyof TileText,
    value: string,
  ) => void;
  move: (index: number, direction: number) => void;
  setPendingDelete: (id: string, trigger?: HTMLButtonElement) => void;
}>;
const TileTextFields = ({
  tile,
  locale,
  invalid,
  canWrite,
  changeText,
}: WorkspaceTileEditorProps) => {
  const pt = usePluginTranslation("application-workspace");
  const text = tile.texts[locale] ?? emptyText;
  return (
    <>
      {" "}
      {(["name", "description", "cta"] as const).map((field) => (
        <div key={field} className="grid gap-1">
          <label htmlFor={`${tile.id}-${locale}-${field}`}>
            {pt(field === "description" ? "descriptionLabel" : field)}
          </label>
          <Input
            id={`${tile.id}-${locale}-${field}`}
            value={text[field]}
            maxLength={
              field === "description" ? 1000 : field === "name" ? 120 : 80
            }
            required={locale === "de"}
            readOnly={!canWrite}
            aria-invalid={
              invalid === `${tile.id}.${locale}.${field}` || undefined
            }
            onChange={(e) => changeText(tile, field, e.target.value)}
          />
        </div>
      ))}
      {locale !== "de" && Object.values(text).some((value) => !value.trim()) ? (
        <p className="text-sm text-muted-foreground">
          {pt("missingTranslation")}
        </p>
      ) : null}
    </>
  );
};
const TileActions = ({
  index,
  count,
  editable,
  canWrite,
  move,
  setPendingDelete,
  tile,
}: WorkspaceTileEditorProps) => {
  const pt = usePluginTranslation("application-workspace");
  return (
    <>
      {" "}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!editable || index === 0}
            onClick={() => move(index, -1)}
          >
            {pt("up")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!editable || index === count - 1}
            onClick={() => move(index, 1)}
          >
            {pt("down")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!editable}
            onClick={(event) => setPendingDelete(tile.id, event.currentTarget)}
          >
            {pt("remove")}
          </Button>
        </div>
      ) : null}
    </>
  );
};
export const WorkspaceTileEditor = (props: WorkspaceTileEditorProps) => {
  const { tile, editable, canWrite, invalid, update } = props;
  const pt = usePluginTranslation("application-workspace");
  return (
    <fieldset
      disabled={!editable}
      className="space-y-4 rounded-lg border border-border bg-card p-5"
    >
      <legend className="px-1 font-semibold">
        {tile.texts.de?.name || pt("add")}
      </legend>
      <IconPicker
        id={`${tile.id}-icon`}
        label={pt("icon")}
        hint={pt("iconHint")}
        placeholder={pt("iconPlaceholder")}
        searchLabel={pt("iconSearch")}
        emptyText={pt("iconEmpty")}
        moreLabel={pt("iconMore")}
        value={tile.icon}
        onValueChange={(icon) => update(tile.id, { icon })}
        disabled={!editable}
        readOnly={!canWrite}
        error={invalid === "icon" ? pt("invalid") : undefined}
      />
      <div className="grid gap-1">
        <label htmlFor={`${tile.id}-url`}>{pt("url")}</label>
        <Input
          id={`${tile.id}-url`}
          type="url"
          value={tile.url}
          onChange={(e) => update(tile.id, { url: e.target.value })}
          maxLength={2048}
          aria-invalid={invalid === "url" || undefined}
          readOnly={!canWrite}
          required
        />
      </div>
      <TileTextFields {...props} />
      <TileActions {...props} />
    </fieldset>
  );
};
