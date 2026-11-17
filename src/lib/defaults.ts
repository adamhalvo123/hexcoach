import type { Settings, Theme } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  riotApiKey: "",
  riotKeyConfigured: false,
  riotKeySource: "none",
  riotId: "",
  region: "euw1",
  alwaysOnTop: true,
  demoMode: true,
  overlayOpacity: 0.97,
  performanceHud: true,
  autoImport: false,
  hudOverlay: true,
  theme: "dark",
  hotkeys: {
    toggleCompact: "Alt+X",
    toggleClickThrough: "Alt+Z",
    toggleVisibility: "Alt+H",
    toggleHud: "Alt+C",
  },
};

export const REGIONS = [
  { value: "euw1", label: "EU West" },
  { value: "eun1", label: "EU Nordic & East" },
  { value: "na1", label: "North America" },
  { value: "kr", label: "Korea" },
  { value: "br1", label: "Brazil" },
  { value: "la1", label: "Latin America North" },
  { value: "la2", label: "Latin America South" },
  { value: "oc1", label: "Oceania" },
  { value: "tr1", label: "Türkiye" },
  { value: "ru", label: "Russia" },
  { value: "jp1", label: "Japan" },
  { value: "sg2", label: "Singapore" },
];
