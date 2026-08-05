export type MptConfig = {
  base_url: string;
};

export type MptFileItem = {
  name: string;
  size: number;
  file: string;
};

export type MptMaterialInfo = {
  provider: string;
  url: string;
  duration: number;
};

export type MptVideoParams = {
  video_subject: string;
  video_script: string;
  video_terms?: string[] | null;
  video_aspect: string;
  video_concat_mode: string;
  video_transition_mode?: string | null;
  video_clip_duration: number;
  video_count: number;
  video_source: string;
  video_materials?: MptMaterialInfo[] | null;
  custom_audio_file?: string | null;
  video_language: string;
  voice_name: string;
  voice_volume: number;
  voice_rate: number;
  bgm_type: string;
  bgm_file: string;
  bgm_volume: number;
  subtitle_enabled: boolean;
  subtitle_position: string;
  custom_position: number;
  font_name: string;
  text_fore_color: string;
  text_background_color: boolean | string;
  rounded_subtitle_background: boolean;
  font_size: number;
  stroke_color: string;
  stroke_width: number;
  paragraph_number: number;
  video_script_prompt: string;
  custom_system_prompt: string;
};

export type MptStudioConfig = {
  llm_provider?: string;
  llm_api_key?: string;
  llm_base_url?: string;
  llm_model_name?: string;
  llm_secret_key?: string;
  llm_account_id?: string;
  pexels_api_keys?: string[];
  pixabay_api_keys?: string[];
  coverr_api_keys?: string[];
  video_source?: string;
  video_codec?: string;
  tts_server?: string;
  voice_name?: string;
  font_name?: string;
  subtitle_position?: string;
  custom_position?: number;
  text_fore_color?: string;
  font_size?: number;
  subtitle_background_enabled?: boolean;
  subtitle_background_color?: string;
  rounded_subtitle_background?: boolean;
  azure_speech_region?: string;
  azure_speech_key?: string;
  siliconflow_api_key?: string;
  mimo_api_key?: string;
  hide_log?: boolean;
};

export type MptMetaOptions = {
  llm_providers: string[];
  tts_servers: { id: string; label: string }[];
  video_sources: { id: string; label: string }[];
  video_aspects: { id: string; label: string }[];
  concat_modes: { id: string; label: string }[];
  transition_modes: { id: string; label: string }[];
  video_codecs: { id: string; label: string }[];
  subtitle_positions: { id: string; label: string }[];
  bgm_types: { id: string; label: string }[];
  clip_durations: number[];
  video_counts: number[];
  voice_volumes: number[];
  voice_rates: number[];
  bgm_volumes: number[];
  script_languages: { id: string; label: string }[];
  fonts: string[];
};

export type MptVoiceItem = { id: string; label: string };

export type MptTaskStatus = {
  task_id: string;
  state: number;
  progress: number;
  videos: string[];
  message: string;
};

export const defaultMptParams = (): MptVideoParams => ({
  video_subject: "",
  video_script: "",
  video_terms: null,
  video_aspect: "9:16",
  video_concat_mode: "random",
  video_transition_mode: "",
  video_clip_duration: 5,
  video_count: 1,
  video_source: "pexels",
  video_materials: null,
  custom_audio_file: null,
  video_language: "",
  voice_name: "zh-CN-XiaoxiaoNeural-Female",
  voice_volume: 1.0,
  voice_rate: 1.0,
  bgm_type: "random",
  bgm_file: "",
  bgm_volume: 0.2,
  subtitle_enabled: true,
  subtitle_position: "bottom",
  custom_position: 70,
  font_name: "MicrosoftYaHeiBold.ttc",
  text_fore_color: "#FFFFFF",
  text_background_color: true,
  rounded_subtitle_background: false,
  font_size: 60,
  stroke_color: "#000000",
  stroke_width: 1.5,
  paragraph_number: 1,
  video_script_prompt: "",
  custom_system_prompt: "",
});

export const emptyStudioConfig = (): MptStudioConfig => ({
  llm_provider: "openai",
  llm_api_key: "",
  llm_base_url: "",
  llm_model_name: "",
  llm_secret_key: "",
  llm_account_id: "",
  pexels_api_keys: [],
  pixabay_api_keys: [],
  coverr_api_keys: [],
  video_source: "pexels",
  video_codec: "libx264",
  tts_server: "azure-tts-v1",
  voice_name: "",
  font_name: "",
  subtitle_position: "bottom",
  custom_position: 70,
  text_fore_color: "#FFFFFF",
  font_size: 60,
  subtitle_background_enabled: true,
  subtitle_background_color: "#000000",
  rounded_subtitle_background: false,
  azure_speech_region: "",
  azure_speech_key: "",
  siliconflow_api_key: "",
  mimo_api_key: "",
});

export const toSelectOptions = (
  items: { id: string; label: string }[] | undefined,
): { value: string; label: string }[] =>
  (items || []).map((i) => ({ value: i.id, label: i.label }));

export const numOptions = (nums: number[] | undefined, suffix = ""): { value: string; label: string }[] =>
  (nums || []).map((n) => ({ value: String(n), label: `${n}${suffix}` }));
