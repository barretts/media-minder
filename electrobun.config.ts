import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "MediaMinder",
    identifier: "mediaminder.app",
    version: "1.0.0",
  },
  build: {
    bunVersion: "1.3.10",
    bun: {
      entrypoint: "src/bun/index.ts",
      external: ["playwright-core", "electron"],
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
