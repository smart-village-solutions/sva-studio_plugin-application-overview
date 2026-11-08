/** Serializable plugin contributions; browser and persistence stay separate. */
import type { PluginDescriptor } from '@sva/plugin-sdk';
import { workspaceTranslations } from './plugin.translations.js';
export const workspaceReadSettings = {
  kind: 'tenant',
  moduleId: 'application-workspace',
  actions: { mode: 'allOf', values: ['application-workspace.settings.read'] },
} as const;
export const workspaceWriteSettings = {
  ...workspaceReadSettings,
  actions: {
    mode: 'allOf',
    values: ['application-workspace.settings.read', 'application-workspace.settings.update'],
  },
} as const;
export const pluginApplicationWorkspace: PluginDescriptor = {
  id: 'application-workspace',
  displayName: 'Anwendungen',
  routes: [
    {
      id: 'application-workspace.overview',
      layout: 'content-only',
      path: '/plugins/application-workspace',
      actionId: 'application-workspace.read',
      accessRequirement: { kind: 'authenticated' },
      documentation: { kind: 'page', id: 'application-workspace.overview', pageType: 'overview' },
    },
    {
      id: 'application-workspace.settings',
      path: '/plugins/application-workspace/settings',
      actionId: 'application-workspace.settings.read',
      accessRequirement: workspaceReadSettings,
      documentation: { kind: 'page', id: 'application-workspace.settings', pageType: 'detail' },
    },
  ],
  settings: { routeId: 'application-workspace.settings' },
  navigation: [
    {
      id: 'application-workspace.header',
      section: 'header',
      icon: 'grid-dots',
      to: '/plugins/application-workspace',
      titleKey: 'application-workspace.title',
      actionId: 'application-workspace.read',
      accessRequirement: { kind: 'authenticated' },
    },
  ],
  actions: [
    {
      id: 'application-workspace.read',
      titleKey: 'application-workspace.title',
      accessRequirement: { kind: 'authenticated' },
    },
    {
      id: 'application-workspace.settings.read',
      titleKey: 'application-workspace.readTitle',
      accessRequirement: workspaceReadSettings,
    },
    {
      id: 'application-workspace.settings.update',
      titleKey: 'application-workspace.updateTitle',
      accessRequirement: workspaceWriteSettings,
    },
  ],
  permissions: [
    {
      id: 'application-workspace.settings.read',
      titleKey: 'application-workspace.readTitle',
      descriptionKey: 'application-workspace.readDescription',
    },
    {
      id: 'application-workspace.settings.update',
      titleKey: 'application-workspace.updateTitle',
      descriptionKey: 'application-workspace.updateDescription',
    },
  ],
  moduleIam: {
    moduleId: 'application-workspace',
    permissionIds: ['application-workspace.settings.read', 'application-workspace.settings.update'],
    systemRoles: [
      {
        roleName: 'system_admin',
        permissionIds: [
          'application-workspace.settings.read',
          'application-workspace.settings.update',
        ],
      },
    ],
  },
  serverHandlers: [
    {
      id: 'application-workspace.list',
      path: '/api/v1/plugins/application-workspace',
      method: 'GET',
      actionId: 'application-workspace.read',
      accessRequirement: { kind: 'authenticated' },
    },
    {
      id: 'application-workspace.settings.get',
      path: '/api/v1/plugins/application-workspace/settings',
      method: 'GET',
      actionId: 'application-workspace.settings.read',
      accessRequirement: workspaceReadSettings,
    },
    {
      id: 'application-workspace.settings.save',
      path: '/api/v1/plugins/application-workspace/settings',
      method: 'PUT',
      actionId: 'application-workspace.settings.update',
      accessRequirement: workspaceWriteSettings,
    },
  ],
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
  translations: workspaceTranslations,
};
