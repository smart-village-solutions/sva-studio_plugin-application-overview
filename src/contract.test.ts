/** Configuration validation protects the immutable tile and tenant-owned data. */
import { describe, expect, it } from 'vitest';
import { readWorkspaceConfiguration, resolveTileText } from './contract.js';
const tile = {
  id: 'one',
  icon: 'calendar',
  url: 'https://example.org',
  texts: {
    de: { name: 'Kalender', description: 'Termine', cta: 'Öffnen' },
    en: { name: 'Calendar', description: ' ', cta: 'Open' },
  },
};
describe('workspace configuration', () => {
  it('resolves partial translations per field', () => {
    const [first] = readWorkspaceConfiguration({ version: 0, tiles: [tile] }).tiles;
    if (!first) throw new Error('expected_parsed_tile');
    expect(resolveTileText(first, 'en')).toEqual({
      name: 'Calendar',
      description: 'Termine',
      cta: 'Open',
    });
  });
  it.each([
    'javascript:alert(1)',
    'http://example.org',
    'https://user:pass@example.org',
    'https://example.org?access_token=secret',
    'https://example.org/\nfoo',
  ])('rejects unsafe URL %s', (url) =>
    expect(() => readWorkspaceConfiguration({ version: 0, tiles: [{ ...tile, url }] })).toThrow()
  );
  it.each(['sva-studio', '../x'])('protects reserved and malformed IDs', (id) =>
    expect(() => readWorkspaceConfiguration({ version: 0, tiles: [{ ...tile, id }] })).toThrow()
  );
  it('rejects duplicate IDs and missing required German texts', () => {
    expect(() => readWorkspaceConfiguration({ version: 0, tiles: [tile, tile] })).toThrow();
    expect(() =>
      readWorkspaceConfiguration({ version: 0, tiles: [{ ...tile, texts: { en: tile.texts.en } }] })
    ).toThrow();
  });
  it('limits configuration size and rejects invalid revisions', () => {
    expect(readWorkspaceConfiguration({ version: 2147483647, tiles: [] }).version).toBe(2147483647);
    expect(() => readWorkspaceConfiguration({ version: 2147483648, tiles: [] })).toThrow();
    expect(() => readWorkspaceConfiguration({ version: -1, tiles: [] })).toThrow();
    expect(() =>
      readWorkspaceConfiguration({ version: 0, tiles: Array(101).fill(tile) })
    ).toThrow();
  });
  it.each([
    { ...tile, icon: 'calendar-filled' },
    { ...tile, icon: '<svg>' },
    { ...tile, texts: { de: { ...tile.texts.de, name: '  ' } } },
    { ...tile, texts: { de: { ...tile.texts.de, description: 'x'.repeat(1001) } } },
    { ...tile, texts: { de: tile.texts.de, 'invalid locale': tile.texts.en } },
    { ...tile, texts: null },
    { ...tile, id: 42 },
    { ...tile, url: 'not-a-url' },
  ])('rejects unsupported icon and malformed localized input', (invalidTile) => {
    expect(() => readWorkspaceConfiguration({ version: 0, tiles: [invalidTile] })).toThrow();
  });
});
