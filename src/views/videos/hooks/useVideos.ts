import { useCallback, useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@/hooks/useTauri";
import type { GeneratedVideo } from "../types";

export const useVideos = () => {
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const list = await invoke<GeneratedVideo[]>("video_list");
    setVideos(list);
  }, []);

  useEffect(() => {
    void refresh().catch(console.error);
  }, [refresh]);

  const srcFor = useCallback((path: string) => {
    try {
      return convertFileSrc(path);
    } catch {
      return "";
    }
  }, []);

  const generate = useCallback(
    async (prompt: string, model: string, size: string, seconds: string) => {
      setBusy(true);
      setError("");
      try {
        const created = await invoke<GeneratedVideo>("video_generate", {
          prompt,
          model,
          size,
          seconds,
        });
        setVideos((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
        return created;
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await invoke("video_delete", { id });
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  return { videos, busy, error, setError, generate, remove, refresh, srcFor };
};
