import React, { useEffect, useState } from "react";
import ChatList from "./components/ChatListNew";
import ChatView from "./components/ChatView";

export default function App() {
  const [chats, setChats] = useState([]);
  const [status, setStatus] = useState("Connecting...");
  const [selectedChat, setSelectedChat] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});

  useEffect(() => {
    let mounted = true;
    window.api
      .getChats()
      .then((list) => {
        if (mounted) {
          setChats(list.sort((a, b) => b.t - a.t));
          setStatus("Ready");
        }
      })
      .catch((e) => setStatus("Not connected"));

    const unsub = (msg) => {
      setMessagesMap((prev) => {
        const chatId = String(msg.chatId || msg.from || "unknown");
        const arr = (prev[chatId] || []).concat([msg]);
        return { ...prev, [chatId]: arr };
      });
    };

    // register handler
    window.api.onNewMessage(unsub);

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (!selectedChat) return;
    let mounted = true;
    window.api
      .getMessages(selectedChat)
      .then((msgs) => {
        if (mounted && msgs) {
          setMessagesMap((prev) => ({
            ...prev,
            [selectedChat]: msgs,
          }));
        }
      })
      .catch((e) => console.error("Failed to fetch messages:", e));
    return () => {
      mounted = false;
    };
  }, [selectedChat]);

  return (
    <div className="app whatsapp">
      <ChatList
        chats={chats}
        selected={selectedChat}
        onSelect={(id) => setSelectedChat(id == null ? null : String(id))}
        messagesMap={messagesMap}
      />
      <ChatView
        chatId={selectedChat}
        messages={messagesMap[String(selectedChat)] || []}
      />
    </div>
  );
}
