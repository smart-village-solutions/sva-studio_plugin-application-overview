# SVA Studio – Anwendungsarbeitsplatz

Eigenständig versioniertes Plugin `@sva/plugin-application-workspace`. Es bündelt kommunale Web-Anwendungen in einer instanzbezogenen, mehrsprachigen Kachelübersicht. Das feste SVA Studio bleibt die erste Kachel. Die Zielsysteme behalten ihre eigene Anmeldung und Rechteprüfung.

## Repository-Grenze

Dieses Repository enthält Browseroberflächen, Übersetzungen, Validierung, Descriptor, Serverhandler und deren Tests. Es enthält keine Studio-Quellcodeimporte, Nx-Projektdateien oder `workspace:*`-Abhängigkeiten. Öffentliche Peer-Pakete sind `@sva/plugin-sdk`, `@sva/studio-ui-react` und React. Der Tabler-Picker gehört zum gemeinsamen Studio-Designsystem, einschließlich der Figma-Komponente `262:5037`.

Der Studio-Host stellt weiterhin Sitzung, Modulaktivierung, Berechtigungen und einen schmalen Speicher-/Audit-Adapter bereit. Dieser Adapter implementiert den exportierten Typ `ApplicationWorkspaceHost` aus `@sva/plugin-application-workspace/server`. Er leitet die Instanz aus dem verifizierten Request-Kontext ab und speichert Konfiguration und Audit atomar in der Studio-Datenbank. Die zugehörige Host-Migration bleibt im kanonischen Studio-DB-Pfad; dieses Paket greift nicht direkt auf Host-Datenbankpakete zu.

## Qualitätssicherung und Referenzstatus

