import React, { useEffect, useRef, useState } from "react";

export default function MessageList({ messages = [], chatId }) {
  const ref = useRef();
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Listen for download progress from IPC
    if (window.api?.onProgress) {
      const handleProgress = (progress) => {
        if (progress) {
          // Transform backend progress format to frontend format
          if (progress.total !== undefined && progress.completed !== undefined) {
            const percentage = Math.round((progress.completed / progress.total) * 100);
            
            // Extract filename from lastFile path
            let filename = "File";
            let folderPath = null;
            if (progress.lastFile) {
              const parts = progress.lastFile.split(/[\\/]/);
              filename = parts[parts.length - 1];
              folderPath = progress.lastFile.substring(0, progress.lastFile.lastIndexOf(parts[parts.length - 1]));
            }
            
            setDownloading({
              progress: percentage,
              filename: filename,
              completed: progress.completed,
              total: progress.total
            });
            
            // Check if download is complete
            if (progress.completed === progress.total) {
              setTimeout(() => {
                setDownloading({ 
                  done: true, 
                  folder: folderPath || "Downloads folder" 
                });
              }, 500);
            }
          } else {
            // Handle other progress formats
            setDownloading(progress);
          }
          
          // Auto-hide after completion
          if (progress?.done || progress?.error) {
            setTimeout(() => setDownloading(null), 3000);
          }
        }
      };
      window.api.onProgress(handleProgress);
      
      // Cleanup if possible
      return () => {
        if (window.api?.removeProgressListener) {
          window.api.removeProgressListener(handleProgress);
        }
      };
    }
  }, []);

  async function handleDownload(m) {
    const downloader =
      window.api?.downloadMessage ||
      window.api?.downloadAttachment ||
      window.api?.downloadMedia;
    
    if (!downloader) {
      alert("Download API not available");
      return;
    }
    
    try {
      setDownloading({ starting: true, filename: m.filename || "file" });
      
      // Set a timeout to auto-complete if backend doesn't send updates
      const timeoutId = setTimeout(() => {
        setDownloading({ done: true, filename: m.filename || "file" });
      }, 30000); // 30 seconds max
      
      // Call the download function
      const result = await downloader(chatId, m.id || m.mediaKey || m.filename || m);
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      // Check if result indicates success
      if (result?.ok || result?.success) {
        setDownloading({ 
          done: true, 
          folder: result.folder || result.path || result.result?.folder || "Downloads folder" 
        });
      } else if (result?.error) {
        setDownloading({ error: result.error });
      } else {
        // If no result or unclear result, assume success
        setDownloading({ done: true, filename: m.filename || "file" });
      }
    } catch (e) {
      console.error(e);
      setDownloading({ error: e.message || "Download failed" });
    }
  }

  return (
    <>
      <div className="message-list" ref={ref}>
        {messages.map((m, idx) => {
          const isOutgoing = m.fromMe === true || m.from === undefined;
          const hasImage = m.mimetype?.startsWith("image") && m.mediaUrl;
          const hasFile = m.mimetype && !m.mimetype.startsWith("image");

          // Check if mediaUrl is base64 data
          const isBase64 = m.mediaUrl?.startsWith("data:") || m.mediaUrl?.startsWith("/9j/");

          return (
            <div
              key={idx}
              className={`message ${isOutgoing ? "outgoing" : "incoming"}`}
            >
              <div className="bubble">
                {/* IMAGE - only show if it's a proper URL, not base64 */}
                {hasImage && !isBase64 && (
                  <div className="msg-image">
                    <img src={m.mediaUrl} alt="media" />
                  </div>
                )}

                {/* FILE or base64 IMAGE - show as file attachment */}
                {(hasFile || (hasImage && isBase64)) && (
                  <div className="msg-file">
                    <div className="file-icon">
                      {m.mimetype?.startsWith("image") ? "🖼️" : "📄"}
                    </div>
                    <div className="file-info">
                      <div className="filename">
                        {m.filename || m.mimetype || "Attachment"}
                      </div>
                    </div>
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(m)}
                    >
                      Download
                    </button>
                  </div>
                )}

                {/* TEXT - only show if there's no file/image attachment or if body doesn't look like base64 */}
                {m.body && !hasFile && !(hasImage && isBase64) && !m.body.match(/^[A-Za-z0-9+/=]{100,}$/) && (
                  <div className="msg-text">{m.body}</div>
                )}

                {/* TIMESTAMP */}
                <span className="msg-time">
                  {new Date((m.t || Date.now()) * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Download Progress Popup */}
      {downloading && (
        <div className="download-popup">
          <div className="download-popup-content">
            {downloading.starting && !downloading.progress && !downloading.done && !downloading.error && (
              <>
                <div className="popup-icon">⏳</div>
                <div className="popup-title">Preparing download...</div>
                <div className="popup-filename">{downloading.filename || "File"}</div>
              </>
            )}

            {downloading.progress !== undefined && downloading.progress !== null && !downloading.done && !downloading.error && (
              <>
                <div className="popup-icon">📥</div>
                <div className="popup-title">Downloading...</div>
                <div className="popup-filename">
                  {downloading.filename || "File"}
                  {downloading.total && downloading.completed && (
                    <span style={{ fontSize: '12px', color: '#667781', marginLeft: '8px' }}>
                      ({downloading.completed}/{downloading.total})
                    </span>
                  )}
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${downloading.progress}%` }}
                  />
                </div>
                <div className="progress-text">{downloading.progress}%</div>
              </>
            )}

            {downloading.done && (
              <>
                <div className="popup-icon success">✓</div>
                <div className="popup-title">Download complete!</div>
                {downloading.folder && (
                  <div className="popup-folder">
                    Saved to: {downloading.folder}
                  </div>
                )}
              </>
            )}

            {downloading.error && (
              <>
                <div className="popup-icon error">✕</div>
                <div className="popup-title">Download failed</div>
                <div className="popup-error">{downloading.error}</div>
              </>
            )}

            {!downloading.starting && !downloading.progress && !downloading.done && !downloading.error && (
              <>
                <div className="popup-icon">📥</div>
                <div className="popup-title">Downloading...</div>
                <div className="popup-filename">{downloading.filename || downloading.type || "File"}</div>
              </>
            )}

            <button
              className="popup-close"
              onClick={() => setDownloading(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}