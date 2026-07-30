import { useCallback, useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@/hooks/useTauri";
import type { GeneratedVideo } from "../types";

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

export const useVideos = () => {
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const list = await invoke<GeneratedVideo[]>("plugin:videos|video_list");
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
        const created = await invoke<GeneratedVideo>("plugin:videos|video_generate", {
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

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("video/"));
    if (!list.length) {
      setError("请选择视频文件");
      return [];
    }
    setBusy(true);
    setError("");
    const created: GeneratedVideo[] = [];
    try {
      for (const file of list) {
        const dataBase64 = await fileToBase64(file);
        const item = await invoke<GeneratedVideo>("plugin:videos|video_upload", {
          dataBase64,
          filename: file.name,
          contentType: file.type || null,
        });
        setVideos((prev) => [item, ...prev.filter((v) => v.id !== item.id)]);
        created.push(item);
      }
      return created;
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const updateMeta = useCallback(async (id: string, title: string, note: string) => {
    const updated = await invoke<GeneratedVideo>("plugin:videos|video_update", {
      id,
      title,
      note,
    });
    setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await invoke("plugin:videos|video_delete", { id });
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await invoke("plugin:videos|video_delete", { id });
    }
    const drop = new Set(ids);
    setVideos((prev) => prev.filter((v) => !drop.has(v.id)));
  }, []);

  return {
    videos,
    busy,
    error,
    setError,
    generate,
    uploadFiles,
    updateMeta,
    remove,
    removeMany,
    refresh,
    srcFor,
  };
};
