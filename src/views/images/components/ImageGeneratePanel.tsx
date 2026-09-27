import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";
import { IMAGE_SIZES } from "../types";

type Props = {
  busy: boolean;
  error: string;
  onGenerate: (prompt: string, profileId: string, size: string) => Promise<void>;
  onClearError: () => void;
};

type ModelProfile = {
  id: string;
  name: string;
  kind: string;
  model: string;
  enabled: boolean;
  modality?: string;
  capabilities?: Record<string, boolean> | null;
  tags?: string[];
};

const SIZE_HINT: Record<string, { ratio: string; label: string }> = {
  "1024x1024": { ratio: "1 / 1", label: "方形" },
  "1792x1024": { ratio: "16 / 9", label: "横图" },
  "1024x1792": { ratio: "9 / 16", label: "竖图" },
};

const PROFILE_KEY = "chatcms.images.gen-profile.v1";

/** 仅用途=图片的已启用档案 */
const pickImageProfiles = (list: ModelProfile[]) =>
  list.filter((p) => p.enabled && (p.modality || "chat") === "image");

const emitTopbarState = (busy: boolean, canGenerate: boolean) => {
  window.dispatchEvent(
    new CustomEvent("images-gen:topbar-state", {
      detail: { busy, canGenerate },
    }),
  );
};

export const ImageGeneratePanel = ({
  busy,
  error,
  onGenerate,
  onClearError,
}: Props) => {
  const [prompt, setPrompt] = useState("");
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [size, setSize] = useState<string>(IMAGE_SIZES[0].value);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const charCount = prompt.trim().length;
  const canGenerate = !!prompt.trim() && !!profileId && !busy;
  const sizeMeta = useMemo(
    () => SIZE_HINT[size] ?? SIZE_HINT["1024x1024"],
    [size],
  );

  const profileOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.model}${p.kind ? ` · ${p.kind}` : ""}`,
      })),
    [profiles],
  );

  const activeProfile = profiles.find((p) => p.id === profileId);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfiles(true);
    void invoke<ModelProfile[]>("model_profile_list")
      .then((list) => {
        if (cancelled) return;
        const next = pickImageProfiles(list);
        setProfiles(next);
        let preferred = "";
        try {
          preferred = localStorage.getItem(PROFILE_KEY) || "";
        } catch {
          /* ignore */
        }
        const hit = next.find((p) => p.id === preferred);
        setProfileId(hit?.id || next[0]?.id || "");
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingProfiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileId) return;
    try {
      localStorage.setItem(PROFILE_KEY, profileId);
    } catch {
      /* ignore */
    }
  }, [profileId]);

  const submitRef = useRef<() => Promise<void>>(async () => {});
  submitRef.current = async () => {
    const text = prompt.trim();
    if (!text || !profileId || busy) return;
    onClearError();
    await onGenerate(text, profileId, size);
  };

  useEffect(() => {
    emitTopbarState(busy, canGenerate);
    const onRequest = () => emitTopbarState(busy, canGenerate);
    const onGen = () => void submitRef.current();
    window.addEventListener("images-gen:topbar-request", onRequest);
    window.addEventListener("images-gen:generate", onGen);
    return () => {
      window.removeEventListener("images-gen:topbar-request", onRequest);
      window.removeEventListener("images-gen:generate", onGen);
    };
  }, [busy, canGenerate]);

  return (
    <div className="images-generate images-generate--page images-generate--studio">
      <div className="images-generate__section">
        <div className="images-generate__label-row">
          <label className="images-generate__label" htmlFor="image-gen-prompt">
            提示词
          </label>
          <span className="images-generate__count" aria-live="polite">
            {charCount > 0 ? `${charCount} 字` : "必填"}
          </span>
        </div>
        <textarea
          id="image-gen-prompt"
          className="images-generate__prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想生成的画面，例如：赛博朋克风格的城市夜景，霓虹灯倒映在雨后街道，电影感光影…"
          rows={8}
          disabled={busy}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submitRef.current();
            }
          }}
        />
        <p className="images-generate__hint">⌘/Ctrl + Enter 快速生成</p>
      </div>

      <div className="images-generate__section">
        <label className="images-generate__label">画面尺寸</label>
        <div className="images-generate__sizes" role="radiogroup" aria-label="图片尺寸">
          {IMAGE_SIZES.map((opt) => {
            const meta = SIZE_HINT[opt.value];
            const active = size === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`images-generate__size${active ? " is-active" : ""}`}
                disabled={busy}
                onClick={() => setSize(opt.value)}
              >
                <span
                  className="images-generate__size-preview"
                  style={{ aspectRatio: meta?.ratio ?? "1 / 1" }}
                  aria-hidden
                />
                <span className="images-generate__size-meta">
                  <span className="images-generate__size-name">
                    {meta?.label ?? opt.label}
                  </span>
                  <span className="images-generate__size-dim">{opt.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="images-generate__row images-generate__row--single">
        <div className="images-generate__field">
          <label className="images-generate__label">模型配置</label>
          {loadingProfiles ? (
            <p className="images-generate__hint">加载模型配置…</p>
          ) : profileOptions.length === 0 ? (
            <p className="images-generate__empty-profiles">
              暂无「图片」用途的模型配置。请到{" "}
              <Link to="/models">模型配置</Link>{" "}
              新增一条，用途选「图片生成」，model 填 dall-e-3 / gpt-image-1 等。
            </p>
          ) : (
            <Select
              aria-label="生图模型配置"
              value={profileId}
              options={profileOptions}
              onChange={setProfileId}
            />
          )}
        </div>
        <div className="images-generate__summary">
          <span className="images-generate__summary-label">当前</span>
          <span className="images-generate__summary-value">
            {activeProfile
              ? `${activeProfile.model} · ${sizeMeta.label}`
              : `${sizeMeta.label} · ${size.replace("x", " × ")}`}
          </span>
        </div>
      </div>

      {error ? <div className="images-generate__error">{error}</div> : null}
    </div>
  );
};
