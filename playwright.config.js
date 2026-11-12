import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  workers: 1, // la fausse caméra partagée rend la suite instable en parallèle
  webServer: { command: 'npx vite --port 5173', port: 5173, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
});
