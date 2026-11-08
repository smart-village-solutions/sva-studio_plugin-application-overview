/** Bounded, framework-independent application catalog validation and localization. */
export type TileText = Readonly<{
  name: string;
  description: string;
  cta: string;
}>;
export type ApplicationTile = Readonly<{
  id: string;
  icon: string;
  url: string;
  texts: Readonly<Record<string, TileText>>;
}>;
export type WorkspaceConfiguration = Readonly<{
  version: number;
  tiles: readonly ApplicationTile[];
}>;
export class WorkspaceValidationError extends Error {
  constructor(readonly field: string) {
    super("invalid_configuration");
  }
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WorkspaceValidationError("configuration");
  return value as Record<string, unknown>;
};
const text = (
  value: unknown,
  field: string,
  max: number,
  required = true,
): string => {
  if (typeof value !== "string") throw new WorkspaceValidationError(field);
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > max)
    throw new WorkspaceValidationError(field);
  return trimmed;
};
const readTileUrl = (value: unknown): string => {
  const url = text(value, "url", 2048);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WorkspaceValidationError("url");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    [...parsed.searchParams.keys()].some((key) =>
      /^(?:access_token|id_token|refresh_token|api_key|apikey|token|session_token)$/i.test(
        key,
      ),
    ) ||
    Array.from(url).some((character) => character.charCodeAt(0) <= 32)
  )
    throw new WorkspaceValidationError("url");
  return url;
};
const readTileTexts = (
  value: unknown,
  id: string,
): Record<string, TileText> => {
  const translations = record(value);
  if (
    !Object.prototype.hasOwnProperty.call(translations, "de") ||
    Object.keys(translations).length > 30
  )
    throw new WorkspaceValidationError("texts.de");
  const texts: Record<string, TileText> = {};
  for (const [locale, raw] of Object.entries(translations)) {
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale))
      throw new WorkspaceValidationError("locale");
    const fields = record(raw);
    texts[locale] = {
      name: text(fields.name, `${id}.${locale}.name`, 120, locale === "de"),
      description: text(
        fields.description,
        `${id}.${locale}.description`,
        1000,
        locale === "de",
      ),
      cta: text(fields.cta, `${id}.${locale}.cta`, 80, locale === "de"),
    };
  }
  return texts;
};
export const readWorkspaceConfiguration = (
  value: unknown,
): WorkspaceConfiguration => {
  const input = record(value);
  if (
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 0 ||
    Number(input.version) > 2147483647
  )
    throw new WorkspaceValidationError("version");
  if (!Array.isArray(input.tiles) || input.tiles.length > 100)
    throw new WorkspaceValidationError("tiles");
  const seen = new Set<string>();
  const tiles = input.tiles.map((entry: unknown): ApplicationTile => {
    const tile = record(entry);
    const id = text(tile.id, "id", 64);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || id === "sva-studio" || seen.has(id))
      throw new WorkspaceValidationError("id");
    seen.add(id);
    const icon = text(tile.icon, "icon", 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(icon) || icon.endsWith("-filled"))
      throw new WorkspaceValidationError("icon");
    const url = readTileUrl(tile.url);
    const texts = readTileTexts(tile.texts, id);
    return { id, icon, url, texts };
  });
  return { version: input.version as number, tiles };
};
export const resolveTileText = (
  tile: ApplicationTile,
  locale: string,
): TileText => {
  const fallback = tile.texts.de;
  if (!fallback) throw new WorkspaceValidationError("texts.de");
  const current = tile.texts[locale];
  return {
    name: current?.name.trim() || fallback.name,
    description: current?.description.trim() || fallback.description,
    cta: current?.cta.trim() || fallback.cta,
  };
};
