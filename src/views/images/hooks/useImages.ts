import { useCallback, useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { GeneratedImage } from "../types";

export const useImages = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const list = await invoke<GeneratedImage[]>("image_list");
    setImages(list);
    const next: Record<string, string> = {};
    await Promise.all(
      list.map(async (img) => {
        try {
          next[img.id] = await invoke<string>("image_data_url", { path: img.path });
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

  const generate = useCallback(
    async (prompt: string, model: string, size: string) => {
      setBusy(true);
      setError("");
      try {
        const created = await invoke<GeneratedImage>("image_generate", {
          prompt,
          model,
          size,
        });
        let dataUrl = "";
        try {
          dataUrl = await invoke<string>("image_data_url", { path: created.path });
        } catch {
          /* ignore preview fail */
        }
        setImages((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
        if (dataUrl) {
          setPreviews((prev) => ({ ...prev, [created.id]: dataUrl }));
        }
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
    await invoke("image_delete", { id });
    setImages((prev) => prev.filter((i) => i.id !== id));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { images, previews, busy, error, setError, generate, remove, refresh };
};
