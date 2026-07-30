import { useCallback, useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { GeneratedImage } from "../types";

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

export const useImages = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const list = await invoke<GeneratedImage[]>("plugin:images|image_list");
    setImages(list);
    const next: Record<string, string> = {};
    await Promise.all(
      list.map(async (img) => {
        try {
          next[img.id] = await invoke<string>("plugin:images|image_data_url", { path: img.path });
        } catch {
          /* skip broken */
        }
      }),
    );
    setPreviews(next);
  }, []);

  useEffect(() => {
    void refresh().catch(console.error);
  }, [refresh]);

  const attachPreview = useCallback(async (created: GeneratedImage) => {
    let dataUrl = "";
    try {
      dataUrl = await invoke<string>("plugin:images|image_data_url", { path: created.path });
    } catch {
      /* ignore */
    }
    setImages((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
    if (dataUrl) {
      setPreviews((prev) => ({ ...prev, [created.id]: dataUrl }));
    }
  }, []);

  const generate = useCallback(
    async (prompt: string, model: string, size: string) => {
      setBusy(true);
      setError("");
      try {
        const created = await invoke<GeneratedImage>("plugin:images|image_generate", {
          prompt,
          model,
          size,
        });
        await attachPreview(created);
        return created;
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [attachPreview],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) {
        setError("请选择图片文件");
        return [];
      }
      setBusy(true);
      setError("");
      const created: GeneratedImage[] = [];
      try {
        for (const file of list) {
          const dataBase64 = await fileToBase64(file);
          const item = await invoke<GeneratedImage>("plugin:images|image_upload", {
            dataBase64,
            filename: file.name,
            contentType: file.type || null,
          });
          await attachPreview(item);
          created.push(item);
        }
        return created;
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [attachPreview],
  );

  const updateMeta = useCallback(async (id: string, title: string, note: string) => {
    const updated = await invoke<GeneratedImage>("plugin:images|image_update", {
      id,
      title,
      note,
    });
    setImages((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await invoke("plugin:images|image_delete", { id });
    setImages((prev) => prev.filter((i) => i.id !== id));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removeMany = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await invoke("plugin:images|image_delete", { id });
      }
      const drop = new Set(ids);
      setImages((prev) => prev.filter((i) => !drop.has(i.id)));
      setPreviews((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
    },
    [],
  );

  return {
    images,
    previews,
    busy,
    error,
    setError,
    generate,
    uploadFiles,
    updateMeta,
    remove,
    removeMany,
    refresh,
  };
};
