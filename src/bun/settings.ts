import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface AppSettings {
  movieDirectories: string[];
  namingConvention: "folder" | "filename";
  downloadPoster: boolean;
  downloadFanart: boolean;
  downloadActorThumbs: boolean;
  language: string;
}

const CONFIG_DIR = join(homedir(), ".mediaminder");
const CONFIG_FILE = join(CONFIG_DIR, "settings.json");

const DEFAULT_SETTINGS: AppSettings = {
  movieDirectories: ["G:\\movies"],
  namingConvention: "filename",
  downloadPoster: true,
  downloadFanart: true,
  downloadActorThumbs: false,
  language: "en-US",
};

export function loadSettings(): AppSettings {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save settings:", e);
    throw e;
  }
}
