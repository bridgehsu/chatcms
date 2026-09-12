import { useAiNotes } from "../hooks/useAiNotes";
import { NoteEditor } from "./NoteEditor";
import { NotesSidebar } from "./NotesSidebar";

export const NotesWorkspace = () => {
  const { notes, active, select, create, update, remove } = useAiNotes();

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
      />
    </div>
  );
};
