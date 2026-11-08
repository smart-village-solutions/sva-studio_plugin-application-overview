/** Responsive municipal application launcher; target services keep their own access rules. */
import { usePluginTranslation, readPluginLocales } from '@sva/plugin-sdk';
import { Button, StudioPageTitle, TablerIcon } from '@sva/studio-ui-react';
import { resolveTileText } from './contract.js';
import { useWorkspace } from './use-workspace.js';
export const WorkspacePage = () => {
  const pt = usePluginTranslation('application-workspace');
  const { locale } = readPluginLocales();
  const { configuration, loading, error, reload } = useWorkspace(false);
  const tiles = [
    {
      id: 'sva-studio',
      icon: 'layout-dashboard',
      url: '/',
      name: pt('studioName'),
      description: pt('studioDescription'),
      cta: pt('studioCta'),
    },
    ...(configuration?.tiles ?? []).map((tile) => ({ ...tile, ...resolveTileText(tile, locale) })),
  ];
  return (
    <section className="mx-auto w-full max-w-6xl space-y-8" aria-busy={loading}>
      <header className="space-y-2">
        <StudioPageTitle>{pt('title')}</StudioPageTitle>
        <p className="max-w-2xl text-muted-foreground">{pt('description')}</p>
      </header>
      {loading ? <p role="status">{pt('loading')}</p> : null}
      {error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4">
          <p>{pt('error')}</p>
          <Button onClick={reload} variant="secondary">
            {pt('retry')}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <article
            key={tile.id}
            className="flex min-h-64 flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <TablerIcon name={tile.icon} size={28} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{tile.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
              {tile.description}
            </p>
            <a
              className="mt-6 inline-flex min-h-11 items-center gap-2 self-start rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={tile.url}
              {...(tile.id !== 'sva-studio'
                ? {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    'aria-label': `${tile.cta} · ${tile.name} · ${pt('newTab')}`,
                  }
                : {})}
            >
              {tile.cta}
              {tile.id !== 'sva-studio' ? <span className="sr-only">{pt('newTab')}</span> : null}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
};
