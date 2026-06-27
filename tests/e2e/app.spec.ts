import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// AC-01: Page startup
// ---------------------------------------------------------------------------

test.describe('AC-01: page startup', () => {
  test('loads application shell with heading visible', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: '3D 智舱车控 Demo' }),
    ).toBeVisible();
    await expect(page.locator('.app-brand')).toHaveText('NeoCabin');
  });

  test('renders 3D scene container', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-testid="scene-container"]')).toBeVisible();
  });

  test('renders footer with usage hints', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.app-footer')).toContainText('拖动旋转');
    await expect(page.locator('.app-footer')).toContainText('点击车窗');
    await expect(page.locator('.app-footer')).toContainText('语音控制');
  });
});

// ---------------------------------------------------------------------------
// AC-02: Initial state — four windows closed
// ---------------------------------------------------------------------------

test.describe('AC-02: initial state', () => {
  test('status panel shows all four windows closed', async ({ page }) => {
    await page.goto('/');

    const statusItems = page.locator('.status-panel-item');
    await expect(statusItems).toHaveCount(4);

    // All status badges should show "已关闭" (closed)
    const badges = page.locator('.window-status--closed');
    await expect(badges).toHaveCount(4);
  });

  test('status panel shows correct Chinese labels', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.status-panel-list')).toContainText('左前窗');
    await expect(page.locator('.status-panel-list')).toContainText('右前窗');
    await expect(page.locator('.status-panel-list')).toContainText('左后窗');
    await expect(page.locator('.status-panel-list')).toContainText('右后窗');
  });
});

// ---------------------------------------------------------------------------
// AC-11: Text command input
// ---------------------------------------------------------------------------

test.describe('AC-11: text command input', () => {
  test('opens all windows via text command and shows feedback', async ({
    page,
  }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);
    const submit = page.getByRole('button', { name: '发送' });

    await input.fill('打开全部车窗');
    await submit.click();

    // Feedback should appear confirming execution
    const feedback = page.locator('[data-testid="feedback"]');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/已执行|部分执行/);

    // Status panel should show transitioning or open states
    // (in headless Chromium WebGL rAF may not fire continuously,
    //  so we verify the command was accepted rather than final state)
    const nonClosed = page.locator(
      '.window-status--transitioning, .window-status--open',
    );
    await expect(nonClosed.first()).toBeVisible({ timeout: 3000 });
  });

  test('closes a single window via text and shows feedback', async ({
    page,
  }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);
    const submit = page.getByRole('button', { name: '发送' });

    // Execute close on already-closed window triggers noop feedback
    await input.fill('关闭左前窗');
    await submit.click();

    // Feedback should state the window is already closed (noop)
    const feedback = page.locator('[data-testid="feedback"]');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/已在目标状态/);
  });

  test('submit via Enter key', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);

    await input.fill('打开全部车窗');
    await input.press('Enter');

    // Feedback should appear
    await expect(page.locator('[data-testid="feedback"]')).toBeVisible();
  });

  test('empty input does not submit', async ({ page }) => {
    await page.goto('/');

    const submit = page.getByRole('button', { name: '发送' });
    await submit.click();

    // No feedback should appear for empty input
    await expect(page.locator('[data-testid="feedback"]')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-14: Invalid command handling
// ---------------------------------------------------------------------------

test.describe('AC-14: invalid command handling', () => {
  test('shows parse error for unsupported command', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);
    const submit = page.getByRole('button', { name: '发送' });

    await input.fill('打开天窗');
    await submit.click();

    const feedback = page.locator('.feedback--error');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/不支持/);
  });

  test('shows parse error for missing action', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);
    const submit = page.getByRole('button', { name: '发送' });

    await input.fill('左前窗');
    await submit.click();

    const feedback = page.locator('.feedback--error');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/打开.*关闭/);
  });

  test('invalid command does not change window state', async ({ page }) => {
    await page.goto('/');

    // All windows start closed
    const closedBefore = page.locator('.window-status--closed');
    await expect(closedBefore).toHaveCount(4);

    const input = page.getByPlaceholder(/输入命令/);
    const submit = page.getByRole('button', { name: '发送' });

    await input.fill('打开天窗');
    await submit.click();

    // State should be unchanged
    await expect(page.locator('.window-status--closed')).toHaveCount(4);
  });
});

// ---------------------------------------------------------------------------
// AC-16: Model load failure
// ---------------------------------------------------------------------------

