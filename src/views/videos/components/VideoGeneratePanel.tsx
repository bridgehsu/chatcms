import { useState } from "react";
import { Select } from "@/components/Select";
import { VIDEO_MODELS, VIDEO_SECONDS, VIDEO_SIZES } from "../types";

type Props = {
  busy: boolean;
  error: string;
  onGenerate: (
    prompt: string,
    model: string,
    size: string,
    seconds: string,
  ) => Promise<void>;
  onClearError: () => void;
};

export const VideoGeneratePanel = ({ busy, error, onGenerate, onClearError }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(VIDEO_MODELS[0].value);
  const [size, setSize] = useState<string>(VIDEO_SIZES[0].value);
  const [seconds, setSeconds] = useState<string>(VIDEO_SECONDS[0].value);

  const submit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    onClearError();
    await onGenerate(text, model, size, seconds);
  };

  return (
    <div className="images-generate images-generate--page">
      <label className="images-generate__label">提示词</label>
      <textarea
        className="images-generate__prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="描述镜头与运动，例如：雨后街道的霓虹倒影，镜头缓慢推进，电影感光影…"
        rows={6}
      />

      <div className="videos-generate__row">
        <div className="images-generate__field">
          <label className="images-generate__label">模型</label>
          <Select
            aria-label="生视频模型"
            value={model}
            options={[...VIDEO_MODELS]}
            onChange={setModel}
          />
        </div>
        <div className="images-generate__field">
          <label className="images-generate__label">尺寸</label>
          <Select
            aria-label="视频尺寸"
            value={size}
            options={[...VIDEO_SIZES]}
            onChange={setSize}
          />
        </div>
        <div className="images-generate__field">
          <label className="images-generate__label">时长</label>
          <Select
            aria-label="视频时长"
            value={seconds}
            options={[...VIDEO_SECONDS]}
            onChange={setSeconds}
          />
        </div>
      </div>

      {error && <div className="images-generate__error">{error}</div>}

      <button
        type="button"
        className="btn-new-session images-generate__btn"
        disabled={busy || !prompt.trim()}
        onClick={() => void submit()}
      >
        {busy ? "生成中，请稍候…" : "生成并保存"}
      </button>
    </div>
  );
};
