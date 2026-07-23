export type GeneratedImage = {
  id: string;
  prompt: string;
  model: string;
  size: string;
  path: string;
  created_at: number;
};

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
