/** Real plugin flows with a mocked HTTP boundary and resolved host session. */
import React from 'react';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import {
  publishSessionAccessSnapshot,
  resetSessionAccessSnapshot,
  registerPluginTranslationResolver,
  createPluginRegistry,
} from '@sva/plugin-sdk';
import { pluginApplicationWorkspace } from './index.js';
import { WorkspacePage } from './workspace-page.js';
import { WorkspaceSettingsPage } from './workspace-settings.js';
import { workspaceTranslations } from './plugin.translations.js';
vi.mock('@sva/studio-ui-react', async (original) => ({
  ...(await original<typeof import('@sva/studio-ui-react')>()),
  TablerIcon: () => null,
}));
const tile = {
  id: 'one',
  icon: 'calendar',
  url: 'https://example.org',
  texts: { de: { name: 'Kalender', description: 'Termine der Kommune', cta: 'Öffnen' } },
};
const session = (write = true) =>
  publishSessionAccessSnapshot({
    isResolved: true,
    subjectId: 'user',
    instanceId: 'municipality',
    roles: [],
    assignedModules: ['application-workspace'],
    permissionActions: write
      ? ['application-workspace.settings.read', 'application-workspace.settings.update']
      : ['application-workspace.settings.read'],
    unscopedPermissionActions: write
      ? ['application-workspace.settings.read', 'application-workspace.settings.update']
      : ['application-workspace.settings.read'],
  });
