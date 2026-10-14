import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch:'form.spec.ts',
  fullyParallel: false,
  use: { baseURL:'http://127.0.0.1:3100', channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform==='win32'?'msedge':undefined), trace:'retain-on-failure' },
  webServer: {
    command:'npm run dev -- --hostname 127.0.0.1 --port 3100', url:'http://127.0.0.1:3100', reuseExistingServer:false, timeout:120000,
    env: {NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'',NEXT_TELEMETRY_DISABLED:'1',MIXBYNAM_E2E:'1'},
  },
});
