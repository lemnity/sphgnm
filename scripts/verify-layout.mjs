import { chromium } from "playwright";

const baseUrl = process.env.URL ?? "http://127.0.0.1:3000/";
const failures = [];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}\n  ${message}`);
  }
}

async function settlePage(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }
    window.scrollTo(0, 0);
  });
}

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newPage({
    viewport: { width: 1685, height: 1000 },
    reducedMotion: "reduce",
  });
  await settlePage(desktop);

  await check("PDF primary sections render in the approved order", async () => {
    const pageText = (await desktop.locator("body").innerText()).replace(/\s+/g, " ").toLowerCase();
    const markers = [
      "living substrates for green roofs, vertical gardens and interiors",
      "two solutions for urban greening at every scale",
      "53,000 km²",
      "engineered root-zone performance",
      "flagship installations",
      "where our solutions perform",
      "sphagnum eco — advantages",
    ];

    let previous = -1;
    for (const marker of markers) {
      const position = pageText.indexOf(marker, previous + 1);
      invariant(position >= 0, `Missing primary-flow marker: “${marker}”`);
      invariant(position > previous, `Primary-flow marker is out of order: “${marker}”`);
      previous = position;
    }
  });

  await check("every rendered section image is loaded", async () => {
    const result = await desktop.locator("section img").evaluateAll(async (images) => {
      await Promise.all(images.map((image) => image.decode?.().catch(() => undefined)));
      return {
        count: images.length,
        broken: images
          .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
          .map((image) => image.currentSrc || image.getAttribute("src") || "<missing src>"),
      };
    });

    invariant(result.count > 0, "No section images were rendered");
    invariant(result.broken.length === 0, `Broken section images: ${result.broken.join(", ")}`);
  });

  await check("solution artwork has transparent left and bottom margins", async () => {
    const artwork = await desktop.locator("[data-solution-image]").evaluateAll((images) => images.map((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let clipped = 0;
      let visible = 0;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 32) {
            visible += 1;
            if (x < 3 || y >= canvas.height - 3) clipped += 1;
          }
        }
      }
      return { src: image.currentSrc, clipped, visible };
    }));
    invariant(artwork.length === 2, "Expected two solution illustrations");
    for (const image of artwork) {
      invariant(image.visible > 1000, `Artwork is empty: ${image.src}`);
      invariant(image.clipped === 0, `Artwork touches its left or bottom crop boundary: ${image.src}`);
    }
  });

  await check("reference decorative visuals are present and visible", async () => {
    const requiredVisuals = [
      "solutions-vines",
      "portfolio-botanical",
      "portfolio-dots",
    ];

    for (const visual of requiredVisuals) {
      const locator = desktop.locator(`[data-reference-visual="${visual}"]`);
      invariant((await locator.count()) === 1, `Missing reference visual: ${visual}`);
      const box = await locator.boundingBox();
      invariant(box && box.width >= 40 && box.height >= 40, `Reference visual is not visibly rendered: ${visual}`);
    }

    const vineTransparency = await desktop.locator('[data-reference-visual="solutions-vines"]').evaluate((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0;
      for (let index = 3; index < pixels.length; index += 4 * 400) {
        if (pixels[index] < 16) transparent += 1;
      }
      return transparent;
    });
    invariant(vineTransparency >= 10, `Solutions foliage is still backed by an opaque cropped rectangle (${vineTransparency} transparent samples)`);

    const tagIcons = desktop.locator("#advantages [data-advantage-tag] svg");
    invariant((await tagIcons.count()) === 6, `Expected 6 advantage tag icons, found ${await tagIcons.count()}`);
  });

  await check("individual hanging branches respond to the desktop cursor and reset on leave", async () => {
    const motionPage = await browser.newPage({
      viewport: { width: 1685, height: 1000 },
      reducedMotion: "no-preference",
    });
    await settlePage(motionPage);

    const vineGroup = motionPage.locator('[data-vines-interactive]');
    const branches = motionPage.locator('[data-vine-branch]');
    invariant((await vineGroup.count()) === 1, "Interactive vines group is missing");
    invariant((await branches.count()) >= 8, `Expected at least 8 independently animated branches, found ${await branches.count()}`);
    await vineGroup.scrollIntoViewIfNeeded();
    const section = motionPage.locator("#product");
    const sectionBox = await section.boundingBox();
    invariant(sectionBox, "Solutions section is missing");

    await section.hover({
      position: {
        x: sectionBox.width * 0.18,
        y: Math.min(sectionBox.height * 0.45, 460),
      },
    });
    await motionPage.waitForTimeout(80);
    const active = await branches.evaluateAll((elements) => elements.map((element) => ({
      x: element.style.getPropertyValue("--vine-x"),
      y: element.style.getPropertyValue("--vine-y"),
      rotate: element.style.getPropertyValue("--vine-rotate"),
    })));
    invariant(active.every((branch) => branch.x && branch.x !== "0px"), `Some branches did not move: ${JSON.stringify(active)}`);
    invariant(new Set(active.map((branch) => branch.x)).size >= 5, `Branches move as one layer: ${JSON.stringify(active)}`);
    invariant(new Set(active.map((branch) => branch.rotate)).size >= 5, `Branches rotate as one layer: ${JSON.stringify(active)}`);

    await motionPage.locator("header").hover({ position: { x: 8, y: 8 } });
    await motionPage.waitForTimeout(40);
    const reset = await branches.evaluateAll((elements) => elements.map((element) => ({
      x: element.style.getPropertyValue("--vine-x"),
      y: element.style.getPropertyValue("--vine-y"),
      rotate: element.style.getPropertyValue("--vine-rotate"),
    })));
    invariant(reset.every((branch) => branch.x === "0px" && branch.y === "0px" && branch.rotate === "0deg"), `Branches did not reset: ${JSON.stringify(reset)}`);
    await motionPage.close();
  });

  await check("cursor speed controls the strength of the branch gust", async () => {
    const windPage = await browser.newPage({
      viewport: { width: 1685, height: 1000 },
      reducedMotion: "no-preference",
    });
    await settlePage(windPage);
    const group = windPage.locator("[data-vines-interactive]");
    await group.scrollIntoViewIfNeeded();
    const box = await group.boundingBox();
    invariant(box, "Interactive vines group is missing");

    const start = { x: box.x + box.width * 0.82, y: box.y + box.height * 0.42 };
    const end = { x: box.x + box.width * 0.52, y: box.y + box.height * 0.42 };
    const readStrength = () => windPage.locator("[data-vine-branch]").evaluateAll((elements) =>
      Math.max(...elements.map((element) => Math.abs(Number.parseFloat(element.style.getPropertyValue("--vine-x")) || 0))),
    );

    await windPage.mouse.move(start.x, start.y);
    await windPage.waitForTimeout(120);
    for (let step = 1; step <= 8; step += 1) {
      const progress = step / 8;
      await windPage.mouse.move(start.x + (end.x - start.x) * progress, start.y);
      await windPage.waitForTimeout(55);
    }
    await windPage.waitForTimeout(70);
    const slowStrength = await readStrength();

    await windPage.locator("header").hover({ position: { x: 8, y: 8 } });
    await windPage.waitForTimeout(700);
    await windPage.mouse.move(start.x, start.y);
    await windPage.waitForTimeout(120);
    await windPage.mouse.move(end.x, end.y);
    await windPage.waitForTimeout(70);
    const fastStrength = await readStrength();

    invariant(
      fastStrength > slowStrength * 1.35 + 1,
      `Fast cursor did not create a stronger gust: slow=${slowStrength.toFixed(2)}, fast=${fastStrength.toFixed(2)}`,
    );
    await windPage.close();
  });

  await check("reduced-motion keeps every hanging branch static", async () => {
    const section = desktop.locator("#product");
    const branches = desktop.locator("[data-vine-branch]");
    await section.scrollIntoViewIfNeeded();
    const before = await branches.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).transform));
    await section.hover({ position: { x: 240, y: 320 } });
    await desktop.waitForTimeout(100);
    const after = await branches.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).transform));
    invariant(before.length >= 8, `Expected reduced-motion branches, found ${before.length}`);
    invariant(JSON.stringify(after) === JSON.stringify(before), `Reduced-motion branches changed transform: ${JSON.stringify({ before, after })}`);
  });

  await check("desktop composition matches the PDF scale and surfaces", async () => {
    const metrics = await desktop.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top + scrollY, bottom: box.bottom + scrollY, width: box.width };
      };
      const color = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).backgroundColor : null;
      };
      const applicationWidths = [...document.querySelectorAll("#applications figure")].map((figure) => figure.getBoundingClientRect().width);
      const solutionCards = [...document.querySelectorAll("#product article")].map((article) => {
        const box = article.getBoundingClientRect();
        const style = getComputedStyle(article);
        const image = article.querySelector("[data-solution-image]")?.getBoundingClientRect();
        const icon = article.querySelector("[data-solution-icon]")?.getBoundingClientRect();
        const kicker = article.querySelector("[data-solution-kicker]")?.getBoundingClientRect();
        const title = article.querySelector("h3")?.getBoundingClientRect();
        return {
          left: box.left,
          width: box.width,
          height: box.height,
          padding: Number.parseFloat(style.paddingLeft),
          radius: Number.parseFloat(style.borderTopLeftRadius),
          imageWidth: image?.width ?? 0,
          imageHeight: image?.height ?? 0,
          iconWidth: icon?.width ?? 0,
          iconCenterY: icon ? icon.top + icon.height / 2 : 0,
          kickerCenterY: kicker ? kicker.top + kicker.height / 2 : 0,
          kickerHeight: kicker?.height ?? 0,
          kickerLineHeight: kicker ? Number.parseFloat(getComputedStyle(article.querySelector("[data-solution-kicker]")).lineHeight) : 0,
          titleHeight: title?.height ?? 0,
          titleLineHeight: title ? Number.parseFloat(getComputedStyle(article.querySelector("h3")).lineHeight) : 0,
        };
      });
      const rootImage = document.querySelector('[data-reference-visual="root-zone-scene"]');
      return {
        solutionGrid: rect("#product [data-solution-grid]"),
        solutionCards,
        rawPanel: rect("#fuscum > div"),
        benefitsSurface: rect('[data-reference-surface="benefits"]'),
        primaryBottom: rect("#advantages")?.bottom,
        applicationWidths,
        rootMask: rootImage ? getComputedStyle(rootImage).maskImage : "none",
        backgrounds: {
          living: color("#fuscum + section"),
          projects: color("#projects"),
          applications: color("#applications"),
          advantages: color("#advantages"),
          rootImage: (() => {
            const rootSection = document.querySelector("#fuscum + section + section");
            return rootSection ? getComputedStyle(rootSection).backgroundImage : "none";
          })(),
        },
      };
    });

    invariant(metrics.solutionGrid && metrics.solutionGrid.left >= 64 && metrics.solutionGrid.left <= 71 && metrics.solutionGrid.width >= 1545 && metrics.solutionGrid.width <= 1555, `Solutions grid does not match the source artwork: ${JSON.stringify(metrics.solutionGrid)}`);
    invariant(metrics.solutionCards.length === 2, `Expected 2 solution cards, found ${metrics.solutionCards.length}`);
    invariant(metrics.solutionCards.every((card) => card.width >= 750 && card.width <= 760 && card.height >= 555 && card.height <= 565), `Solution card geometry differs from the source artwork: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(Math.abs(metrics.solutionCards[0].height - metrics.solutionCards[1].height) <= 1, `Solution cards have unequal heights: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(Math.abs(metrics.solutionCards[1].left - (metrics.solutionCards[0].left + metrics.solutionCards[0].width) - 40) <= 1, `Solution card gutter is not 40px: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(metrics.solutionCards.every((card) => Math.abs(card.padding - 32) <= 1 && Math.abs(card.radius - 22) <= 1), `Solution card padding or radius differs from the source artwork: ${JSON.stringify(metrics.solutionCards)}`);
    // The original PDF strip spans 353 / 750 of a card; preserve that scale.
    invariant(metrics.solutionCards.every((card) => card.imageWidth / card.width >= 0.46 && card.imageWidth / card.width <= 0.48 && card.imageHeight / card.height >= 0.80), `Original solution artwork scale differs from the PDF: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(metrics.solutionCards.every((card) => card.iconWidth >= 62 && card.iconWidth <= 66 && Math.abs(card.iconCenterY - card.kickerCenterY) <= 2), `Solution icon and kicker are not aligned in one row: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(metrics.solutionCards.every((card) => card.kickerHeight <= card.kickerLineHeight * 1.2), `Solution kicker wraps unlike the source artwork: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(metrics.solutionCards.every((card) => card.titleHeight >= card.titleLineHeight * 1.9), `Solution titles do not preserve the source line breaks: ${JSON.stringify(metrics.solutionCards)}`);
    invariant(metrics.rawPanel && metrics.rawPanel.width >= 1540, `Raw-material panel is too narrow: ${metrics.rawPanel?.width}`);
    invariant(metrics.benefitsSurface && metrics.benefitsSurface.width >= 1680, `Benefits surface does not reach viewport edges: ${metrics.benefitsSurface?.width}`);
    invariant(metrics.primaryBottom >= 10_100 && metrics.primaryBottom <= 10_400, `Primary PDF flow ends at ${metrics.primaryBottom}px`);
    invariant(metrics.applicationWidths.every((width) => width >= 735), `Application images are too small: ${metrics.applicationWidths.map(Math.round).join(", ")}`);
    invariant(metrics.rootMask !== "none", "Root-zone scene has no softened top transition");
    invariant(metrics.backgrounds.living === "rgb(250, 250, 250)", `Living-wall surround is ${metrics.backgrounds.living}`);
    invariant(metrics.backgrounds.rootImage !== "none", "Root-zone background has no atmospheric depth");
    invariant(metrics.backgrounds.projects === "rgb(0, 11, 7)", `Portfolio background is ${metrics.backgrounds.projects}`);
    invariant(metrics.backgrounds.applications === "rgb(247, 244, 239)", `Applications background is ${metrics.backgrounds.applications}`);
    invariant(metrics.backgrounds.advantages === "rgb(15, 19, 20)", `Advantages background is ${metrics.backgrounds.advantages}`);
  });

  await check("primary desktop blocks share one 1550px grid", async () => {
    const selectors = [
      "#product > .pdf-grid",
      "#fuscum > .pdf-grid",
      "#fuscum + section > .pdf-grid",
      "#fuscum + section + section > .pdf-grid",
      '[data-reference-surface="benefits"] > .pdf-grid',
      "#projects > .pdf-grid",
      "#applications > .pdf-grid",
      "#advantages > .pdf-grid",
    ];
    const boxes = [];
    for (const selector of selectors) {
      const box = await desktop.locator(selector).boundingBox();
      invariant(box, `Missing grid block: ${selector}`);
      boxes.push({ selector, left: box.x, right: box.x + box.width, width: box.width });
    }

    const expectedLeft = 67.5;
    const expectedRight = 1617.5;
    const mismatches = boxes.filter(
      (box) => Math.abs(box.left - expectedLeft) > 2 || Math.abs(box.right - expectedRight) > 2 || Math.abs(box.width - 1550) > 2,
    );
    invariant(mismatches.length === 0, `Off-grid blocks: ${JSON.stringify(mismatches)}`);

    const figureBox = await desktop.locator("#fuscum + section figure").boundingBox();
    const imageBox = await desktop.locator("#fuscum + section figure img").boundingBox();
    invariant(figureBox && imageBox, "Living-wall figure or image is missing");
    invariant(
      imageBox.width > figureBox.width && imageBox.x >= 0 && imageBox.x + imageBox.width <= 1685,
      "Expanded living-wall artwork must fit inside the viewport",
    );
    invariant(await desktop.locator(".living-wall-frame").evaluate(el => getComputedStyle(el).overflow === "visible"), "Living-wall shadow is clipped by its frame");
  });

  await check("all page containers and typography share the reference system", async () => {
    const result = await desktop.evaluate(() => {
      const grids = [...document.querySelectorAll(".sph .pdf-grid, .sph .solutions-reference-grid")];
      const fonts = [...new Set([...document.querySelectorAll(".sph h1, .sph h2, .sph h3, .sph p, .sph button, .sph .label")].map(el => getComputedStyle(el).fontFamily))];
      return {
        count: grids.length,
        offGrid: grids.map(el => el.getBoundingClientRect()).filter(r => Math.abs(r.left - 67.5) > 2 || Math.abs(r.width - 1550) > 2).map(r => ({left: r.left, width: r.width})),
        fonts,
      };
    });
    invariant(result.count >= 15, `Not all page containers use the shared grid: ${result.count}`);
    invariant(result.offGrid.length === 0, `Misaligned page containers: ${JSON.stringify(result.offGrid)}`);
    invariant(result.fonts.length === 1 && result.fonts[0].includes("Arial"), `Mixed font families: ${result.fonts.join("; ")}`);
  });

  await check("all in-page navigation anchors resolve to unique targets", async () => {
    const invalid = await desktop.locator('a[href^="#"]').evaluateAll((anchors) => {
      return anchors.flatMap((anchor) => {
        const href = anchor.getAttribute("href") ?? "";
        const id = decodeURIComponent(href.slice(1));
        const matches = id ? document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length : 0;
        return matches === 1 ? [] : [`${href || "<empty>"} (${matches} targets)`];
      });
    });
    invariant(invalid.length === 0, `Invalid anchors: ${[...new Set(invalid)].join(", ")}`);
  });

  await check("applications are numbered 01, 02 and 03", async () => {
    const articles = desktop.locator("#applications article");
    invariant((await articles.count()) === 3, `Expected 3 application cards, found ${await articles.count()}`);

    const numbers = await articles.evaluateAll((nodes) =>
      nodes.map((node) =>
        [...node.querySelectorAll("span")]
          .map((span) => span.textContent?.trim())
          .find((text) => /^0[1-3]$/.test(text ?? "")),
      ),
    );
    invariant(JSON.stringify(numbers) === JSON.stringify(["01", "02", "03"]), `Found numbering: ${numbers.join(", ")}`);
  });

  await check("portfolio heading does not overlap the project rail at 1685px and 1280px", async () => {
    const viewports = [
      { label: "1685px", page: desktop },
      {
        label: "1280px",
        page: await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" }),
      },
    ];
    const overlaps = [];

    try {
      await settlePage(viewports[1].page);
      for (const viewport of viewports) {
        const headingTextRight = await viewport.page.locator("#projects h2").evaluate((heading) => {
          const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
          let right = Number.NEGATIVE_INFINITY;
          let textNode = walker.nextNode();
          while (textNode) {
            if (textNode.textContent?.trim()) {
              const range = document.createRange();
              range.selectNodeContents(textNode);
              right = Math.max(right, range.getBoundingClientRect().right);
            }
            textNode = walker.nextNode();
          }
          return right;
        });
        const railBox = await viewport.page.locator("#projects .hide-scrollbar").boundingBox();
        invariant(Number.isFinite(headingTextRight), `Portfolio heading text is not rendered at ${viewport.label}`);
        invariant(railBox, `Project rail is not rendered at ${viewport.label}`);

        const railLeft = railBox.x;
        const tolerance = 2;
        if (headingTextRight > railLeft + tolerance) {
          overlaps.push(
            `${viewport.label}: heading glyphs end at ${headingTextRight.toFixed(1)}px, rail starts at ${railLeft.toFixed(1)}px`,
          );
        }
      }
    } finally {
      await viewports[1].page.close();
    }
    invariant(overlaps.length === 0, `Portfolio overlap — ${overlaps.join("; ")}`);
  });

  await check("portfolio heading keeps the light reference weight", async () => {
    const weight = await desktop.locator("#projects h2").evaluate((heading) => Number.parseInt(getComputedStyle(heading).fontWeight, 10));
    invariant(weight <= 400, `Expected portfolio heading weight <= 400, found ${weight}`);
  });

  await check("project controls move the overflowing mobile rail forward and backward", async () => {
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    try {
      await settlePage(mobile);
      const rail = mobile.locator("#projects .hide-scrollbar");
      await rail.evaluate((element) => element.scrollTo({ left: 0, behavior: "instant" }));
      const initial = await rail.evaluate((element) => element.scrollLeft);

      await mobile.getByRole("button", { name: "Next projects" }).click();
      await mobile.waitForTimeout(900);
      const afterNext = await rail.evaluate((element) => element.scrollLeft);
      invariant(afterNext > initial, `Next did not increase scrollLeft at 390px (${initial} → ${afterNext})`);

      await mobile.getByRole("button", { name: "Previous projects" }).click();
      await mobile.waitForTimeout(900);
      const afterPrevious = await rail.evaluate((element) => element.scrollLeft);
      invariant(afterPrevious < afterNext, `Previous did not decrease scrollLeft at 390px (${afterNext} → ${afterPrevious})`);
    } finally {
      await mobile.close();
    }
  });

  await check("solution illustrations do not overlap mobile copy", async () => {
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    try {
      await settlePage(mobile);
      const cards = mobile.locator("#product article");
      invariant((await cards.count()) === 2, `Expected 2 solution cards, found ${await cards.count()}`);

      for (let index = 0; index < 2; index += 1) {
        const card = cards.nth(index);
        const cardBox = await card.boundingBox();
        const copyBox = await card.locator("[data-solution-copy]").boundingBox();
        const imageBox = await card.locator("[data-solution-image]").boundingBox();
        invariant(cardBox && copyBox && imageBox, `Solution ${index + 1} copy or illustration is not rendered`);
        invariant(
          imageBox.y >= copyBox.y + copyBox.height - 1,
          `Solution ${index + 1} illustration overlaps copy (${imageBox.y.toFixed(1)} < ${(copyBox.y + copyBox.height).toFixed(1)})`,
        );
        invariant(
          Math.abs(cardBox.x + cardBox.width - (imageBox.x + imageBox.width)) <= 2,
          `Solution ${index + 1} crop edge is not flush with the card edge`,
        );
      }
    } finally {
      await mobile.close();
    }
  });

  await desktop.close();

  for (const viewport of [
    { name: "reference", width: 1685, height: 1000 },
    { name: "tablet", width: 834, height: 1112 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await check(`${viewport.name} viewport has no horizontal overflow`, async () => {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
      });
      try {
        await settlePage(page);
        const overflow = await page.evaluate(() => {
          let worst = 0;
          for (let y = 0; y < document.body.scrollHeight; y += 450) {
            window.scrollTo(0, y);
            worst = Math.max(worst, document.documentElement.scrollWidth - document.documentElement.clientWidth);
          }
          return worst;
        });
        invariant(overflow <= 1, `Horizontal overflow is ${overflow}px`);
      } finally {
        await page.close();
      }
    });
  }

  await check("mobile menu opens, locks scroll, closes with Escape and follows an anchor", async () => {
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    try {
      await settlePage(mobile);
      const openButton = mobile.getByRole("button", { name: "Open menu" });
      await openButton.click();

      const closeButton = mobile.getByRole("button", { name: "Close menu" });
      await closeButton.waitFor({ state: "visible" });
      invariant((await mobile.locator('a[href^="#"]:visible').count()) > 1, "Mobile menu has no visible navigation links");
      invariant((await mobile.locator("body").evaluate((body) => body.style.overflow)) === "hidden", "Opening the menu did not lock body scroll");

      await mobile.keyboard.press("Escape");
      await closeButton.waitFor({ state: "hidden" });
      invariant((await mobile.locator("body").evaluate((body) => body.style.overflow)) !== "hidden", "Escape did not restore body scroll");

      await openButton.click();
      await mobile.locator('a[href="#applications"]:visible').click();
      await openButton.waitFor({ state: "visible" });
      invariant(new URL(mobile.url()).hash === "#applications", `Mobile anchor did not update the URL: ${mobile.url()}`);
    } finally {
      await mobile.close();
    }
  });
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\nLayout verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nLayout verification passed.");
}
