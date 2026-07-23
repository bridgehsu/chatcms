import { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const MAX = 2000;

export const MapQuickNote = ({ value, onChange }: Props) => {
  const [draft, setDraft] = useState(value);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = () => {
    onChange(draft.slice(0, MAX));
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <section className="map-card map-note">
      <header className="map-section__header">
        <h2 className="map-section__title">快速记录</h2>
        <button type="button" className="map-save-btn" onClick={save}>
          {savedFlash ? "已保存" : "保存"}
        </button>
      </header>
      <textarea
        className="map-note__input"
        value={draft}
        maxLength={MAX}
        placeholder="记下今日待办、灵感或会议要点…"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="map-note__meta">
        {draft.length}/{MAX}
      </div>
    </section>
  );
};
