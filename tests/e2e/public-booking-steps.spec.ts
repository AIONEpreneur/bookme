import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow } from "./helpers";

test("@booking-steps invitee progress validates forward navigation and remains keyboard operable", async ({ page }) => {
  let publicEventRequestCount = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/public/strategy-call") publicEventRequestCount += 1;
  });
  await page.goto("/book/strategy-call");
  const firstTime = page.locator(".time-grid button").first();
  await expect(firstTime).toBeVisible();
  expect(publicEventRequestCount).toBe(1);

  const timeStep = page.getByRole("button", { name: "Schritt Zeit" });
  const detailsStep = page.getByRole("button", { name: /Schritt Details/ });
  const reviewStep = page.getByRole("button", { name: /Schritt Prüfen/ });

  for (const [control, label] of [[timeStep, "Zeit"], [detailsStep, "Details"], [reviewStep, "Prüfen"]] as const) {
    await expect(control).toContainText(label);
    expect(await control.locator("span").evaluate((element) => getComputedStyle(element).fontSize)).not.toBe("0px");
  }
  await expect(timeStep).toHaveAttribute("aria-current", "step");
  await expect(detailsStep).toHaveAttribute("aria-disabled", "true");
  await expect(reviewStep).toHaveAttribute("aria-disabled", "true");

  await reviewStep.focus();
  await reviewStep.press("Enter");
  await expect(page.locator(".form-error")).toContainText("Wähle eine verfügbare Zeit");
  await expect(timeStep).toHaveAttribute("aria-current", "step");

  await firstTime.click();
  await expect(detailsStep).toHaveAttribute("aria-disabled", "false");
  await detailsStep.focus();
  await detailsStep.press("Enter");

  const detailsHeading = page.getByRole("heading", { name: "Erzähl uns von dir" });
  await expect(detailsHeading).toBeFocused();
  await expect(reviewStep).toHaveAttribute("aria-disabled", "true");

  await reviewStep.focus();
  await reviewStep.press("Enter");
  await expect(page.locator(".form-error")).toContainText("Gib einen gültigen Namen und eine gültige E-Mail-Adresse ein");
  await expect(detailsHeading).toBeVisible();

  await page.getByLabel("Name").fill("Keyboard Invitee");
  await page.getByLabel("E-Mail-Adresse").fill("keyboard-invitee@example.com");
  await expect(reviewStep).toHaveAttribute("aria-disabled", "false");
  await reviewStep.focus();
  await reviewStep.press("Enter");

  const reviewHeading = page.getByRole("heading", { name: "Überprüfe deine Buchung" });
  await expect(reviewHeading).toBeFocused();
  await expect(reviewStep).toHaveAttribute("aria-current", "step");

  await timeStep.focus();
  await timeStep.press("Enter");
  await expect(page.getByRole("heading", { name: "Wähle eine Dauer" })).toBeFocused();
  await expect(page.getByRole("button", { name: /Weiter/ })).toBeEnabled();

  await detailsStep.focus();
  await detailsStep.press("Enter");
  await reviewStep.focus();
  await reviewStep.press("Enter");
  await expect(reviewHeading).toBeFocused();
  await assertNoHorizontalOverflow(page);
});
