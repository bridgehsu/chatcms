export type AiNote = {
  id: string;
  title: string;
  content: string;
  icon: string;
  updatedAt: number;
  createdAt: number;
};

export type AiNotesState = {
  notes: AiNote[];
  activeId: string | null;
};
