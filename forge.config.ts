import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { PublisherS3 } from "@electron-forge/publisher-s3";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: [
      "./playwright-browsers",
      "./node_modules/playwright-core",
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "KolayRapor",
      setupExe: "KolayRapor-Setup.exe",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    new PublisherS3({
      bucket: process.env.S3_BUCKET || "kolay-rapor-releases",
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      folder: "releases/win32/x64",
      public: true,
      // R2 doesn't support ACLs — set omitAcl to true for Cloudflare R2
      // For AWS S3, set to false or remove
      omitAcl: true,
      // Prevent CDN/browser caching of the RELEASES manifest
      releaseFileCacheControlMaxAge: 0,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
