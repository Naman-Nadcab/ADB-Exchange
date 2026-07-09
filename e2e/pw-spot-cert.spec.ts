import { test, expect } from "@playwright/test";
import { loginUserViaUI } from "./mission2/helpers/login";
import { QA_TRADER_A, QA_PASSWORD } from "./mission2/helpers/credentials";

test.use({ channel: undefined, launchOptions: { headless: true } });

test.describe("Spot Terminal Certification", () => {
  test("login + spot load + last price region", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await loginUserViaUI(page, QA_TRADER_A, QA_PASSWORD);
    await page.goto("/trade/spot?symbol=BTC_USDT", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForTimeout(6000);
    const text = await page.locator("body").innerText();
    expect(text).toMatch(/Last Price|Last/i);
    expect(text).toMatch(/BTC/i);
    const filtered = errors.filter(
      (e) =>
        !/favicon|sourcemap|Failed to load resource.*404|webpack|RSC payload|Falling back to browser navigation/i.test(
          e
        )
    );
    expect(filtered, `Unexpected console errors: ${JSON.stringify(filtered)}`).toEqual([]);
  });

  test("rapid pair switching", async ({ page }) => {
    await loginUserViaUI(page, QA_TRADER_A, QA_PASSWORD);
    for (const sym of ["BTC_USDT", "ETH_USDT", "SOL_USDT", "ADA_USDT", "DOGE_USDT"]) {
      await page.goto(`/trade/spot?symbol=${sym}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      expect(page.url()).toContain(sym.split("_")[0]);
    }
  });

  test("bottom panel tab navigation", async ({ page }) => {
    await loginUserViaUI(page, QA_TRADER_A, QA_PASSWORD);
    await page.goto("/trade/spot?symbol=BTC_USDT");
    await page.waitForTimeout(4000);
    for (const name of ["Open Orders", "Order History", "Trade History", "Assets"]) {
      const tab = page.getByRole("button", { name: new RegExp(name, "i") }).first();
      if (await tab.count()) { await tab.click(); await page.waitForTimeout(600); }
    }
  });

  test("screenshot spot terminal", async ({ page }) => {
    await loginUserViaUI(page, QA_TRADER_A, QA_PASSWORD);
    await page.goto("/trade/spot?symbol=BTC_USDT");
    await page.waitForTimeout(6000);
    await page.screenshot({ path: "e2e/.cert-spot-terminal.png", fullPage: false });
  });
});
