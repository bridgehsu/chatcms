export type MapLink = {
  id: string;
  title: string;
  desc: string;
  /** 图标色块文字，1–2 字 */
  mark: string;
  /** 可选外链；空则仅展示 */
  url?: string;
  tone?: "red" | "teal" | "amber" | "blue" | "violet" | "slate";
};

export type MapSection = {
  id: string;
  title: string;
  icon: string;
  locked: boolean;
  collapsed: boolean;
  links: MapLink[];
};

export type MapMetric = {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "flat";
};

export type MapDeadline = {
  id: string;
  label: string;
  days: number;
};

export type BusinessMapState = {
  favorites: MapLink[];
  sections: MapSection[];
  note: string;
  metrics: MapMetric[];
};
