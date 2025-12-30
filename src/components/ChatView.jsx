import React, { useEffect, useState } from "react";
import MessageList from "./MessageList";
import Composer from "./Composer";
import PrintManager from "./PrintManager";

export default function ChatView({ chatId, messages, downloadedFiles: parentFiles = [], setDownloadedFiles: setParentFiles }) {
  const [localMessages, setLocalMessages] = useState([]);
  const [showPrint, setShowPrint] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('ChatView received messages:', messages?.length || 0);
    setLocalMessages(messages || []);
  }, [messages]);

  async function sendDownload(type) {
    if (!chatId) return;
    
    try {
      setLoading(true);
      const result = await window.api.downloadMedia(chatId, type);
      
      console.log('Download result:', result);
      
      // Check if we got files back (for PDFs) to show print manager
      if (result?.ok && result?.result?.files && result.result.files.length > 0 && type === 'pdf') {
        // Update both local state (for modal) and parent state (for sidebar)
        if (setParentFiles) {
          setParentFiles(result.result.files);
        }
        setShowPrint(true);
      }
    } catch (e) {
      console.error("Download error:", e);
    } finally {
      setLoading(false);
    }
  }

  function closePrintManager() {
    setShowPrint(false);
    // Don't clear parent files so sidebar keeps them
  }

  return (
    <div className="chat-view">
      {!chatId && <div className="empty">Select a chat to view messages</div>}

      {chatId && (
        <>
          <div className="chat-header">
            {chatId}
            <span style={{ fontSize: '12px', color: '#667781', marginLeft: 'auto' }}>
              {localMessages.length} messages
            </span>
          </div>

          <div className="chat-body">
            <MessageList messages={localMessages} chatId={chatId} />

            <div className="chat-actions">
              <button disabled={!chatId || loading} onClick={() => sendDownload("image")}>
                {loading ? 'Loading...' : 'Download Images'}
              </button>
              <button disabled={!chatId || loading} onClick={() => sendDownload("pdf")}>
                {loading ? 'Loading...' : 'Download PDFs'}
              </button>
              <button disabled={!chatId || loading} onClick={() => sendDownload("office")}>
                {loading ? 'Loading...' : 'Download Office'}
              </button>
            </div>
          </div>
        </>
      )}

      {showPrint && parentFiles.length > 0 && (
        <PrintManager files={parentFiles} onClose={closePrintManager} />
      )}
    </div>
  );
}