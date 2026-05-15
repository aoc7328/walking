import { useState } from 'react';

export default function NoteEditor({
  notes,
  onChange,
}: {
  notes: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function updateAt(idx: number, value: string) {
    const next = [...notes];
    next[idx] = value;
    onChange(next);
  }

  function removeAt(idx: number) {
    onChange(notes.filter((_, i) => i !== idx));
  }

  function addNew() {
    if (!draft.trim()) return;
    onChange([...notes, draft.trim()]);
    setDraft('');
  }

  return (
    <div className="item-notes" onClick={(e) => e.stopPropagation()}>
      {notes.map((note, idx) => (
        <div className="note-editor-row item-note" key={idx}>
          <input
            className="note-editor-input"
            value={note}
            onChange={(e) => updateAt(idx, e.target.value)}
            placeholder="備註…"
          />
          <button className="note-remove-btn" onClick={() => removeAt(idx)} title="移除備註">
            ✕
          </button>
        </div>
      ))}
      <div className="note-editor-row">
        <input
          className="note-editor-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNew()}
          placeholder="+ 新增備註，按 Enter"
        />
      </div>
    </div>
  );
}
