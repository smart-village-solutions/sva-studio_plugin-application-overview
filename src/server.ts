/** Plugin request handlers run only after host session/module/permission checks. */
import type {
  PluginServerExecutionHandler,
  PluginServerHandlerExecutionContext,
} from '@sva/plugin-sdk';
import {
  readWorkspaceConfiguration,
  WorkspaceValidationError,
  type WorkspaceConfiguration,
} from './contract.js';
export type WorkspaceRequestContext = Extract<
  PluginServerHandlerExecutionContext,
  { scope: 'tenant' | 'platform' }
>;
export type ApplicationWorkspaceHost = Readonly<{
  read: (instanceId: string) => Promise<unknown>;
  save: (
    context: WorkspaceRequestContext,
    configuration: WorkspaceConfiguration
  ) => Promise<unknown>;
  isIconName: (name: string) => boolean;
}>;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });
export const createPluginServerHandlers = (
  host: ApplicationWorkspaceHost
): Readonly<Record<string, PluginServerExecutionHandler>> => {
  const read: PluginServerExecutionHandler = async (context) => {
    if (context.scope !== 'tenant' || !context.actor.instanceId)
      return json({ error: 'forbidden' }, 403);
    try {
      return json({ data: readWorkspaceConfiguration(await host.read(context.actor.instanceId)) });
    } catch {
      return json({ error: 'workspace_unavailable' }, 503);
    }
  };
  return {
    'application-workspace.list': read,
    'application-workspace.settings.get': read,
    'application-workspace.settings.save': async (context) => {
      if (context.scope !== 'tenant' || !context.actor.instanceId)
        return json({ error: 'forbidden' }, 403);
      try {
        const body = await context.request.text();
        if (body.length > 200000)
          return json({ error: 'invalid_configuration', field: 'configuration' }, 400);
        let input: unknown;
        try {
          input = JSON.parse(body);
        } catch {
          return json({ error: 'invalid_configuration', field: 'configuration' }, 400);
        }
        const configuration = readWorkspaceConfiguration(input);
        if (configuration.tiles.some((tile) => !host.isIconName(tile.icon)))
          return json({ error: 'invalid_configuration', field: 'icon' }, 400);
        return json({ data: readWorkspaceConfiguration(await host.save(context, configuration)) });
      } catch (error) {
        if (error instanceof WorkspaceValidationError)
          return json({ error: error.message, field: error.field }, 400);
        if (error instanceof Error && error.message === 'workspace_version_conflict')
          return json({ error: 'workspace_version_conflict' }, 409);
        return json({ error: 'workspace_unavailable' }, 503);
      }
    },
  };
};
