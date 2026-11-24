import type { Hex } from "./color";

export type ColorPreset = {
  id: string;
  name: string;
  primary: Hex;
  secondary: Hex;
  accent: Hex;
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "hit-pink", name: "Hit pink", primary: "#ff5c9e", secondary: "#6ec6ff", accent: "#f5c451" },
  { id: "slider-sunset", name: "Slider sunset", primary: "#ff7a3d", secondary: "#ff3d7f", accent: "#ffd166" },
  { id: "mint-300", name: "Mint 300", primary: "#2ed59a", secondary: "#3d7bff", accent: "#c6f36b" },
  { id: "violet-hour", name: "Violet hour", primary: "#a07bff", secondary: "#58e1ff", accent: "#ff8ad8" },
  { id: "crimson", name: "Crimson", primary: "#e5383b", secondary: "#f2c14e", accent: "#ffffff" },
  { id: "glacier", name: "Glacier", primary: "#7fd6ee", secondary: "#3a5bd9", accent: "#e8f6ff" },
  { id: "pale-mono", name: "Pale mono", primary: "#e9e7ef", secondary: "#8a8796", accent: "#c9c6d3" },
  { id: "forest", name: "Forest", primary: "#9bd36a", secondary: "#2f6f5e", accent: "#f0e68c" },
];
