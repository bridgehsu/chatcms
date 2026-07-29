import { useState } from "react";
import { Select } from "@/components/Select";
import { IMAGE_MODELS, IMAGE_SIZES } from "../types";

type Props = {
  busy: boolean;
  error: string;
  onGenerate: (prompt: string, model: string, size: string) => Promise<void>;
  onClearError: () => void;
};

export const ImageGeneratePanel = ({ busy, error, onGenerate, onClearError }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(IMAGE_MODELS[0].value);
  const [size, setSize] = useState<string>(IMAGE_SIZES[0].value);

  const submit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    onClearError();
    await onGenerate(text, model, size);
  };

  return (
    <div className="images-generate images-generate--page">
      <label className="images-generate__label">提示词</label>
      <textarea
        className="images-generate__prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="描述你想生成的画面，例如：赛博朋克风格的城市夜景，霓虹灯倒映在雨后街道…"
        rows={6}
      />

      <div className="images-generate__row">
        <div className="images-generate__field">
          <label className="images-generate__label">模型</label>
          <Select
            aria-label="生图模型"
            value={model}
            options={[...IMAGE_MODELS]}
            onChange={setModel}
          />
        </div>
        <div className="images-generate__field">
          <label className="images-generate__label">尺寸</label>
          <Select
            aria-label="图片尺寸"
            value={size}
            options={[...IMAGE_SIZES]}
            onChange={setSize}
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
        {busy ? "生成中…" : "生成并保存"}
      </button>
    </div>
  );
};
