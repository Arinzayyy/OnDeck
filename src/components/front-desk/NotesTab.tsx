'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NoteRow {
  id: string;
  body: string;
  author_name: string;
  author_kind: 'admin' | 'student';
  pinned: boolean;
  created_at: string;
  can_delete: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const noteDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (noteDay === todayStart - 86400000) {
    return `yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return `${Math.floor(diff / 86400000)} days ago`;
}

function sortNotes(notes: NoteRow[]): NoteRow[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// ─── Note card ────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: NoteRow;
  tick: number;
  togglingPinId: string | null;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onTogglePin: (id: string, current: boolean) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (id: string) => void;
}

function NoteCard({
  note, tick, togglingPinId, deletingId, confirmDeleteId,
  onTogglePin, onDeleteRequest, onDeleteCancel, onDeleteConfirm,
}: NoteCardProps) {
  const isConfirming = confirmDeleteId === note.id;
  const isDeleting = deletingId === note.id;
  const isPinToggling = togglingPinId === note.id;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
          <span className="font-semibold text-gray-800">{note.author_name}</span>
          <span className="text-gray-300">·</span>
          <span>{note.author_kind === 'admin' ? 'admin' : 'front desk'}</span>
          <span className="text-gray-300">·</span>
          <span title={new Date(note.created_at).toLocaleString()}>
            {/* tick forces re-render for relative time updates */}
            {tick >= 0 && relativeTime(note.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Pin toggle */}
          <button
            onClick={() => onTogglePin(note.id, note.pinned)}
            disabled={isPinToggling}
            title={note.pinned ? 'Unpin' : 'Pin'}
            className="rounded p-1 transition-colors hover:bg-gray-100 disabled:opacity-40"
          >
            {note.pinned ? (
              <span className="text-base leading-none">📌</span>
            ) : (
              <span className="text-base leading-none opacity-25 hover:opacity-50 transition-opacity">📍</span>
            )}
          </button>

          {/* Delete — only shown when can_delete */}
          {note.can_delete && (
            isConfirming ? (
              <span className="flex items-center gap-1.5 text-xs ml-1">
                <span className="text-gray-500">Delete?</span>
                <button
                  onClick={() => onDeleteConfirm(note.id)}
                  disabled={isDeleting}
                  className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Yes
                </button>
                <button
                  onClick={onDeleteCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => onDeleteRequest(note.id)}
                className="rounded p-1 text-gray-300 hover:text-red-400 transition-colors"
                title="Delete note"
              >
                <TrashIcon />
              </button>
            )
          )}
        </div>
      </div>

      {/* Body */}
      <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

export function NotesTab() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [pinComposer, setPinComposer] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/front-desk/notes');
      const data = await res.json();
      if (res.ok) setNotes(data.notes ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    loadNotes().finally(() => setLoading(false));

    // Poll every 30s; pause while browser tab is hidden
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') loadNotes();
    }, 30000);

    // Tick every 60s to keep relative timestamps fresh between polls
    const tickRef = setInterval(() => setTick((t) => t + 1), 60000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(tickRef);
    };
  }, [loadNotes]);

  // Auto-grow textarea up to 8 rows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 24 * 8) + 'px';
  }, [body]);

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    setPostError('');
    try {
      const res = await fetch('/api/front-desk/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed, pinned: pinComposer }),
      });
      const data = await res.json();
      if (!res.ok) { setPostError(data.error ?? 'Failed to post.'); return; }
      setNotes((prev) => sortNotes([data.note, ...prev]));
      setBody('');
      setPinComposer(false);
    } catch {
      setPostError('Something went wrong. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function handleTogglePin(id: string, currentPinned: boolean) {
    setTogglingPinId(id);
    try {
      const res = await fetch(`/api/front-desk/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !currentPinned }),
      });
      if (!res.ok) return;
      setNotes((prev) =>
        sortNotes(prev.map((n) => (n.id === id ? { ...n, pinned: !currentPinned } : n)))
      );
    } catch {}
    finally {
      setTogglingPinId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/front-desk/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDeleteId(null);
    } catch {}
    finally {
      setDeletingId(null);
    }
  }

  const pinned = notes.filter((n) => n.pinned);
  const recent = notes.filter((n) => !n.pinned);

  const cardProps = {
    tick,
    togglingPinId,
    deletingId,
    confirmDeleteId,
    onTogglePin: handleTogglePin,
    onDeleteRequest: setConfirmDeleteId,
    onDeleteCancel: () => setConfirmDeleteId(null),
    onDeleteConfirm: handleDelete,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      {/* Composer */}
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost();
          }}
          placeholder="Reminder, handoff, anything…"
          maxLength={2000}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:border-teal-500 focus:ring-teal-500 resize-none overflow-y-auto"
        />
        {body.length >= 1800 && (
          <p className={`text-right text-xs ${body.length >= 2000 ? 'text-red-500' : 'text-gray-400'}`}>
            {body.length} / 2000
          </p>
        )}
        {postError && <p className="text-xs text-red-600">{postError}</p>}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pinComposer}
              onChange={(e) => setPinComposer(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-teal-600"
            />
            <span className="text-sm text-gray-600">Pin this note</span>
          </label>
          <button
            onClick={handlePost}
            disabled={posting || !body.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {posting ? 'Posting…' : 'Post note'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">
          No notes yet. Write the first one above — handoff thoughts, reminders, anything the next person at the desk should see.
        </p>
      )}

      {/* Pinned section */}
      {pinned.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">📌 Pinned</p>
          {pinned.map((note) => (
            <NoteCard key={note.id} note={note} {...cardProps} />
          ))}
        </div>
      )}

      {/* Recent section */}
      {recent.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Recent</p>
          {recent.map((note) => (
            <NoteCard key={note.id} note={note} {...cardProps} />
          ))}
        </div>
      )}
    </div>
  );
}
