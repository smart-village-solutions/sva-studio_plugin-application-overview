# Geprüfter Runtime-Beitrag

`src/server.ts` bindet ausschließlich den öffentlichen Speicher-/Audit-Vertrag. Dieser Eintrag erlaubt keine privaten Imports oder anderen Boundary-Verstöße.

## Machine Readable Baseline

```json
[
  {
    "packageName": "@sva/plugin-application-workspace",
    "relativePath": "src/server.ts",
    "rule": "review-required-path-signal",
    "subject": "server.ts",
    "owner": "plugin-maintainers",
    "justification": "Public injected host capabilities only; dispatcher and real host adapter require integration evidence. No private host imports or own database.",
    "removalChange": "Reevaluate whenever the server capability or persistence ownership changes."
  }
]
```
