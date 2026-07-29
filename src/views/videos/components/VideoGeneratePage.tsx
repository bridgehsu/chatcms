import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVideos } from "../hooks/useVideos";
import { VideoGeneratePanel } from "./VideoGeneratePanel";

/** AI 生视频独立页 */
export const VideoGeneratePage = () => {
  const navigate = useNavigate();
  const { busy, error, setError, generate } = useVideos();
  const [doneHint, setDoneHint] = useState("");

  return (
    <div className="page page-scroll">
      <div className="model-panel media-gen-page">
        <Link className="media-gen-page__back" to="/videos">
          ← 返回视频列表
        </Link>
        <header className="media-gen-page__head">
          <h2 className="media-gen-page__title">AI 生成视频</h2>
          <p className="media-gen-page__desc">
            使用 OpenAI Videos 接口异步生成，可能需要数分钟；完成后自动写入视频列表
          </p>
        </header>

        <div className="media-gen-page__card">
          <VideoGeneratePanel
            busy={busy}
            error={error}
            onClearError={() => {
              setError("");
              setDoneHint("");
            }}
            onGenerate={async (prompt, model, size, seconds) => {
              setDoneHint("");
              await generate(prompt, model, size, seconds);
              setDoneHint("已生成并保存");
              navigate("/videos");
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