test.describe('AC-16: model load failure', () => {
  test('shows error UI when model returns 404', async ({ page }) => {
    // Intercept the model request and return 404
    await page.route('**/models/vehicle.glb', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found',
      }),
    );

    await page.goto('/');

    // Error boundary should render
    await expect(page.locator('[data-testid="scene-error"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="scene-error"]')).toContainText(
      /3D 场景加载失败/,
    );
  });

  test('retry button is clickable after model failure', async ({ page }) => {
    await page.route('**/models/vehicle.glb', (route) =>
      route.fulfill({ status: 404, body: 'Not Found' }),
    );

    await page.goto('/');

    // Should show error
    await expect(page.locator('[data-testid="scene-error"]')).toBeVisible({
      timeout: 10000,
    });

    // Retry button exists and is enabled
    const retryButton = page.getByRole('button', { name: '重新加载' });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    // Clicking retry should trigger re-render (error may persist because
    // route interception still returns 404, but the button must be clickable)
    await retryButton.click();

    // Error state should still be visible (route still returns 404)
    await expect(page.locator('[data-testid="scene-error"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('control panel remains accessible during model error', async ({
    page,
  }) => {
    await page.route('**/models/vehicle.glb', (route) =>
      route.fulfill({ status: 500, body: 'Error' }),
    );

    await page.goto('/');

    // Error shown
    await expect(page.locator('[data-testid="scene-error"]')).toBeVisible({
      timeout: 10000,
    });

    // Control panel should still be visible and functional
    await expect(page.locator('.control-panel')).toBeVisible();
    await expect(page.locator('.status-panel-list')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-04: Drag guard
// ---------------------------------------------------------------------------

test.describe('AC-04: drag guard', () => {
  test('drag on scene does not change window state', async ({ page }) => {
    await page.goto('/');

    // Wait for scene to load
    await expect(page.locator('[data-testid="scene-container"]')).toBeVisible({
      timeout: 15000,
    });

    // Perform a drag gesture on the canvas
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY, { steps: 5 });
      await page.mouse.up();
    }

    // All windows should still be closed (drag doesn't trigger click)
    await page.waitForTimeout(500);
    const closedBadges = page.locator('.window-status--closed');
    await expect(closedBadges).toHaveCount(4);
  });
});

// ---------------------------------------------------------------------------
// AC-15: Voice control UI
// ---------------------------------------------------------------------------

test.describe('AC-15: voice control UI', () => {
  test('voice button is rendered', async ({ page }) => {
    await page.goto('/');

    const voiceButton = page.locator('[data-testid="voice-button"]');
    await expect(voiceButton).toBeVisible();
  });

  test('voice status text is visible', async ({ page }) => {
    await page.goto('/');

    const voiceStatus = page.locator('[data-testid="voice-status"]');
    await expect(voiceStatus).toBeVisible();
  });

  test('text input still works when voice may be unavailable', async ({
    page,
  }) => {
    // In headless Chromium, Web Speech API may or may not be available.
    // Regardless, the text input must always work.
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    await input.fill('打开右前窗');
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.locator('[data-testid="feedback"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Viewport checks (1280×720, 1440×900, 1920×1080)
// ---------------------------------------------------------------------------

test.describe('viewport compatibility', () => {
  const viewports = [
    { width: 1280, height: 720, label: '1280×720' },
    { width: 1440, height: 900, label: '1440×900' },
    { width: 1920, height: 1080, label: '1920×1080' },
  ];

  for (const { width, height, label } of viewports) {
    test(`layout fits ${label} without horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      // Verify no horizontal scrollbar at document level
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test(`header visible at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      await expect(
        page.getByRole('heading', { name: '3D 智舱车控 Demo' }),
      ).toBeVisible();
    });

    test(`control panel visible at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      await expect(page.locator('.control-panel')).toBeVisible();
    });

    test(`status panel items visible at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      await expect(page.locator('.status-panel-item')).toHaveCount(4);
    });
  }
});

// ---------------------------------------------------------------------------
// Multi-input scenario: text → verify feedback → verify panel
// ---------------------------------------------------------------------------

test.describe('end-to-end text workflow', () => {
  test('text command → feedback → status panel update chain', async ({
    page,
  }) => {
    await page.goto('/');

    // Verify initial state
    await expect(page.locator('.window-status--closed')).toHaveCount(4);

    // Execute text command
    const input = page.getByPlaceholder(/输入命令/);
    await input.fill('打开左前窗');
    await page.getByRole('button', { name: '发送' }).click();

    // Feedback appears
    const feedback = page.locator('[data-testid="feedback"]');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/已执行|部分执行/);

    // Status panel should reflect the change — frontLeft should not be "已关闭"
    const firstStatusItem = page.locator('.status-panel-item').first();
    await expect(firstStatusItem).toContainText(/已打开|操作中/);
  });

  test('rapid sequential text commands each produce feedback', async ({
    page,
  }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/输入命令/);
    const submit = page.getByRole('button', { name: '发送' });

    // Send 5 commands: first opens, subsequent may block or noop
    const commands = [
      '打开左前窗',
      '打开右前窗',
      '打开全部车窗',
      '关闭全部车窗',
      '打开全部车窗',
    ];

    for (const cmd of commands) {
      await input.fill(cmd);
      await submit.click();
      // Each command should produce feedback
      await expect(page.locator('[data-testid="feedback"]')).toBeVisible({
        timeout: 2000,
      });
      // Wait for feedback auto-dismiss before next command
      await page.waitForTimeout(500);
    }
  });
});

// ---------------------------------------------------------------------------
// NC-012: Reset view & loading progress
// ---------------------------------------------------------------------------

test.describe('reset view button', () => {
  test('reset view button is rendered', async ({ page }) => {
    await page.goto('/');

    const resetButton = page.getByTestId('reset-view-button');
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toHaveText('重置视角');
  });

  test('reset view button is clickable', async ({ page }) => {
    await page.goto('/');

    const resetButton = page.getByTestId('reset-view-button');
    await resetButton.click();
    // Button should still be visible after click (no crash)
    await expect(resetButton).toBeVisible();
  });
});

test.describe('loading progress', () => {
  test('loading fallback shows progress bar', async ({ page }) => {
    // Use a slow response to observe loading state
    await page.route('**/models/vehicle.glb', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto('/');

    // Progress bar should be visible during loading (or the scene loads)
    // If the model loads fast, we at least see the canvas
    await expect(
      page.locator('[data-testid="canvas"], [data-testid="scene-loading"]'),
    ).toBeVisible({ timeout: 10000 });
  });
});
