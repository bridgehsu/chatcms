import { useState } from "react";
import { PublishModal, type PublishSource } from "@/views/publish/PublishModal";
import { useAiNotes } from "../hooks/useAiNotes";
import { NoteEditor } from "./NoteEditor";
import { NotesSidebar } from "./NotesSidebar";

export const NotesWorkspace = () => {
  const { notes, active, select, create, update, remove } = useAiNotes();
  const [publishSrc, setPublishSrc] = useState<PublishSource | null>(null);

  return (
    <div className="notes-workspace">
      <NotesSidebar
        notes={notes}
        activeId={active?.id ?? null}
        onSelect={select}
        onCreate={create}
        onRemove={remove}
      />
      <NoteEditor
        note={active}
        onChange={(patch) => {
          if (active) update(active.id, patch);
        }}
        onPublish={(note) =>
          setPublishSrc({
            kind: "article",
            title: note.title || "无标题",
            content: note.content,
          })
        }
      />
      {publishSrc ? (
        <PublishModal source={publishSrc} onClose={() => setPublishSrc(null)} />
      ) : null}
    </div>
  );
};
