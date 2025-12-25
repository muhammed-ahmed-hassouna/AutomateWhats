import React, { useEffect, useState } from "react";
import MessageList from "./MessageList";
import Composer from "./Composer";

export default function ChatView({ chatId, messages }) {
  const [localMessages, setLocalMessages] = useState([]);

  useEffect(() => setLocalMessages(messages || []), [messages]);

  async function sendDownload(type) {
    if (!chatId) return;
    await window.api.downloadMedia(chatId, type);
  }

  return (
    <div className="chat-view">
      {!chatId ? (
        <div className="empty">Select a chat to view messages</div>
      ) : (
        <>
          <div className="chat-header">{chatId}</div>
          <div className="chat-body">
            <MessageList messages={localMessages} chatId={chatId} />
            <div className="chat-actions">
              <button onClick={() => sendDownload("image")}>
                Download Images
              </button>
              <button onClick={() => sendDownload("pdf")}>
                Download PDFs
              </button>
              <button onClick={() => sendDownload("office")}>
                Download Office
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}