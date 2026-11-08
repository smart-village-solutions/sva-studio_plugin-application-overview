# SVA Studio – Anwendungsarbeitsplatz

Eigenständig versioniertes Plugin `@sva/plugin-application-workspace`. Es bündelt kommunale Web-Anwendungen in einer instanzbezogenen, mehrsprachigen Kachelübersicht. Das feste SVA Studio bleibt die erste Kachel. Die Zielsysteme behalten ihre eigene Anmeldung und Rechteprüfung.

## Repository-Grenze

Dieses Repository enthält Browseroberflächen, Übersetzungen, Validierung, Descriptor, Serverhandler und deren Tests. Es enthält keine Studio-Quellcodeimporte, Nx-Projektdateien oder `workspace:*`-Abhängigkeiten. Öffentliche Peer-Pakete sind `@sva/plugin-sdk`, `@sva/studio-ui-react` und React. Der Tabler-Picker gehört zum gemeinsamen Studio-Designsystem, einschließlich der Figma-Komponente `262:5037`.

Der Studio-Host stellt weiterhin Sitzung, Modulaktivierung, Berechtigungen und einen schmalen Speicher-/Audit-Adapter bereit. Dieser Adapter implementiert den exportierten Typ `ApplicationWorkspaceHost` aus `@sva/plugin-application-workspace/server`. Er leitet die Instanz aus dem verifizierten Request-Kontext ab und speichert Konfiguration und Audit atomar in der Studio-Datenbank. Die zugehörige Host-Migration bleibt im kanonischen Studio-DB-Pfad; dieses Paket greift nicht direkt auf Host-Datenbankpakete zu.

## Lokale Entwicklung

Voraussetzungen: Node >=24.15.0, pnpm 11.3.0 und gebaute öffentliche SDK-/UI-Pakete aus dem Studio-Change `add-application-workspace-plugin`. Die derzeitige Entwicklungsversion benötigt die dort ergänzten Verträge für Plugin-Einstellungen, Header-Navigation und `content-only`-Layouts; die Versionsnummer `0.0.1` allein ist noch keine Freigabe für ältere Studio-Builds.

```sh
pnpm install --frozen-lockfile
# STUDIO_REPO zeigt auf den passenden Studio-Checkout.
pnpm link "$STUDIO_REPO/packages/plugin-sdk" "$STUDIO_REPO/packages/studio-ui-react"
# Bei lokalen UI-Links dieselbe React-Instanz verwenden:
pnpm link "$STUDIO_REPO/apps/sva-studio-react/node_modules/react" "$STUDIO_REPO/apps/sva-studio-react/node_modules/react-dom"
pnpm build
pnpm typecheck
pnpm test:coverage
```

`pnpm link` erzeugt lokale Overrides. Diese lokalen Pfade gehören nicht in Commits oder veröffentlichte Pakete. Das Plugin kompiliert gegen die öffentlichen `dist`-Exports der beiden Peer-Pakete; seine TypeScript-/Vitest-Konfiguration lädt keine Studio-Quelldateien. Bei später verfügbaren Registry-Artefakten können die kompatiblen Peer-Pakete stattdessen regulär installiert werden. Die SDK-/UI-Veröffentlichung ist ein eigener Release-Schritt.

## Paket und Studio-Einbindung

```sh
pnpm pack
# Im Studio-Checkout: erzeugtes Paket als direkte App-Dependency installieren.
pnpm --filter sva-studio-react add /absoluter/pfad/sva-plugin-application-workspace-0.0.1.tgz
```

Der Katalogeintrag verwendet den bestehenden Installationspfad:

```json
{
  "pluginId": "application-workspace",
  "sourceType": "installed-distribution",
  "sourceRef": "@sva/plugin-application-workspace",
  "distribution": "studio",
  "enabled": true
}
```

Für gemeinsam entwickelte lokale Checkouts kann `sourceType: "linked-package"` mit einer direkten verlinkten App-Dependency verwendet werden. Die eigentliche Aktivierung pro Kommune ist davon getrennt. Studio wird mit dem installierten Paket neu gebaut; das Plugin ist kein eigener laufender Dienst und kein Hot-Plugin-Loader.

Das Manifest verweist auf `dist/descriptor.js`, `dist/index.js` und `dist/server.js`. Das Paket enthält zusätzlich die Lizenz und `publiccode.yml`. Der Descriptor liefert den Header-Einstieg über `navigation.section: "header"` und die seitenleistenfreie Übersicht über `routes[].layout: "content-only"`.

## Rechte und Betrieb

- Die Übersicht steht allen angemeldeten Benutzern einer Instanz mit aktivem Modul zur Verfügung.
- Lesen der Einstellungen: `application-workspace.settings.read`.
- Änderungen: zusätzlich `application-workspace.settings.update`.
- HTTPS-Ziele, stabile Kachelkennungen und deutsche Pflichttexte werden client- und serverseitig validiert. Weitere Sprachen fallen je Feld auf Deutsch zurück.
- Konkurrierende Änderungen werden durch Versionsprüfung abgewiesen. Bei unklarem Speicherergebnis wird der gespeicherte Stand nachgelesen und keine Mutation automatisch wiederholt.
- Deaktivierung löscht keine Kacheln. SSO setzt eine eigene OIDC-/SAML-Anbindung der Zielsysteme an einen gemeinsamen Identity Provider voraus; gleiche IP-Adressen bewirken keine gemeinsame Anmeldung.

Das lokale Repository hat noch kein Remote. Deshalb enthält die lokale Modulmetadatei keine erfundene Repository-URL; diese wird erst mit einer ausdrücklich beauftragten Remote-Veröffentlichung festgelegt. Keine Veröffentlichung, Aktivierung oder Migration wird durch den Paket-Build ausgeführt.
