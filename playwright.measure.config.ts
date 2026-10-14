import { defineConfig } from '@playwright/test';
import base from './playwright.producer.config';
export default defineConfig({...base,testMatch:'measure.spec.ts',use:{...base.use,baseURL:'http://127.0.0.1:3102'},
  webServer:{command:'npm run start -- --hostname 127.0.0.1 --port 3102',url:'http://127.0.0.1:3102',reuseExistingServer:false,timeout:60000,env:{NEXT_TELEMETRY_DISABLED:'1'}},
});
