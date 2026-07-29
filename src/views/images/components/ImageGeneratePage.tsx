import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useImages } from "../hooks/useImages";
import { ImageGeneratePanel } from "./ImageGeneratePanel";

/** AI 生图独立页 */
export const ImageGeneratePage = () => {
  const navigate = useNavigate();
  const { busy, error, setError, generate } = useImages();
  const [doneHint, setDoneHint] = useState("");

  return (
    <div className="page page-scroll">
      <div className="model-panel media-gen-page">
        <Link className="media-gen-page__back" to="/images">
          ← 返回图片列表
        </Link>
        <header className="media-gen-page__head">
          <h2 className="media-gen-page__title">AI 生成图片</h2>
          <p className="media-gen-page__desc">
            使用当前模型配置中的 OpenAI 兼容接口生成，完成后自动写入图片列表
          </p>
        </header>

        <div className="media-gen-page__card">
          <ImageGeneratePanel
            busy={busy}
            error={error}
            onClearError={() => {
              setError("");
              setDoneHint("");
            }}
            onGenerate={async (prompt, model, size) => {
              setDoneHint("");
              await generate(prompt, model, size);
              setDoneHint("已生成并保存");
              navigate("/images");
            }}
          />
          {doneHint ? (
            <p className="media-gen-page__ok">{doneHint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
