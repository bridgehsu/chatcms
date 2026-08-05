import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Select } from "@/components/Select";
import {
  IconMptSubtitle,
  IconMptVisual,
  IconMptVoice,
  IconSettings,
} from "@/components/icons";
import { convertFileSrc, invoke } from "@/hooks/useTauri";
import type { GeneratedVideo } from "../types";
import {
  defaultMptParams,
  emptyStudioConfig,
  numOptions,
  toSelectOptions,
  type MptConfig,
  type MptFileItem,
  type MptMetaOptions,
  type MptStudioConfig,
  type MptTaskStatus,
  type MptVideoParams,
  type MptVoiceItem,
} from "../mptTypes";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const i = result.indexOf(",");
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const keysToText = (keys: string[] | undefined) => (keys || []).join("\n");

const textToKeys = (text: string) =>
  text
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

const PARAM_MENUS = [
  { id: "visual" as const, label: "画面", Icon: IconMptVisual },
  { id: "voice" as const, label: "配音", Icon: IconMptVoice },
  { id: "subtitle" as const, label: "字幕", Icon: IconMptSubtitle },
];

export const VideoStudioPage = () => {
  const cancelled = useRef(false);

  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:6060");
  const [params, setParams] = useState<MptVideoParams>(defaultMptParams);
  const [studio, setStudio] = useState<MptStudioConfig>(emptyStudioConfig);
  const [options, setOptions] = useState<MptMetaOptions | null>(null);
  const [voices, setVoices] = useState<MptVoiceItem[]>([]);
  const [bgmList, setBgmList] = useState<MptFileItem[]>([]);
  const [materials, setMaterials] = useState<MptFileItem[]>([]);
  const [termsText, setTermsText] = useState("");
  const [pexelsText, setPexelsText] = useState("");
  const [pixabayText, setPixabayText] = useState("");
  const [coverrText, setCoverrText] = useState("");
  const [newKeyKind, setNewKeyKind] = useState<"pexels" | "pixabay" | "coverr">("pexels");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [subtitleBgEnabled, setSubtitleBgEnabled] = useState(true);
  const [subtitleBgColor, setSubtitleBgColor] = useState("#000000");

  const [busy, setBusy] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [termsBusy, setTermsBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [healthOk, setHealthOk] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paramPanel, setParamPanel] = useState<
    null | "visual" | "voice" | "subtitle"
  >(null);
  const [results, setResults] = useState<GeneratedVideo[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const publishHealth = useCallback((ok: string) => {
    setHealthOk(ok);
    window.dispatchEvent(
      new CustomEvent("mpt:health", { detail: { ok } }),
    );
  }, []);

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("mpt:open-settings", openSettings);
    return () => {
      window.removeEventListener("mpt:open-settings", openSettings);
      window.dispatchEvent(
        new CustomEvent("mpt:health", { detail: { ok: "" } }),
      );
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen && !paramPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (paramPanel) setParamPanel(null);
      else setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, paramPanel]);

  const patch = useCallback((partial: Partial<MptVideoParams>) => {
    setParams((p) => ({ ...p, ...partial }));
  }, []);

  const patchStudio = useCallback((partial: Partial<MptStudioConfig>) => {
    setStudio((s) => ({ ...s, ...partial }));
  }, []);

  const applyStudio = useCallback((cfg: MptStudioConfig) => {
    setStudio({ ...emptyStudioConfig(), ...cfg });
    setPexelsText(keysToText(cfg.pexels_api_keys));
    setPixabayText(keysToText(cfg.pixabay_api_keys));
    setCoverrText(keysToText(cfg.coverr_api_keys));
    setSubtitleBgEnabled(cfg.subtitle_background_enabled !== false);
    setSubtitleBgColor(cfg.subtitle_background_color || "#000000");
    setParams((p) => ({
      ...p,
      video_source: cfg.video_source || p.video_source,
      voice_name: cfg.voice_name || p.voice_name,
      font_name: cfg.font_name || p.font_name,
      subtitle_position: cfg.subtitle_position || p.subtitle_position,
      custom_position: cfg.custom_position ?? p.custom_position,
      text_fore_color: cfg.text_fore_color || p.text_fore_color,
      font_size: cfg.font_size ?? p.font_size,
      rounded_subtitle_background: !!cfg.rounded_subtitle_background,
      text_background_color:
        cfg.subtitle_background_enabled === false
          ? false
          : cfg.subtitle_background_color || true,
    }));
  }, []);

  const loadVoices = useCallback(async (ttsServer: string, currentVoice?: string) => {
    const data = await invoke<{ voices: MptVoiceItem[] }>("mpt_meta_voices", {
      ttsServer,
    });
    const list = data?.voices || [];
    setVoices(list);
    const voice = currentVoice ?? "";
    if (list.length && voice && !list.some((v) => v.id === voice)) {
      patch({ voice_name: list[0].id });
    } else if (list.length && !voice) {
      patch({ voice_name: list[0].id });
    }
  }, [patch]);

  const refreshAssets = useCallback(async () => {
    try {
      const [bgm, mats] = await Promise.all([
        invoke<MptFileItem[]>("mpt_list_bgm"),
        invoke<MptFileItem[]>("mpt_list_materials"),
      ]);
      setBgmList(bgm || []);
      setMaterials(mats || []);
    } catch {
      /* optional until connected */
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    const run = async () => {
      setError("");
      try {
        const cfg = await invoke<MptConfig>("mpt_config_get");
        if (cfg?.base_url) setBaseUrl(cfg.base_url);
        const opts = await invoke<MptMetaOptions>("mpt_meta_options");
        setOptions(opts);
        const studioCfg = await invoke<MptStudioConfig>("mpt_studio_config_get");
        applyStudio(studioCfg || emptyStudioConfig());
        const tts = studioCfg?.tts_server || "azure-tts-v1";
        await loadVoices(tts, studioCfg?.voice_name || "");
        await refreshAssets();
        publishHealth(cfg?.base_url || "ok");
      } catch (e) {
        publishHealth("");
        setError(String(e));
      }
    };
    void run();
    return () => {
      cancelled.current = true;
    };
  }, [applyStudio, loadVoices, publishHealth, refreshAssets]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const saveBaseUrl = async () => {
    setError("");
    try {
      const cfg = await invoke<MptConfig>("mpt_config_set", { baseUrl });
      setBaseUrl(cfg.base_url);
      const ok = await invoke<string>("mpt_health");
      publishHealth(ok);
      setStatusText(`已连接 ${ok}`);
      const opts = await invoke<MptMetaOptions>("mpt_meta_options");
      setOptions(opts);
      const studioCfg = await invoke<MptStudioConfig>("mpt_studio_config_get");
      applyStudio(studioCfg || emptyStudioConfig());
      await loadVoices(studioCfg?.tts_server || "azure-tts-v1", studioCfg?.voice_name);
      await refreshAssets();
    } catch (e) {
      publishHealth("");
      setError(String(e));
    }
  };

  const buildStudioPayload = (): MptStudioConfig => ({
    ...studio,
    pexels_api_keys: textToKeys(pexelsText),
    pixabay_api_keys: textToKeys(pixabayText),
    coverr_api_keys: textToKeys(coverrText),
    video_source: params.video_source,
    tts_server: studio.tts_server,
    voice_name: params.voice_name,
    font_name: params.font_name,
    subtitle_position: params.subtitle_position,
    custom_position: params.custom_position,
    text_fore_color: params.text_fore_color,
    font_size: params.font_size,
    subtitle_background_enabled: subtitleBgEnabled,
    subtitle_background_color: subtitleBgColor,
    rounded_subtitle_background: params.rounded_subtitle_background,
  });

  const saveStudioConfig = async () => {
    const payload = buildStudioPayload();
    const saved = await invoke<MptStudioConfig>("mpt_studio_config_set", {
      config: payload,
    });
    applyStudio(saved || payload);
    return saved || payload;
  };

  const onGenerateScript = async () => {
    if (!params.video_subject.trim()) {
      setError("请先填写视频主题");
      return;
    }
    setScriptBusy(true);
    setError("");
    try {
      const script = await invoke<string>("mpt_generate_script", {
        videoSubject: params.video_subject,
        videoLanguage: params.video_language,
        paragraphNumber: params.paragraph_number,
        videoScriptPrompt: params.video_script_prompt,
        customSystemPrompt: params.custom_system_prompt,
      });
      patch({ video_script: script });
      setStatusText("文案已生成");
      try {
        const terms = await invoke<string[]>("mpt_generate_terms", {
          videoSubject: params.video_subject,
          videoScript: script,
          amount: 5,
        });
        setTermsText(terms.join(", "));
      } catch {
        /* terms optional after script */
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setScriptBusy(false);
    }
  };

  const onGenerateTerms = async () => {
    if (!params.video_script.trim() && !params.video_subject.trim()) {
      setError("请先填写主题或文案");
      return;
    }
    setTermsBusy(true);
    setError("");
    try {
      const terms = await invoke<string[]>("mpt_generate_terms", {
        videoSubject: params.video_subject,
        videoScript: params.video_script,
        amount: 5,
      });
      setTermsText(terms.join(", "));
      setStatusText("关键词已生成");
    } catch (e) {
      setError(String(e));
    } finally {
      setTermsBusy(false);
    }
  };

  const onVoicePreview = async () => {
    setError("");
    try {
      const b64 = await invoke<string>("mpt_voice_preview", {
        text: params.video_script.slice(0, 80) || "这是一段试听示例。",
        voiceName: params.voice_name,
        voiceRate: params.voice_rate,
        voiceVolume: params.voice_volume,
      });
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (e) {
      setError(String(e));
    }
  };

  const uploadMany = async (
    files: FileList | null,
    cmd: "mpt_upload_material" | "mpt_upload_bgm" | "mpt_upload_custom_audio",
  ) => {
    if (!files?.length) return;
    setError("");
    try {
      let last = "";
      for (const file of Array.from(files)) {
        const dataBase64 = await fileToBase64(file);
        last = await invoke<string>(cmd, {
          dataBase64,
          filename: file.name,
        });
      }
      if (cmd === "mpt_upload_custom_audio" && last) {
        patch({ custom_audio_file: last });
        setStatusText(`已上传旁白：${last}`);
      } else if (cmd === "mpt_upload_bgm" && last) {
        patch({ bgm_file: last, bgm_type: "custom" });
        setStatusText(`已上传 BGM：${last}`);
      } else {
        setStatusText("素材已上传");
      }
      await refreshAssets();
    } catch (e) {
      setError(String(e));
    }
  };

  const addApiKey = () => {
    const v = newKeyValue.trim();
    if (!v) return;
    if (newKeyKind === "pexels") setPexelsText((t) => (t ? `${t}\n${v}` : v));
    if (newKeyKind === "pixabay") setPixabayText((t) => (t ? `${t}\n${v}` : v));
    if (newKeyKind === "coverr") setCoverrText((t) => (t ? `${t}\n${v}` : v));
    setNewKeyValue("");
  };

  const removeKeyLine = (kind: "pexels" | "pixabay" | "coverr", key: string) => {
    const filter = (text: string) =>
      textToKeys(text)
        .filter((k) => k !== key)
        .join("\n");
    if (kind === "pexels") setPexelsText(filter);
    if (kind === "pixabay") setPixabayText(filter);
    if (kind === "coverr") setCoverrText(filter);
  };

  const onGenerate = async () => {
    cancelled.current = false;
    setBusy(true);
    setError("");
    setProgress(0);
    setTaskId("");
    setStatusText("保存配置…");
    try {
      await invoke("mpt_config_set", { baseUrl });
      await saveStudioConfig();

      const terms = textToKeys(termsText.replace(/，/g, ","));
      const textBg: boolean | string = subtitleBgEnabled
        ? subtitleBgColor || true
        : false;

      const payload: MptVideoParams = {
        ...params,
        video_terms: terms.length ? terms : null,
        video_transition_mode: params.video_transition_mode || null,
        text_background_color: textBg,
        video_materials:
          params.video_source === "local"
            ? materials.map((m) => ({
                provider: "local",
                url: m.file,
                duration: 0,
              }))
            : null,
      };

      setStatusText("创建任务…");
      const tid = await invoke<string>("mpt_create_video", { params: payload });
      setTaskId(tid);
      setStatusText(`任务 ${tid} 处理中…`);

      let videos: string[] = [];
      for (;;) {
        if (cancelled.current) {
          setStatusText("已取消轮询（远端任务可能仍在运行）");
          break;
        }
        const st = await invoke<MptTaskStatus>("mpt_get_task", { taskId: tid });
        setProgress(st.progress || 0);
        if (st.state === -1) {
          throw new Error(st.message || "任务失败");
        }
        if (st.state === 1) {
          videos = st.videos || [];
          break;
        }
        setStatusText(`处理中 ${st.progress || 0}%…`);
        await sleep(2000);
      }

      if (cancelled.current) return;
      if (!videos.length) throw new Error("任务完成但没有成片");

      setStatusText(`导入成片 0/${videos.length}…`);
      const titleBase =
        params.video_subject.trim() || params.video_script.slice(0, 40) || "成片";
      const imported: GeneratedVideo[] = [];
      for (let i = 0; i < videos.length; i++) {
        if (cancelled.current) break;
        setStatusText(`导入成片 ${i + 1}/${videos.length}…`);
        const item = await invoke<GeneratedVideo>("mpt_import_video", {
          videoUrl: videos[i],
          title:
            videos.length > 1 ? `${titleBase} #${i + 1}` : titleBase,
          taskId: tid,
        });
        imported.push(item);
      }
      if (!imported.length) throw new Error("成片导入失败");

      setResults((prev) => [...imported, ...prev]);
      setSelectedId(imported[0].id);
      setStatusText(`完成，已入库 ${imported.length} 条`);
    } catch (e) {
      setError(String(e));
      setStatusText("");
    } finally {
      setBusy(false);
    }
  };

  const srcFor = useCallback((path: string) => {
    try {
      return convertFileSrc(path);
    } catch {
      return "";
    }
  }, []);

  const selected = useMemo(
    () => results.find((v) => v.id === selectedId) || results[0] || null,
    [results, selectedId],
  );

  const isPortrait = (params.video_aspect || "9:16") === "9:16";

  const anyBusy = busy || scriptBusy || termsBusy;
  const tts = studio.tts_server || "azure-tts-v1";
  const showAzure = tts.startsWith("azure");
  const showSilicon = tts === "siliconflow";
  const showMimo = tts === "mimo-tts";

  const voiceOpts = voices.map((v) => ({ value: v.id, label: v.label }));
  const fontOpts = (options?.fonts || []).map((f) => ({ value: f, label: f }));
  const bgmOpts = [
    { value: "", label: "（默认/随机）" },
    ...bgmList.map((b) => ({ value: b.file, label: b.name })),
  ];

  const scriptChars = params.video_script.trim().length;
  const canGenerate =
    !anyBusy &&
    (!!params.video_subject.trim() || !!params.video_script.trim());

  return (
    <>
    <div className="page mpt-page">
      <div className="mpt-shell">
        <div className="mpt-workspace">
          <section className="mpt-main" aria-label="文案编辑">
            <div className="mpt-main__bar">
              <div className="mpt-main__bar-left">
                <span className="mpt-step">1</span>
                <div className="mpt-main__heading">
                  <h3 className="mpt-panel__title">文案</h3>
                  <p className="mpt-panel__hint">主题与口播，决定成片节奏</p>
                </div>
              </div>
              <div className="mpt-studio__actions">
                <button
                  type="button"
                  className="btn-mcp-action"
                  disabled={anyBusy || !params.video_subject.trim()}
                  onClick={() => void onGenerateScript()}
                >
                  {scriptBusy ? "生成中…" : "AI 生成文案"}
                </button>
                <button
                  type="button"
                  className="btn-mcp-action"
                  disabled={anyBusy}
                  onClick={() => void onGenerateTerms()}
                >
                  {termsBusy ? "生成中…" : "关键词"}
                </button>
              </div>
            </div>

            <div className="mpt-main__toolbar">
              <div className="mpt-studio__field mpt-studio__field--grow">
                <label className="images-generate__label">视频主题</label>
                <input
                  className="mpt-studio__input"
                  value={params.video_subject}
                  disabled={busy}
                  onChange={(e) => patch({ video_subject: e.target.value })}
                  placeholder="例如：三分钟整理桌面"
                />
              </div>
              <div className="mpt-studio__field mpt-studio__field--sm">
                <label className="images-generate__label">语言</label>
                <Select
                  aria-label="语言"
                  value={params.video_language}
                  options={toSelectOptions(options?.script_languages)}
                  onChange={(v) => patch({ video_language: v })}
                />
              </div>
              <div className="mpt-studio__field mpt-studio__field--sm">
                <label className="images-generate__label">段落</label>
                <Select
                  aria-label="段落数"
                  value={String(params.paragraph_number)}
                  options={[1, 2, 3, 4, 5].map((n) => ({
                    value: String(n),
                    label: String(n),
                  }))}
                  onChange={(v) => patch({ paragraph_number: Number(v) })}
                />
              </div>
            </div>

            <div className="mpt-studio__field mpt-main__script">
              <div className="mpt-main__script-label">
                <label className="images-generate__label">口播文案</label>
                <span className="mpt-panel__meta">{scriptChars} 字</span>
              </div>
              <textarea
                className="mpt-studio__textarea mpt-studio__textarea--script"
                value={params.video_script}
                disabled={busy}
                onChange={(e) => patch({ video_script: e.target.value })}
                placeholder="粘贴或编写口播文案；也可先填主题，再点 AI 生成文案"
              />
            </div>

            <div className="mpt-main__footer">
              <div className="mpt-studio__field">
                <label className="images-generate__label">素材关键词</label>
                <textarea
                  className="mpt-studio__textarea mpt-studio__textarea--terms"
                  rows={2}
                  value={termsText}
                  disabled={busy}
                  onChange={(e) => setTermsText(e.target.value)}
                  placeholder="逗号分隔，建议具体可拍画面，如 clean desk, office"
                />
              </div>
              <div className="mpt-main__advanced">
                <p className="mpt-section-label">高级提示词</p>
                <div className="mpt-studio__field">
                  <label className="images-generate__label">Script Prompt</label>
                  <textarea
                    className="mpt-studio__textarea mpt-studio__textarea--sm"
                    rows={2}
                    value={params.video_script_prompt}
                    onChange={(e) =>
                      patch({ video_script_prompt: e.target.value })
                    }
                  />
                </div>
                <div className="mpt-studio__field">
                  <label className="images-generate__label">
                    Custom System Prompt
                  </label>
                  <textarea
                    className="mpt-studio__textarea mpt-studio__textarea--sm"
                    rows={3}
                    value={params.custom_system_prompt}
                    onChange={(e) =>
                      patch({ custom_system_prompt: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mpt-results" aria-label="成片预览">
            <div className="mpt-results__bar">
              <div className="mpt-results__title">
                <span>成片预览</span>
                <span className="mpt-panel__meta">
                  {results.length
                    ? `${results.length} 条`
                    : busy
                      ? "生成中…"
                      : "生成后显示"}
                </span>
              </div>
              <div className="mpt-results__bar-actions">
                {results.length > 0 ? (
                  <button
                    type="button"
                    className="btn-mcp-remove"
                    onClick={() => {
                      setResults([]);
                      setSelectedId("");
                    }}
                  >
                    清空
                  </button>
                ) : null}
                <Link className="mpt-results__link" to="/videos">
                  视频管理
                </Link>
              </div>
            </div>
            {selected?.prompt ? (
              <p className="mpt-results__current" title={selected.prompt}>
                {selected.prompt}
              </p>
            ) : null}

            <div className="mpt-results__body">
              <div
                className={
                  isPortrait
                    ? "mpt-results__hero mpt-results__hero--portrait"
                    : "mpt-results__hero mpt-results__hero--landscape"
                }
              >
                {selected ? (
                  <video
                    key={selected.id}
                    className="mpt-results__video"
                    src={srcFor(selected.path)}
                    controls
                    playsInline
                  />
                ) : busy ? (
                  <div className="mpt-results__empty">
                    <div className="mpt-studio__progress mpt-results__progress">
                      <div
                        className="mpt-studio__progress-bar"
                        style={{
                          width: `${Math.min(100, Math.max(progress, 4))}%`,
                        }}
                      />
                    </div>
                    <p className="mpt-results__empty-title">
                      正在生成 {Math.round(progress)}%
                    </p>
                  </div>
                ) : (
                  <div className="mpt-results__empty">
                    <p className="mpt-results__empty-title">还没有成片</p>
                    <p className="mpt-results__empty-hint">
                      生成完成后会在此播放
                    </p>
                  </div>
                )}
              </div>

              <div className="mpt-results__rail" role="list">
                {busy && !results.length
                  ? Array.from({
                      length: Math.max(1, params.video_count || 1),
                    }).map((_, i) => (
                      <div
                        key={`sk-${i}`}
                        className={
                          isPortrait
                            ? "mpt-results__card mpt-results__card--skeleton mpt-results__card--portrait"
                            : "mpt-results__card mpt-results__card--skeleton mpt-results__card--landscape"
                        }
                        role="listitem"
                      >
                        <span>#{i + 1}</span>
                      </div>
                    ))
                  : null}
                {!busy && !results.length ? (
                  <div className="mpt-results__rail-empty" role="listitem">
                    多条成片将排列在这里
                  </div>
                ) : null}
                {results.map((item, index) => {
                  const active = (selected?.id || "") === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="listitem"
                      className={[
                        "mpt-results__card",
                        isPortrait
                          ? "mpt-results__card--portrait"
                          : "mpt-results__card--landscape",
                        active ? "mpt-results__card--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <video
                        className="mpt-results__thumb"
                        src={srcFor(item.path)}
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <span className="mpt-results__badge">#{index + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <footer className="mpt-dock">
          <div className="mpt-dock__meta">
            {error ? (
              <div className="images-generate__error">{error}</div>
            ) : (
              <p className="mpt-dock__summary">
                <span className="mpt-dock__chip">
                  {params.video_aspect || "9:16"}
                </span>
                <span className="mpt-dock__chip">
                  {params.video_source || "pexels"}
                </span>
                <span className="mpt-dock__chip">
                  {params.voice_name
                    ? params.voice_name.replace(/-Female|-Male$/g, "")
                    : "未选音色"}
                </span>
                {scriptChars ? (
                  <span className="mpt-dock__chip">{scriptChars} 字</span>
                ) : null}
              </p>
            )}
            {statusText ? (
              <p className="mpt-studio__status">{statusText}</p>
            ) : null}
            {taskId ? (
              <p className="mpt-studio__hint">Task {taskId.slice(0, 8)}</p>
            ) : null}
            {busy ? (
              <div className="mpt-studio__progress">
                <div
                  className="mpt-studio__progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(progress, 4))}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="mpt-dock__actions">
            {busy ? (
              <button
                type="button"
                className="btn-mcp-remove"
                onClick={() => {
                  cancelled.current = true;
                }}
              >
                取消
              </button>
            ) : null}
            <button
              type="button"
              className="btn-new-session images-generate__btn mpt-dock__cta"
              disabled={!canGenerate}
              onClick={() => void onGenerate()}
            >
              {busy ? `生成中 ${Math.round(progress)}%` : "生成视频并入库"}
            </button>
          </div>
        </footer>
      </div>

      <aside className="mpt-rail" aria-label="成片参数菜单">
        <div className="mpt-rail__top">
          <button
            type="button"
            className={
              settingsOpen
                ? "mpt-rail__item mpt-rail__item--active"
                : "mpt-rail__item"
            }
            aria-label="设置"
            aria-pressed={settingsOpen}
            onClick={() => {
              setParamPanel(null);
              setSettingsOpen((v) => !v);
            }}
          >
            <span className="mpt-rail__icon" aria-hidden="true">
              <IconSettings />
            </span>
            <span className="mpt-rail__tooltip">设置</span>
          </button>
        </div>
        <div className="mpt-rail__menu">
          {PARAM_MENUS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={
                paramPanel === id
                  ? "mpt-rail__item mpt-rail__item--active"
                  : "mpt-rail__item"
              }
              aria-label={label}
              aria-pressed={paramPanel === id}
              onClick={() => {
                setSettingsOpen(false);
                setParamPanel((cur) => (cur === id ? null : id));
              }}
            >
              <span className="mpt-rail__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="mpt-rail__tooltip">{label}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>

      {paramPanel ? (
        <div
          className="modal-overlay"
          onClick={() => setParamPanel(null)}
        >
          <div
            className="model-modal mpt-param-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpt-param-title"
          >
            <div className="model-modal__header">
              <h2 id="mpt-param-title" className="model-modal__title">
                {
                  PARAM_MENUS.find((m) => m.id === paramPanel)?.label ||
                  "参数"
                }
              </h2>
              <button
                type="button"
                className="model-modal__close"
                onClick={() => setParamPanel(null)}
              >
                ×
              </button>
            </div>
            <div className="model-modal__body mpt-param-modal__body">
              {paramPanel === "visual" ? (
                <div className="mpt-col__body">
                  <p className="mpt-panel__hint">
                    编码 {studio.video_codec || "libx264"} · 决定画面来源与节奏
                  </p>
                  <div className="mpt-grid mpt-grid--2">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">素材来源</label>
                      <Select
                        aria-label="素材来源"
                        value={params.video_source}
                        options={toSelectOptions(options?.video_sources)}
                        onChange={(v) => patch({ video_source: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">比例</label>
                      <Select
                        aria-label="比例"
                        value={params.video_aspect}
                        options={toSelectOptions(options?.video_aspects)}
                        onChange={(v) => patch({ video_aspect: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">拼接</label>
                      <Select
                        aria-label="拼接模式"
                        value={params.video_concat_mode}
                        options={toSelectOptions(options?.concat_modes)}
                        onChange={(v) => patch({ video_concat_mode: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">转场</label>
                      <Select
                        aria-label="转场"
                        value={params.video_transition_mode || ""}
                        options={toSelectOptions(options?.transition_modes)}
                        onChange={(v) => patch({ video_transition_mode: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">片段时长</label>
                      <Select
                        aria-label="片段时长"
                        value={String(params.video_clip_duration)}
                        options={numOptions(options?.clip_durations, "s")}
                        onChange={(v) =>
                          patch({ video_clip_duration: Number(v) })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">生成数量</label>
                      <Select
                        aria-label="生成数量"
                        value={String(params.video_count)}
                        options={numOptions(options?.video_counts)}
                        onChange={(v) => patch({ video_count: Number(v) })}
                      />
                    </div>
                  </div>
                  {params.video_source === "local" ? (
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">
                        本地素材（{materials.length}）
                      </label>
                      <input
                        type="file"
                        multiple
                        accept="video/*,image/*"
                        disabled={busy}
                        onChange={(e) =>
                          void uploadMany(
                            e.target.files,
                            "mpt_upload_material",
                          ).finally(() => {
                            if (e.target) e.target.value = "";
                          })
                        }
                      />
                      {materials.length > 0 ? (
                        <ul className="mpt-studio__file-list">
                          {materials.map((m) => (
                            <li key={m.file}>{m.name}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {paramPanel === "voice" ? (
                <div className="mpt-col__body">
                  <div className="mpt-panel__head mpt-panel__head--inline">
                    <p className="mpt-section-label">旁白</p>
                    <button
                      type="button"
                      className="btn-mcp-action"
                      disabled={anyBusy || tts === "no-voice"}
                      onClick={() => void onVoicePreview()}
                    >
                      试听
                    </button>
                  </div>
                  <div className="mpt-grid mpt-grid--2">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">TTS</label>
                      <Select
                        aria-label="TTS 服务"
                        value={tts}
                        options={toSelectOptions(options?.tts_servers)}
                        onChange={(v) => {
                          patchStudio({ tts_server: v });
                          void loadVoices(v).catch((e) => setError(String(e)));
                        }}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">音色</label>
                      <Select
                        aria-label="音色"
                        value={params.voice_name}
                        options={
                          voiceOpts.length
                            ? voiceOpts
                            : [
                                {
                                  value: params.voice_name,
                                  label: params.voice_name,
                                },
                              ]
                        }
                        onChange={(v) => patch({ voice_name: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">音量</label>
                      <Select
                        aria-label="音量"
                        value={String(params.voice_volume)}
                        options={numOptions(options?.voice_volumes)}
                        onChange={(v) => patch({ voice_volume: Number(v) })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">语速</label>
                      <Select
                        aria-label="语速"
                        value={String(params.voice_rate)}
                        options={numOptions(options?.voice_rates)}
                        onChange={(v) => patch({ voice_rate: Number(v) })}
                      />
                    </div>
                  </div>
                  {previewUrl ? (
                    <audio
                      className="mpt-studio__audio"
                      controls
                      src={previewUrl}
                    />
                  ) : null}
                  <p className="mpt-section-label">背景音乐</p>
                  <div className="mpt-grid mpt-grid--2">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">BGM</label>
                      <Select
                        aria-label="BGM 类型"
                        value={params.bgm_type}
                        options={toSelectOptions(options?.bgm_types)}
                        onChange={(v) => patch({ bgm_type: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">BGM 音量</label>
                      <Select
                        aria-label="BGM 音量"
                        value={String(params.bgm_volume)}
                        options={numOptions(options?.bgm_volumes)}
                        onChange={(v) => patch({ bgm_volume: Number(v) })}
                      />
                    </div>
                  </div>
                  <details className="mpt-studio__nested">
                    <summary>更多配音选项</summary>
                    {(showAzure || showSilicon || showMimo) && (
                      <div className="mpt-col__body">
                        {showAzure ? (
                          <div className="mpt-grid mpt-grid--2">
                            <div className="mpt-studio__field">
                              <label className="images-generate__label">
                                Azure Region
                              </label>
                              <input
                                className="mpt-studio__input"
                                value={studio.azure_speech_region || ""}
                                onChange={(e) =>
                                  patchStudio({
                                    azure_speech_region: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="mpt-studio__field">
                              <label className="images-generate__label">
                                Azure Key
                              </label>
                              <input
                                className="mpt-studio__input"
                                type="password"
                                value={studio.azure_speech_key || ""}
                                onChange={(e) =>
                                  patchStudio({
                                    azure_speech_key: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                        {showSilicon ? (
                          <div className="mpt-studio__field">
                            <label className="images-generate__label">
                              SiliconFlow Key
                            </label>
                            <input
                              className="mpt-studio__input"
                              type="password"
                              value={studio.siliconflow_api_key || ""}
                              onChange={(e) =>
                                patchStudio({
                                  siliconflow_api_key: e.target.value,
                                })
                              }
                            />
                          </div>
                        ) : null}
                        {showMimo ? (
                          <div className="mpt-studio__field">
                            <label className="images-generate__label">
                              MiMo Key
                            </label>
                            <input
                              className="mpt-studio__input"
                              type="password"
                              value={studio.mimo_api_key || ""}
                              onChange={(e) =>
                                patchStudio({ mimo_api_key: e.target.value })
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">
                        自定义旁白
                        {params.custom_audio_file
                          ? ` · ${params.custom_audio_file}`
                          : ""}
                      </label>
                      <div className="mpt-studio__actions">
                        <input
                          type="file"
                          accept="audio/*"
                          disabled={busy}
                          onChange={(e) =>
                            void uploadMany(
                              e.target.files,
                              "mpt_upload_custom_audio",
                            ).finally(() => {
                              if (e.target) e.target.value = "";
                            })
                          }
                        />
                        {params.custom_audio_file ? (
                          <button
                            type="button"
                            className="btn-mcp-remove"
                            onClick={() => patch({ custom_audio_file: null })}
                          >
                            清除
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">BGM 文件</label>
                      <Select
                        aria-label="BGM 文件"
                        value={params.bgm_file}
                        options={bgmOpts}
                        onChange={(v) =>
                          patch({
                            bgm_file: v,
                            bgm_type: v ? "custom" : params.bgm_type,
                          })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">上传 BGM</label>
                      <input
                        type="file"
                        accept="audio/mpeg,.mp3"
                        disabled={busy}
                        onChange={(e) =>
                          void uploadMany(
                            e.target.files,
                            "mpt_upload_bgm",
                          ).finally(() => {
                            if (e.target) e.target.value = "";
                          })
                        }
                      />
                    </div>
                  </details>
                </div>
              ) : null}

              {paramPanel === "subtitle" ? (
                <div className="mpt-col__body">
                  <div className="mpt-panel__head mpt-panel__head--inline">
                    <p className="mpt-section-label">字幕样式</p>
                    <label className="mpt-studio__check">
                      <input
                        type="checkbox"
                        checked={params.subtitle_enabled}
                        onChange={(e) =>
                          patch({ subtitle_enabled: e.target.checked })
                        }
                      />
                      启用字幕
                    </label>
                  </div>
                  <div
                    className={
                      params.subtitle_enabled
                        ? "mpt-grid mpt-grid--2"
                        : "mpt-grid mpt-grid--2 mpt-grid--muted"
                    }
                  >
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">字体</label>
                      <Select
                        aria-label="字体"
                        value={params.font_name}
                        options={
                          fontOpts.length
                            ? fontOpts
                            : [
                                {
                                  value: params.font_name,
                                  label: params.font_name,
                                },
                              ]
                        }
                        onChange={(v) => patch({ font_name: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">位置</label>
                      <Select
                        aria-label="字幕位置"
                        value={params.subtitle_position}
                        options={toSelectOptions(options?.subtitle_positions)}
                        onChange={(v) => patch({ subtitle_position: v })}
                      />
                    </div>
                    {params.subtitle_position === "custom" ? (
                      <div className="mpt-studio__field">
                        <label className="images-generate__label">位置 %</label>
                        <input
                          className="mpt-studio__input"
                          type="number"
                          min={0}
                          max={100}
                          value={params.custom_position}
                          onChange={(e) =>
                            patch({
                              custom_position: Number(e.target.value) || 70,
                            })
                          }
                        />
                      </div>
                    ) : null}
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">字号</label>
                      <input
                        className="mpt-studio__input"
                        type="number"
                        min={20}
                        max={120}
                        value={params.font_size}
                        onChange={(e) =>
                          patch({ font_size: Number(e.target.value) || 60 })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">文字色</label>
                      <input
                        type="color"
                        className="mpt-studio__color"
                        value={params.text_fore_color || "#FFFFFF"}
                        onChange={(e) =>
                          patch({ text_fore_color: e.target.value })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">描边色</label>
                      <input
                        type="color"
                        className="mpt-studio__color"
                        value={params.stroke_color || "#000000"}
                        onChange={(e) =>
                          patch({ stroke_color: e.target.value })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">描边宽</label>
                      <input
                        className="mpt-studio__input"
                        type="number"
                        step={0.5}
                        min={0}
                        max={10}
                        value={params.stroke_width}
                        onChange={(e) =>
                          patch({ stroke_width: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div
                    className={
                      params.subtitle_enabled
                        ? "mpt-studio__actions"
                        : "mpt-studio__actions mpt-grid--muted"
                    }
                  >
                    <label className="mpt-studio__check">
                      <input
                        type="checkbox"
                        checked={subtitleBgEnabled}
                        onChange={(e) =>
                          setSubtitleBgEnabled(e.target.checked)
                        }
                      />
                      字幕背景
                    </label>
                    {subtitleBgEnabled ? (
                      <input
                        type="color"
                        className="mpt-studio__color"
                        value={subtitleBgColor}
                        onChange={(e) => setSubtitleBgColor(e.target.value)}
                        aria-label="字幕背景色"
                      />
                    ) : null}
                    <label className="mpt-studio__check">
                      <input
                        type="checkbox"
                        checked={params.rounded_subtitle_background}
                        onChange={(e) =>
                          patch({
                            rounded_subtitle_background: e.target.checked,
                          })
                        }
                      />
                      圆角
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="model-modal__footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setParamPanel(null)}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="modal-overlay"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="model-modal mpt-settings-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpt-settings-title"
          >
            <div className="model-modal__header">
              <h2 id="mpt-settings-title" className="model-modal__title">
                视频工程设置
              </h2>
              <button
                type="button"
                className="model-modal__close"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="model-modal__body mpt-settings">
              <section className="mpt-col mpt-col--wide">
                <h3 className="mpt-col__title">服务连接</h3>
                <div className="mpt-col__body">
                  <div className="mpt-shell__conn mpt-shell__conn--settings">
                    <span
                      className={
                        healthOk
                          ? "mpt-shell__pill mpt-shell__pill--ok"
                          : "mpt-shell__pill"
                      }
                      title={healthOk || "未连接"}
                    >
                      {healthOk ? "已连接" : "未连接"}
                    </span>
                    <input
                      className="mpt-studio__input mpt-shell__url"
                      value={baseUrl}
                      disabled={busy}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="http://127.0.0.1:6060"
                      aria-label="chatcms-video 服务地址"
                    />
                    <button
                      type="button"
                      className="btn-mcp-action"
                      disabled={anyBusy}
                      onClick={() => void saveBaseUrl()}
                    >
                      检测并保存
                    </button>
                  </div>
                </div>
              </section>
              <section className="mpt-col mpt-col--wide">
                <h3 className="mpt-col__title">LLM</h3>
                <div className="mpt-col__body">
                  <div className="mpt-grid mpt-grid--3">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">Provider</label>
                      <Select
                        aria-label="LLM Provider"
                        value={studio.llm_provider || "openai"}
                        options={(options?.llm_providers || ["openai"]).map(
                          (p) => ({ value: p, label: p }),
                        )}
                        onChange={(v) => patchStudio({ llm_provider: v })}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">Model</label>
                      <input
                        className="mpt-studio__input"
                        value={studio.llm_model_name || ""}
                        onChange={(e) =>
                          patchStudio({ llm_model_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">
                        Video Codec
                      </label>
                      <Select
                        aria-label="Video Codec"
                        value={studio.video_codec || "libx264"}
                        options={toSelectOptions(options?.video_codecs)}
                        onChange={(v) => patchStudio({ video_codec: v })}
                      />
                    </div>
                  </div>
                  <div className="mpt-grid mpt-grid--2">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">API Key</label>
                      <input
                        className="mpt-studio__input"
                        type="password"
                        value={studio.llm_api_key || ""}
                        onChange={(e) =>
                          patchStudio({ llm_api_key: e.target.value })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">Base URL</label>
                      <input
                        className="mpt-studio__input"
                        value={studio.llm_base_url || ""}
                        onChange={(e) =>
                          patchStudio({ llm_base_url: e.target.value })
                        }
                        placeholder="可选"
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">
                        Secret Key
                      </label>
                      <input
                        className="mpt-studio__input"
                        type="password"
                        value={studio.llm_secret_key || ""}
                        onChange={(e) =>
                          patchStudio({ llm_secret_key: e.target.value })
                        }
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">
                        Account ID
                      </label>
                      <input
                        className="mpt-studio__input"
                        value={studio.llm_account_id || ""}
                        onChange={(e) =>
                          patchStudio({ llm_account_id: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="mpt-col mpt-col--wide">
                <h3 className="mpt-col__title">素材 API Keys</h3>
                <div className="mpt-col__body">
                  <div className="mpt-grid mpt-grid--3">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">Pexels</label>
                      <textarea
                        className="mpt-studio__textarea mpt-studio__textarea--sm"
                        rows={3}
                        value={pexelsText}
                        onChange={(e) => setPexelsText(e.target.value)}
                        placeholder="每行一个 Key"
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">Pixabay</label>
                      <textarea
                        className="mpt-studio__textarea mpt-studio__textarea--sm"
                        rows={3}
                        value={pixabayText}
                        onChange={(e) => setPixabayText(e.target.value)}
                      />
                    </div>
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">Coverr</label>
                      <textarea
                        className="mpt-studio__textarea mpt-studio__textarea--sm"
                        rows={3}
                        value={coverrText}
                        onChange={(e) => setCoverrText(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mpt-studio__row">
                    <div className="mpt-studio__field">
                      <label className="images-generate__label">快速添加</label>
                      <Select
                        aria-label="Key 类型"
                        value={newKeyKind}
                        options={[
                          { value: "pexels", label: "Pexels" },
                          { value: "pixabay", label: "Pixabay" },
                          { value: "coverr", label: "Coverr" },
                        ]}
                        onChange={(v) =>
                          setNewKeyKind(v as "pexels" | "pixabay" | "coverr")
                        }
                      />
                    </div>
                    <div className="mpt-studio__field mpt-studio__field--grow">
                      <label className="images-generate__label">新 Key</label>
                      <input
                        className="mpt-studio__input"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-mcp-action mpt-studio__health"
                      onClick={addApiKey}
                    >
                      添加
                    </button>
                  </div>
                  {(
                    [
                      ["pexels", textToKeys(pexelsText)],
                      ["pixabay", textToKeys(pixabayText)],
                      ["coverr", textToKeys(coverrText)],
                    ] as const
                  ).map(([kind, keys]) =>
                    keys.length ? (
                      <div key={kind} className="mpt-studio__key-group">
                        <div className="images-generate__label">{kind}</div>
                        <ul className="mpt-studio__file-list">
                          {keys.map((k) => (
                            <li key={k} className="mpt-studio__key-item">
                              <span>
                                {k.length > 12
                                  ? `${k.slice(0, 6)}…${k.slice(-4)}`
                                  : k}
                              </span>
                              <button
                                type="button"
                                className="btn-mcp-remove"
                                onClick={() => removeKeyLine(kind, k)}
                              >
                                删除
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            </div>
            <div className="model-modal__footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSettingsOpen(false)}
              >
                关闭
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={anyBusy}
                onClick={() =>
                  void saveStudioConfig()
                    .then(() => {
                      setStatusText("配置已保存到 chatcms-video");
                      setSettingsOpen(false);
                    })
                    .catch((e) => setError(String(e)))
                }
              >
                保存到 chatcms-video
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
