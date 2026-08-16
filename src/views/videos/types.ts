export type GeneratedVideo = {
  id: string;
  prompt: string;
  model: string;
  size: string;
  seconds: string;
  path: string;
  created: number;
  remote_id?: string | null;
  remark?: string;
  updated?: number;
};

export {
  mediaSourceOf,
  mediaSourceLabel,
  mediaUpdatedAt,
  type MediaSourceKind,
} from "../images/types";

export const VIDEO_MODELS = [
  { value: "sora-2", label: "Sora 2" },
  { value: "sora-2-pro", label: "Sora 2 Pro" },
] as const;

export const VIDEO_SIZES = [
  { value: "1280x720", label: "1280 × 720 横屏" },
  { value: "720x1280", label: "720 × 1280 竖屏" },
  { value: "1792x1024", label: "1792 × 1024" },
  { value: "1024x1792", label: "1024 × 1792" },
] as const;

export const VIDEO_SECONDS = [
  { value: "4", label: "4 秒" },
  { value: "8", label: "8 秒" },
  { value: "12", label: "12 秒" },
] as const;