Dieses Repository implementiert den gemeinsamen Studio-QS-Vertrag **QS-01 bis QS-09** als ersten externen Referenzverbraucher. Die Regelquelle bleibt der [Studio-Plugin-Guide](https://github.com/smart-village-solutions/sva-studio/blob/main/docs/development/plugin-development.md); der konkrete Host-/Policy-Commit steht in [studio-compatibility.json](config/studio-compatibility.json). Das Plugin ist bis zur vollständigen technischen und manuellen Abnahme **Musterkandidat**. Ein lokaler Lauf, ein hochgeladenes Paket oder ein einzelner grüner Check ist keine vollständige Musterfreigabe.

Das Profil umfasst UI/i18n, Header-/Layout-Beiträge und serverseitige Einstellungen über den öffentlichen Speicher-/Audit-Adapter. Eigene Jobs, Imports, Exports und ein eigener Datenbankdienst sind nicht vorhanden. Diese Beiträge werden deshalb nicht künstlich nachgebaut. Die Host-Dateninvarianten werden trotzdem gegen echte PostgreSQL-/Redis-Instanzen geprüft.

| Vertrag | Implementierter Nachweis |
| --- | --- |
| QS-01 Reproduzierbarkeit | Pinned Node/pnpm, eigener Lockfile, sauberer Studio-Commit, identifizierte öffentliche Peer-Tarballs; Paket-Consumer außerhalb beider Quellbäume |
| QS-02 Statische Qualität/Grenzen | Lint/Strict Types, bestehende Studio-Boundary-/UI-/Komplexitätsprüfer mit explizitem externem Root; geprüfter Runtime-Beitrag in [config/plugin-architecture-review.md](config/plugin-architecture-review.md) |
| QS-03 Verhalten/Coverage | Vitest erfasst alle produktiven Quellen; mindestens 85 % je Gesamtmetrik; gemeinsame Studio-Floors, New-Code- und Regressionsprüfung gegen die geprüfte Baseline; fehlende Reports/Quellen scheitern |
| QS-04 UI/i18n/Accessibility | Unit-Tests und Playwright im tatsächlichen Studio mit kontrollierten HTTP-Fixtures: Desktop/Mobil, Themes, Sprache, Tastatur/Fokus und Axe; manuelle UX-/Screenreader-/Fachabnahme bleibt ein eigener Schritt |
| QS-05 Server/Daten | Tatsächlich installiertes Paket, echte Cookie-Sitzung in Redis, realer Dispatcher, CSRF, Modul-/Rechteentzug, Instanzisolation, CAS/Readback und Rollback bei echtem Audit-Insert-Fehler in disposable PostgreSQL |
| QS-06 Host-Kompatibilität | Ein gepackter Kandidat über den normalen Paket-/Katalogpfad; entfernte Option auch durch Build und vorhandenen Studio-Runtime-Startnachweis; wiederverwendbarer Workflow mit festen Plugin-/Studio-SHAs für Core-Gegenprüfungen |
| QS-07 Artefaktidentität | Consumer und Host prüfen denselben Tarball; `candidate.json` verbindet Plugin-/Host-Commit, Peer-Digests, Paket-Digest und Consumer-Lockfile; keine automatische Veröffentlichung |
| QS-08 CI/Review/Merge | Plugin Quality, Studio Compatibility, CodeQL sowie SonarCloud/Codecov; erforderliche Statusprüfungen werden am konkreten HEAD ausgewertet und über GitHub-Merge-Regeln geschützt |
| QS-09 Ownership/Referenz | Plattformteam besitzt öffentliche Host-/Policy-Verträge; Plugin-Maintainer besitzen Plugin und Kompatibilitätsnachweise. Die Abnahme nennt einen konkreten Commit und die vollständigen anwendbaren Nachweise |

[Plugin Quality](.github/workflows/quality.yml) prüft Plugin-PRs und `main`. Studio kann dieselbe Prüfung über `workflow_call` mit **beiden festen Commit-SHAs** aufrufen; dadurch ist ein neuer Plugin-Commit kein notwendiger Auslöser für eine Core-Gegenprüfung. Der erste unterstützte Host-Vertrag ist noch ein Kandidat; frühere Studio-Versionen bieten die benötigten öffentlichen Verträge nicht. Untergrenze und aktueller Kandidat sind daher zunächst derselbe Stand.

Die Jobs für Tests und Host-Integration besitzen keine Analyse-/Release-Secrets. Codecov nutzt im gesonderten Analysejob GitHub-OIDC. Nur der offizielle Sonar-Scanner erhält dort den Analysezugang; er liest Quelltexte mit separat erzeugten festen Scanner-Einstellungen und führt keine Plugin-Skripte aus. Fork-PRs erhalten keine Repository-Secrets; eine fehlende erforderliche Sonar-Analyse gilt nicht als bestanden und benötigt einen nach Review vertrauenswürdig übernommenen Stand. Release-Berechtigungen sind nicht eingerichtet.

Vor der Bezeichnung **abgenommene Musterlösung** müssen die terminalen Prüfungen des jeweiligen finalen HEAD, fachliche Reviews und die gezielte manuelle UI-/Screenreader-Abnahme dokumentiert sein. Automatische Screenshots und Axe ersetzen diese Abnahme nicht. Eine Ausnahme benötigt Owner, Ticket, begründetes Risiko und eine überprüfbare Endbedingung.

## Lokale Entwicklung

Voraussetzungen: Node 24.15.0, pnpm 11.3.0 und ein sauberer, zum [Host-Pin](config/studio-compatibility.json) passender Studio-Checkout. Ein laufender Studio-Server wird erst für Integration und Browserprüfung benötigt. SDK-/UI-Peers und ihre internen Laufzeitabhängigkeiten werden als öffentliche Pakete gebaut; Studio-Quellcode wird nicht in das Plugin importiert.

```sh
export pnpm_config_verify_deps_before_run=never
pnpm install --frozen-lockfile
# STUDIO_REPO zeigt auf den passenden sauberen, committeten Studio-Checkout.
node scripts/studio-peers.ts prepare "$STUDIO_REPO" "$PWD/.artifacts/peers"
node scripts/studio-peers.ts install "$PWD/.artifacts/peers"
pnpm lint
pnpm typecheck
pnpm test:coverage
node scripts/studio-peers.ts restore
```

Der Installationsschritt ergänzt ausschließlich für den lokalen Consumer temporäre Peer-Dateiverweise. `restore` stellt Paketmanifest, Workspace-Konfiguration und Lockfile bytegleich wieder her; diese temporären Verweise gehören nicht in Commits oder Pakete. Die Peer-Artefakte und ihre Digests liegen unter dem ignorierten `.artifacts/`. Die identifizierten Tiptap-/PostCSS-Auflösungsregeln des SDK-/UI-Produzenten werden für dessen öffentlichen Consumer übernommen, um dessen vorhandene Peer-Verträge konsistent zu installieren.

Für einen **sauberen, committeten** Plugin-Kandidaten nach den Tests:

```sh
pnpm pack --pack-destination .artifacts/candidate
node scripts/package-consumer.ts .artifacts/candidate/sva-plugin-application-workspace-0.0.1.tgz .artifacts/peers .artifacts/evidence
node scripts/host-candidate.ts install "$STUDIO_REPO" .artifacts
STUDIO_REPO="$STUDIO_REPO" pnpm test:e2e
node scripts/host-candidate.ts remove "$STUDIO_REPO"
```

Der Host-Installer verändert nur die temporäre direkte App-Dependency, den Katalog und das Lockfile im ausdrücklich gewählten Test-Checkout. `remove` stellt diese drei Dateien wieder her und entfernt die installierte App-Verknüpfung. Ein produktiver Checkout ist dafür nicht vorgesehen. Die CI richtet außerdem die disposable Datenbank ein und führt die realen Server-/Datenprüfungen aus. Lokale Läufe werden nicht als entfernte Merge-Nachweise dargestellt.

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

Quellcode: [https://github.com/smart-village-solutions/sva-studio_plugin-application-overview](https://github.com/smart-village-solutions/sva-studio_plugin-application-overview). Eine Veröffentlichung des NPM-Pakets, Aktivierung oder Migration wird durch den Paket-Build nicht ausgeführt.
