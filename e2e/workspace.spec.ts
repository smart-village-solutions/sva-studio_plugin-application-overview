import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const configuration = {
  version: 1,
  tiles: [
    {
      id: "calendar",
      icon: "calendar",
      url: "https://calendar.example",
      texts: {
        de: {
          name: "Kalender",
          description: "Kommunale Termine",
          cta: "Öffnen",
        },
        en: { name: "Calendar", description: "Municipal events", cta: "Open" },
      },
    },
  ],
};
for (const width of [1440, 390]) {
  test(`actual host application workspace at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([
      { name: "sva_dev_auth", value: "1", domain: "localhost", path: "/" },
    ]);
    await page.route(
      "**/api/v1/plugins/application-workspace**",
      async (route) => {
        await route.fulfill({ json: { data: configuration } });
      },
    );
    const actions = [
      "application-workspace.settings.read",
      "application-workspace.settings.update",
    ];
    await page.route("**/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: "qa-browser",
            name: "QA",
            instanceId: "de-musterhausen",
            assignedModules: ["application-workspace"],
            roles: ["system_admin"],
            permissionActions: actions,
          },
        },
      }),
    );
    await page.route("**/iam/me/permissions?**", (route) =>
      route.fulfill({
        json: {
          instanceId: "de-musterhausen",
          permissions: actions.map((action) => ({
            action,
            resourceType: "application-workspace.settings",
          })),
          subject: {
            actorUserId: "qa-browser",
            effectiveUserId: "qa-browser",
            isImpersonating: false,
          },
        },
      }),
    );
    await page.route("**/iam/me/legal-texts/pending", (route) =>
      route.fulfill({
        json: { data: [], pagination: { page: 1, pageSize: 0, total: 0 } },
      }),
    );
    await page.route("**/api/v1/iam/me/context", (route) =>
      route.fulfill({
        json: {
          data: {
            activeOrganizationId: null,
            organizations: [],
            personalMainserverReadiness: "missing_credentials",
          },
        },
      }),
    );
    await page.goto("/plugins/application-workspace");
    await expect(
      page.getByRole("heading", { name: "Anwendungen", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Anwendungen", exact: true }),
    ).toBeVisible();
    await expect(page.locator("aside")).toHaveCount(0);
    const main = page.getByRole("main");
    const links = main.getByRole("link");
    await expect(links.first()).toHaveAttribute("href", "/");
    await expect(main.getByText("Kalender", { exact: true })).toBeVisible();
    await expect(
      main.getByRole("link", { name: /Öffnen · Kalender/ }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) =>
          document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      await page.screenshot({
        path: test.info().outputPath(`overview-${theme}.png`),
        fullPage: true,
      });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
    }
    await page
      .getByRole("button", { name: "Sprache wechseln", exact: true })
      .click();
    await page.getByRole("menuitem", { name: /^English/ }).click();
    await expect(
      page.getByRole("heading", { name: "Applications", exact: true }),
    ).toBeVisible();
    await expect(main.getByText("Calendar", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Switch language", exact: true })
      .click();
    await page.getByRole("menuitem", { name: /^German/ }).click();
    await page.goto("/plugins/application-workspace/settings");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Kalender",
    );
    await page.getByLabel("Name", { exact: true }).focus();
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel("Beschreibung", { exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Anwendung entfernen", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Anwendung entfernen", exact: true }),
    ).toBeFocused();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
