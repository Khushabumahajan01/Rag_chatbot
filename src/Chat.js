import React, { useState } from "react";
import { chatMessage, clearChat } from "./api";

export default function Chat({ sessionId, chatHistory, setChatHistory }) {
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!inputMessage.trim()) return;
    setLoading(true);
    try {
      const data = await chatMessage(sessionId, inputMessage);
      setChatHistory(data.history);
      setInputMessage("");
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  }

  async function clearHistory() {
    try {
      await clearChat(sessionId);
      setChatHistory("");
      alert("Chat history cleared for session " + sessionId);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section
      className="chat-section"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "200vh", // Increased height
        maxWidth: "1600px", // Increased max width
        width: "100vw", // Increased width, responsive
        margin: "0 auto",
        background: "#181a20",
        borderRadius: "18px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
        padding: "0 0 24px 0",
        fontFamily: "'Segoe UI', 'Inter', 'Roboto', Arial, sans-serif",
      }}
    >
      {/* Clear history button at the top */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          onClick={clearHistory}
          title="Clear History"
          aria-label="Clear chat history"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.5rem",
            lineHeight: 1,
            color: "#c00",
          }}
        >
          
        </button>
      </div>

      <textarea
        rows={10}
        readOnly
        value={chatHistory}
        className="chat-textarea"
        style={{ flexGrow: 1, resize: "none", marginBottom: 10 }}
      />

      {/* Input and send button in one row */}
      <div className="input-area" style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: 10 }}>
        <input
          type="text"
          placeholder="Type your question..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={loading}
          className="chat-input"
          style={{ flexGrow: 1, marginBottom: 0 }}
        />
        <button
          className="small-send-btn"
          onClick={sendMessage}
          disabled={loading || !inputMessage.trim()}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>

      <section style={{ marginTop: 0  }}>
        <h3>Active Session ID: {sessionId}</h3>
      </section>
    </section>
  );
}