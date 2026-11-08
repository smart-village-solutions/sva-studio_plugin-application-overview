/** Server handlers reject malformed and unsafe data before persistence. */
import { describe, it, expect, vi } from 'vitest';
import { createPluginServerHandlers, type WorkspaceRequestContext } from './server.js';
const context = (body: unknown): WorkspaceRequestContext => ({
  request: new Request('https://studio.example/api/v1/plugins/application-workspace/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  scope: 'tenant',
  actor: { id: 'user', instanceId: 'one', roles: [] },
  sessionId: 'test',
  pluginId: 'application-workspace',
  handlerId: 'application-workspace.settings.save',
  pathParams: {},
});
describe('workspace handlers', () => {
  it('uses only the verified tenant context and returns a saved revision', async () => {
    const save = vi.fn(async () => ({ version: 1, tiles: [] }));
    const handlers = createPluginServerHandlers({
      read: async () => ({ version: 0, tiles: [] }),
      save,
      isIconName: () => true,
    });
    expect(
      (
        await handlers['application-workspace.settings.save'](
          context({ version: 0, tiles: [], instanceId: 'foreign' })
        )
      )?.status
    ).toBe(200);
    expect(save.mock.calls[0]?.[0]?.actor.instanceId).toBe('one');
  });
  it('reports stale saves as conflicts', async () => {
    const handlers = createPluginServerHandlers({
      read: async () => null,
      save: async () => {
        throw new Error('workspace_version_conflict');
      },
      isIconName: () => true,
    });
    expect(
      (await handlers['application-workspace.settings.save'](context({ version: 0, tiles: [] })))
        .status
    ).toBe(409);
  });
  it('does not save an immutable Studio tile or arbitrary SVG', async () => {
    const save = vi.fn();
    const handlers = createPluginServerHandlers({
      read: async () => null,
      save,
      isIconName: () => true,
    });
    expect(
      (
        await handlers['application-workspace.settings.save'](
          context({ version: 0, tiles: [{ id: 'sva-studio' }] })
        )
      )?.status
    ).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
  it('fails closed on platform contexts and unavailable or invalid persistence', async () => {
    const host = {
      read: vi.fn(async () => {
        throw Error('offline');
      }),
      save: vi.fn(async () => {
        throw Error('offline');
      }),
      isIconName: () => true,
    };
    const handlers = createPluginServerHandlers(host);
    const valid = context({ version: 0, tiles: [] });
    expect(
      (
        await handlers['application-workspace.list']({
          ...valid,
          scope: 'platform',
          actor: { id: 'user', roles: [] },
        })
      ).status
    ).toBe(403);
    expect(
      (
        await handlers['application-workspace.settings.save']({
          ...valid,
          scope: 'platform',
          actor: { id: 'user', roles: [] },
        })
      ).status
    ).toBe(403);
    expect((await handlers['application-workspace.list'](valid)).status).toBe(503);
    expect(
      (await handlers['application-workspace.settings.save'](context({ version: 0, tiles: [] })))
        .status
    ).toBe(503);
  });
  it('rejects malformed JSON, oversized bodies and unknown icon names before saving', async () => {
    const save = vi.fn();
    const handlers = createPluginServerHandlers({
      read: async () => ({ version: 0, tiles: [] }),
      save,
      isIconName: () => false,
    });
    const base = context({ version: 0, tiles: [] });
    for (const body of ['{', ' '.repeat(200001)]) {
      expect(
        (
          await handlers['application-workspace.settings.save']({
            ...base,
            request: new Request('https://studio.example/api', { method: 'PUT', body }),
          })
        ).status
      ).toBe(400);
    }
    expect(
      (
        await handlers['application-workspace.settings.save'](
          context({
            version: 0,
            tiles: [
              {
                id: 'test',
                icon: 'nonexistent',
                url: 'https://example.org',
                texts: { de: { name: 'Name', description: 'Description', cta: 'Open' } },
              },
            ],
          })
        )
      ).status
    ).toBe(400);
    expect(save).not.toHaveBeenCalled();
    expect((await handlers['application-workspace.settings.get'](base)).status).toBe(200);
  });
});
