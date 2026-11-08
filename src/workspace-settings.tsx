/** Instanzweite Kachelverwaltung mit Sprachpflege und konfliktgeprüftem Speichern. */
import { useEffect, useState } from 'react';
import { readPluginLocales, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  IconPicker,
  StudioPageTitle,
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@sva/studio-ui-react';
import {
  readWorkspaceConfiguration,
  WorkspaceValidationError,
  type ApplicationTile,
  type TileText,
  type WorkspaceConfiguration,
} from './contract.js';
import { useWorkspace } from './use-workspace.js';
const emptyText: TileText = { name: '', description: '', cta: '' };
type WorkspaceApi = ReturnType<typeof useWorkspace>;
const SettingsEditor = ({ api }: { readonly api: WorkspaceApi }) => {
  const pt = usePluginTranslation('application-workspace');
  const { supportedLocales } = readPluginLocales();
  const [draft, setDraft] = useState<WorkspaceConfiguration | null>(null);
  const [locale, setLocale] = useState('de');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [latest, setLatest] = useState<WorkspaceConfiguration | null>(null);
  useEffect(() => {
    if (api.configuration) setDraft(api.configuration);
  }, [api.configuration]);
  const canWrite =
    api.session.unscopedPermissionActions.includes('application-workspace.settings.read') &&
    api.session.unscopedPermissionActions.includes('application-workspace.settings.update');
  const editable = canWrite && !busy && !blocked;
  const update = (id: string, change: Partial<ApplicationTile>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            tiles: current.tiles.map((tile) => (tile.id === id ? { ...tile, ...change } : tile)),
          }
        : current
    );
  const changeText = (tile: ApplicationTile, field: keyof TileText, value: string) =>
    update(tile.id, {
      texts: { ...tile.texts, [locale]: { ...(tile.texts[locale] ?? emptyText), [field]: value } },
    });
  const move = (index: number, direction: number) =>
    setDraft((current) => {
      if (!current) return current;
      const tiles = [...current.tiles];
      const target = index + direction;
      if (target < 0 || target >= tiles.length) return current;
      const item = tiles[index];
      const other = tiles[target];
      if (!item || !other) return current;
      [tiles[index], tiles[target]] = [other, item];
      return { ...current, tiles };
    });
  const save = async () => {
    if (!draft || !editable) return;
    setMessage('');
    setInvalid('');
    let validated: WorkspaceConfiguration;
    try {
      validated = readWorkspaceConfiguration(draft);
    } catch (error) {
      setMessage('invalid');
      if (error instanceof WorkspaceValidationError) setInvalid(error.field);
      return;
    }
    setBusy(true);
    try {
      const saved = await api.save(validated);
      setDraft(saved);
      setMessage('saved');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      setMessage(
        reason === 'conflict' ? 'conflict' : reason === 'invalid' ? 'invalid' : 'saveError'
      );
      setBlocked(reason !== 'invalid');
    } finally {
      setBusy(false);
    }
  };
  const check = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/v1/plugins/application-workspace/settings', {
        credentials: 'include',
      });
      if (!response.ok) throw Error('unavailable');
      const payload = (await response.json()) as { data?: unknown };
      const stored = readWorkspaceConfiguration(payload.data);
      setLatest(stored);
      if (draft && JSON.stringify(stored.tiles) === JSON.stringify(draft.tiles)) {
        setDraft(stored);
        setBlocked(false);
        setMessage('saved');
      } else if (stored.version === draft?.version) {
        setBlocked(false);
        setMessage('');
      } else setMessage('conflict');
    } catch {
      setMessage('saveError');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6" aria-busy={busy || api.loading}>
      <header className="space-y-2">
        <StudioPageTitle>{pt('settings')}</StudioPageTitle>
        <p className="text-muted-foreground">{pt('settingsDescription')}</p>
      </header>
      {api.loading ? <p role="status">{pt('loading')}</p> : null}
      {api.error ? (
        <div role="alert">
          <p>{pt('error')}</p>
          <Button variant="secondary" onClick={api.reload}>
            {pt('retry')}
          </Button>
        </div>
      ) : null}
      {draft ? (
        <>
          <article className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">{pt('studioName')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pt('fixed')}</p>
          </article>
          <div className="grid gap-2">
            <label htmlFor="workspace-locale">{pt('language')}</label>
            <select
              id="workspace-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-surface-inset px-3"
            >
              {supportedLocales.map((code) => (
                <option key={code} value={code}>
                  {new Intl.DisplayNames([readPluginLocales().locale], { type: 'language' }).of(
                    code
                  ) ?? code}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{pt('fallback')}</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="space-y-5"
            noValidate
          >
            {!draft.tiles.length ? <p>{pt('empty')}</p> : null}
            {draft.tiles.map((tile, index) => {
              const text = tile.texts[locale] ?? emptyText;
              return (
                <fieldset
                  key={tile.id}
                  disabled={!editable}
                  className="space-y-4 rounded-lg border border-border bg-card p-5"
                >
                  <legend className="px-1 font-semibold">{tile.texts.de?.name || pt('add')}</legend>
                  <IconPicker
                    id={`${tile.id}-icon`}
                    label={pt('icon')}
                    hint={pt('iconHint')}
                    placeholder={pt('iconPlaceholder')}
                    searchLabel={pt('iconSearch')}
                    emptyText={pt('iconEmpty')}
                    moreLabel={pt('iconMore')}
                    value={tile.icon}
                    onValueChange={(icon) => update(tile.id, { icon })}
                    disabled={!editable}
                    readOnly={!canWrite}
                    error={invalid === 'icon' ? pt('invalid') : undefined}
                  />
                  <div className="grid gap-1">
                    <label htmlFor={`${tile.id}-url`}>{pt('url')}</label>
                    <Input
                      id={`${tile.id}-url`}
                      type="url"
                      value={tile.url}
                      onChange={(e) => update(tile.id, { url: e.target.value })}
                      maxLength={2048}
                      aria-invalid={invalid === 'url' || undefined}
                      readOnly={!canWrite}
                      required
                    />
                  </div>
                  {(['name', 'description', 'cta'] as const).map((field) => (
                    <div key={field} className="grid gap-1">
                      <label htmlFor={`${tile.id}-${locale}-${field}`}>
                        {pt(field === 'description' ? 'descriptionLabel' : field)}
                      </label>
                      <Input
                        id={`${tile.id}-${locale}-${field}`}
                        value={text[field]}
                        maxLength={field === 'description' ? 1000 : field === 'name' ? 120 : 80}
                        required={locale === 'de'}
                        readOnly={!canWrite}
                        aria-invalid={invalid === `${tile.id}.${locale}.${field}` || undefined}
                        onChange={(e) => changeText(tile, field, e.target.value)}
                      />
                    </div>
                  ))}
                  {locale !== 'de' && Object.values(text).some((value) => !value.trim()) ? (
                    <p className="text-sm text-muted-foreground">{pt('missingTranslation')}</p>
                  ) : null}
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!editable || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        {pt('up')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!editable || index === draft.tiles.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        {pt('down')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!editable}
                        onClick={() => setPendingDelete(tile.id)}
                      >
                        {pt('remove')}
                      </Button>
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
            {message ? (
              <p
                role={message === 'saved' ? 'status' : 'alert'}
                className={message === 'saved' ? 'text-foreground' : 'text-destructive'}
              >
                {pt(message)}
              </p>
            ) : null}
            {blocked ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void check()}
                  disabled={busy}
                >
                  {pt('check')}
                </Button>
                {latest ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDraft(latest);
                      setBlocked(false);
                      setMessage('');
                      setInvalid('');
                    }}
                  >
                    {pt('reload')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {canWrite ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!editable || draft.tiles.length >= 100}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      tiles: [
                        ...draft.tiles,
                        {
                          id: crypto.randomUUID(),
                          icon: 'app-window',
                          url: '',
                          texts: { de: { ...emptyText } },
                        },
                      ],
                    })
                  }
                >
                  {pt('add')}
                </Button>
                <Button type="submit" disabled={!editable}>
                  {pt('save')}
                </Button>
              </div>
            ) : null}
          </form>
        </>
      ) : null}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{pt('deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{pt('deleteDescription')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{pt('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (editable)
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          tiles: current.tiles.filter((tile) => tile.id !== pendingDelete),
                        }
                      : current
                  );
                setPendingDelete(null);
              }}
            >
              {pt('remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
export const WorkspaceSettingsPage = () => {
  const api = useWorkspace(true);
  return <SettingsEditor key={api.key} api={api} />;
};
