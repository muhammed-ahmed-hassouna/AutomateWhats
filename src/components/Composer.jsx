import React, { useState } from "react";

export default function Composer({ chatId }) {
  const [text, setText] = useState("");

  async function handleSend() {
    if (!chatId) return alert("Select a chat first");
    if (!text.trim()) return;
    setText("");
    // sendMessage not yet implemented in backend; clear input only
  }

  return (
    <div className="composer">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