beforeEach(() => {
  registerPluginTranslationResolver(
    (key) =>
      workspaceTranslations.de['application-workspace'][
        key.replace(
          'application-workspace.',
          ''
        ) as keyof (typeof workspaceTranslations.de)['application-workspace']
      ] ?? key
  );
  session();
});
afterEach(() => {
  cleanup();
  resetSessionAccessSnapshot();
  vi.unstubAllGlobals();
});
describe('application workspace UI', () => {
  it('places Studio first and opens external applications safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ data: { version: 1, tiles: [tile] } }))
    );
    render(<WorkspacePage />);
    await screen.findByText('Kalender');
    const links = screen.getAllByRole('link');
    expect(links[0]?.getAttribute('href')).toBe('/');
    expect(links[1]?.getAttribute('target')).toBe('_blank');
    expect(links[1]?.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('saves translated input through the guarded mutation endpoint', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) =>
      Response.json({
        data:
          init?.method === 'PUT'
            ? { ...JSON.parse(String(init.body)), version: 2 }
            : { version: 1, tiles: [tile] },
      })
    );
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neuer Kalender' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await screen.findByText('Änderungen gespeichert.');
    const saved = fetcher.mock.calls.find((call) => call[1]?.method === 'PUT');
    expect(saved?.[1]?.headers).toMatchObject({ 'X-Requested-With': 'XMLHttpRequest' });
    expect(JSON.parse(String(saved?.[1]?.body)).tiles[0].texts.de.name).toBe('Neuer Kalender');
  });
  it('keeps input and blocks another write after a revision conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) =>
        init?.method === 'PUT'
          ? Response.json({ error: 'workspace_version_conflict' }, { status: 409 })
          : Response.json({ data: { version: 1, tiles: [tile] } })
      )
    );
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Entwurf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('inzwischen geändert')
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Entwurf');
    expect(
      (screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
  it('does not expose mutation controls with read permission alone', async () => {
    session(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ data: { version: 1, tiles: [tile] } }))
    );
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    expect(screen.queryByRole('button', { name: 'Änderungen speichern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Anwendung hinzufügen' })).toBeNull();
  });
  it('discards late responses after module deactivation and reads again on reactivation', async () => {
    let finish: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspacePage />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() =>
      publishSessionAccessSnapshot({
        isResolved: true,
        subjectId: 'user',
        instanceId: 'municipality',
        roles: [],
        assignedModules: [],
        permissionActions: [],
        unscopedPermissionActions: [],
      })
    );
    await act(async () => {
      finish?.(Response.json({ data: { version: 1, tiles: [tile] } }));
    });
    expect(screen.queryByText('Kalender')).toBeNull();
    fetcher.mockImplementation(async () => Response.json({ data: { version: 1, tiles: [tile] } }));
    act(() => session());
    expect(await screen.findByText('Kalender')).toBeTruthy();
  });
  it('resolves an unknown save outcome by readback without repeating the mutation', async () => {
    let stored = { version: 1, tiles: [tile] };
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        stored = { ...JSON.parse(String(init.body)), version: 2 };
        throw Error('connection_lost_after_commit');
      }
      return Response.json({ data: stored });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gespeicherter Entwurf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' }));
    await screen.findByText('Änderungen gespeichert.');
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(1);
  });
  it('supports language editing, accessible reordering and confirmed deletion', async () => {
    const second = {
      ...tile,
      id: 'two',
      texts: { de: { ...tile.texts.de, name: 'Zweite Anwendung' } },
    };
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) =>
      Response.json({
        data:
          init?.method === 'PUT'
            ? { ...JSON.parse(String(init.body)), version: 2 }
            : { version: 1, tiles: [tile, second] },
      })
    );
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    fireEvent.change(screen.getByLabelText('Sprache'), { target: { value: 'en' } });
    fireEvent.change(screen.getAllByLabelText('Name')[0] as HTMLElement, {
      target: { value: 'Calendar' },
    });
    fireEvent.change(screen.getByLabelText('Sprache'), { target: { value: 'de' } });
    expect(screen.getByDisplayValue('Kalender')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Nach unten verschieben' })[0] as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await screen.findByText('Änderungen gespeichert.');
    const saved = fetcher.mock.calls.find((call) => call[1]?.method === 'PUT');
    const config = JSON.parse(String(saved?.[1]?.body));
    expect(config.tiles.map((entry: { id: string }) => entry.id)).toEqual(['two', 'one']);
    expect(config.tiles[1].texts.en.name).toBe('Calendar');
    const deleteTrigger = screen.getAllByRole('button', { name: 'Anwendung entfernen' })[0] as HTMLElement;
    deleteTrigger.focus();
    fireEvent.click(deleteTrigger);
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByDisplayValue('Zweite Anwendung')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(deleteTrigger));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Anwendung entfernen' })[0] as HTMLElement
    );
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Anwendung entfernen' })
    );
    expect(screen.queryByDisplayValue('Zweite Anwendung')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anwendung hinzufügen' }));
    expect(screen.getAllByLabelText('Name')).toHaveLength(2);
  });

  it('registers the complete browser descriptor through the host validator', () => {
    expect(() => createPluginRegistry([pluginApplicationWorkspace])).not.toThrow();
  });
  it('retains Studio during a load failure and retries the application catalog', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(Error('offline'))
      .mockResolvedValueOnce(Response.json({ data: { version: 1, tiles: [tile] } }));
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspacePage />);
    await screen.findByRole('alert');
    expect(screen.getAllByRole('link')[0]?.getAttribute('href')).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
    expect(await screen.findByText('Kalender')).toBeTruthy();
  });
  it('validates a new tile locally before any mutation', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: { version: 0, tiles: [] } }));
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspaceSettingsPage />);
    await screen.findByRole('button', { name: 'Anwendung hinzufügen' });
    fireEvent.click(screen.getByRole('button', { name: 'Anwendung hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Zieladresse (HTTPS)').getAttribute('aria-invalid')).toBe('true');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps a server-rejected draft editable and permits an explicit corrected save', async () => {
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        attempts += 1;
        return attempts === 1 ? Response.json({ error: 'invalid_configuration' }, { status: 400 }) : Response.json({ data: { ...JSON.parse(String(init.body)), version: 2 } });
      }
      return Response.json({ data: { version: 1, tiles: [tile] } });
    }));
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    const save = screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement;
    fireEvent.click(save);
    await screen.findByRole('alert');
    expect(save.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Korrigiert' } });
    fireEvent.click(save);
    await screen.findByText('Änderungen gespeichert.');
    expect(attempts).toBe(2);
  });
  it('does not repeat a write when readback fails, then unlocks an unchanged stored revision', async () => {
    let reads = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'PUT') throw Error('offline');
      reads += 1;
      return reads === 2 ? Response.json({}, { status: 503 }) : Response.json({ data: { version: 1, tiles: [tile] } });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<WorkspaceSettingsPage />);
    await screen.findByDisplayValue('Kalender');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ungespeichert' } });
    const save = screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement;
    fireEvent.click(save);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' }) as HTMLButtonElement).disabled).toBe(false));
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' }));
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(screen.getByDisplayValue('Ungespeichert')).toBeTruthy();
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(1);
  });
  it('keeps every localized UI key in both shipped languages', async () => {
    const de = workspaceTranslations.de['application-workspace'];
    const en = workspaceTranslations.en['application-workspace'];
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    for (const file of ['workspace-page.tsx', 'workspace-settings.tsx']) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8');
      for (const [, key] of source.matchAll(/\bpt\(\s*['"]([^'"]+)['"]/g)) {
        expect(de, key).toHaveProperty(key ?? '');
        expect(en, key).toHaveProperty(key ?? '');
      }
    }
  });
});
