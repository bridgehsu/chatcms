export type GeneratedImage = {
  id: string;
  prompt: string;
  model: string;
  size: string;
  path: string;
  created_at: number;
  note?: string;
  updated_at?: number;
};

export type MediaSourceKind = "ai" | "upload" | "web";

export const mediaSourceOf = (model: string): MediaSourceKind => {
  if (model === "web_import") return "web";
  if (model === "local_upload") return "upload";
  return "ai";
};

export const mediaSourceLabel = (model: string): string => {
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
  created_at: number;
  updated_at?: number;
}): number => (item.updated_at && item.updated_at > 0 ? item.updated_at : item.created_at);

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
