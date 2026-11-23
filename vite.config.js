import { defineConfig } from 'vite';
import { joyBridge } from './hardware/joy-bridge.mjs';

export default defineConfig({
  base: './',
  plugins: [joyBridge()], // Bluetooth joystick bridge (dev server only)
});
