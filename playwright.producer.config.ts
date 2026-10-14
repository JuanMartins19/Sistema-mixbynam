import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,testMatch:'producer.spec.ts',
  webServer:{
    command:'npm run dev -- --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100',reuseExistingServer:false,timeout:120000,
    env:{NEXT_PUBLIC_SUPABASE_URL:'https://mixbynam-test.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_TEST_ONLY',NEXT_TELEMETRY_DISABLED:'1',MIXBYNAM_E2E:'1'},
  },
});
