import React from "react";
import { FaSearch, FaCircle } from "react-icons/fa";

export default function ChatListNew({
  chats = [],
  selected,
  onSelect,
  messagesMap = {},
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="title">AutomateWhats</div>
        <div className="search">
          <FaSearch /> <input placeholder="Search or start new chat" />
        </div>
      </div>

      <div className="chats">
        {chats.map((c) => {
          const id = String(c.id);
          const msgs = messagesMap[id] || [];
          const last = msgs.length ? msgs[msgs.length - 1] : null;
          const preview = last?.body || (last?.filename ? last.filename : "");
          const time = c.t ? new Date(c.t * 1000).toLocaleTimeString() : "";
          const unread = msgs.length;
          return (
            <div
              key={c.id}
              className={`chat-item ${String(selected) === id ? "active" : ""}`}
              onClick={() => onSelect && onSelect(c.id)}
            >
              <div className="avatar">
                <FaCircle />
              </div>
              <div className="meta">
                <div className="row">
                  <div className="name">{c.name}</div>
                  <div className="time">{time}</div>
                </div>
                <div className="preview">{preview}</div>
              </div>
              <div className="badge">{unread ? unread : ""}</div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
