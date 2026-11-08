/** Browser-only application workspace entry. */
import type { PluginDefinition } from '@sva/plugin-sdk';
import { pluginApplicationWorkspace as descriptor } from './descriptor.js';
import { WorkspacePage } from './workspace-page.js';
import { WorkspaceSettingsPage } from './workspace-settings.js';
export const pluginApplicationWorkspace: PluginDefinition = {
  ...descriptor,
  routes: descriptor.routes.map((route) => ({
    ...route,
    component:
      route.id === 'application-workspace.settings' ? WorkspaceSettingsPage : WorkspacePage,
  })),
};
