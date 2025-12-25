import React, { useState, useMemo, useEffect } from "react";
import { FaSearch, FaCircle } from "react-icons/fa";

export default function ChatList({ chats = [], messagesMap = {}, onSelectChat }) {
  const pageSize = 10;
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);

  // Pagination pages
  const pages = useMemo(() => {
    const total = Math.ceil(chats.length / pageSize);
    return Array.from({ length: total }, (_, i) => i);
  }, [chats.length]);

  // Listen for IPC download progress
  useEffect(() => {
    const cb = (p) => setProgress(p);
    window.api.onProgress(cb);
  }, []);

  const current = chats.slice(page * pageSize, page * pageSize + pageSize);

  function handleSelect(id) {
    setSelected(id);
    onSelectChat && onSelectChat(id);
  }

  async function handleDownload(type) {
    if (!selected) return;
    setProgress({ starting: true });

    const res = await window.api.downloadMedia(selected, type);

    if (res.ok) {
      setProgress({ done: true, folder: res.result.folder });
    } else {
      setProgress({ error: res.error });
    }
  }

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="title">AutomateWhats</div>

        <div className="search">
          <FaSearch />
          <input placeholder="Search or start new chat" />
        </div>
      </div>

      {/* Chat List */}
      <div className="chats">
        {current.map((c) => (
          <div
            key={c.id}
            className={`chat-item ${selected === c.id ? "active" : ""}`}
            onClick={() => handleSelect(c.id)}
          >
            <div className="avatar">
              <FaCircle />
            </div>

            <div className="meta">
              <div className="name">{c.name}</div>
              <div className="last">
                {c.t ? new Date(c.t * 1000).toLocaleString() : ""}
              </div>
            </div>

            <div className="badge">
              {(messagesMap[c.id] || []).length || ""}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pager">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Prev
        </button>

        <span>
          Page {page + 1} / {pages.length}
        </span>

        <button
          onClick={() =>
            setPage((p) => Math.min(pages.length - 1, p + 1))
          }
        >
          Next
        </button>
      </div>

      {/* Download Buttons */}
      {selected && (
        <div className="actions">
          <button onClick={() => handleDownload("image")}>Images</button>
          <button onClick={() => handleDownload("pdf")}>PDFs</button>
          <button onClick={() => handleDownload("office")}>Office</button>
        </div>
      )}

      {/* Progress UI */}
      {progress && (
        <div className="progress">
          {progress.starting && <div>Preparing download...</div>}
          {progress.error && <div>Error: {progress.error}</div>}
          {progress.done && <div>Saved to: {progress.folder}</div>}
        </div>
      )}
    </aside>
  );
}
