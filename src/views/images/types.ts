export type GeneratedImage = {
  id: string;
  prompt: string;
  model: string;
  size: string;
  path: string;
  created: number;
  remark?: string;
  updated?: number;
};

export type MediaSourceKind = "ai" | "upload" | "web";

export const mediaSourceOf = (model: string): MediaSourceKind => {
  if (model === "web_import") return "web";
  if (model === "local_upload") return "upload";
  return "ai";
};

export const mediaSourceLabel = (model: string): string => {
  if (model === "chatcms-video" || model === "moneyprinterturbo") return "口播";
  switch (mediaSourceOf(model)) {
    case "web":
      return "网页";
    case "upload":
      return "上传";
    default:
      return "AI";
  }
};

export const mediaUpdatedAt = (item: {
  created: number;
  updated?: number;
}): number => (item.updated && item.updated > 0 ? item.updated : item.created);

export const IMAGE_MODELS = [
  { value: "dall-e-3", label: "DALL·E 3" },
  { value: "dall-e-2", label: "DALL·E 2" },
  { value: "gpt-image-1", label: "GPT Image 1" },
] as const;

export const IMAGE_SIZES = [
  { value: "1024x1024", label: "1024 × 1024" },
  { value: "1792x1024", label: "1792 × 1024" },
  { value: "1024x1792", label: "1024 × 1792" },
] as const;
