import React, { useState, useEffect } from "react";
import Chat from "./Chat";
import './index.css';
import './App.css';

function generateSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

const STORAGE_KEY = "doc-chat-sessions";

function getSessionsFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : {};
}

function saveSessionsToStorage(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [chunkSize] = useState(256);
  const [ingestMessage, setIngestMessage] = useState("");

  // sessions: { [sessionId]: { chatHistory: string, uploadedFiles: File[] } }
  const [sessions, setSessions] = useState(() => getSessionsFromStorage());
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const keys = Object.keys(getSessionsFromStorage());
    return keys.length ? keys[0] : generateSessionId();
  });

  // Ensure session exists on switch
  useEffect(() => {
    setSessions(prev => {
      if (!prev[activeSessionId]) {
        return {
          ...prev,
          [activeSessionId]: { chatHistory: "", uploadedFiles: [] }
        };
      }
      return prev;
    });
  }, [activeSessionId]);

  // Persist sessions
  useEffect(() => {
    saveSessionsToStorage(sessions);
  }, [sessions]);

  // Get uploadedFiles for current session
  const uploadedFiles = sessions[activeSessionId]?.uploadedFiles || [];

  // Upload handler: add files to current session only
  async function handleFileUpload(e) {
    e.preventDefault();
    if (!files || files.length === 0) {
      alert("Please select at least one file first");
      return;
    }
    setIngestMessage("Uploading...");
    try {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      formData.append("chunk_size", chunkSize);

      const res = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setIngestMessage(data.message || "Upload complete");

      // Add new files to this session, avoiding duplicates
      setSessions(prev => {
        const prevFiles = prev[activeSessionId]?.uploadedFiles || [];
        const prevNames = prevFiles.map(f => f.name);
        const newUnique = files.filter(f => !prevNames.includes(f.name));
        return {
          ...prev,
          [activeSessionId]: {
            ...prev[activeSessionId],
            uploadedFiles: [...prevFiles, ...newUnique],
          }
        };
      });

      setFiles([]); // Clear file input after upload
    } catch (err) {
      setIngestMessage("Error: " + err.message);
    }
  }

  // Update chat history for current session
  function updateChatHistory(newHistory) {
    setSessions((prev) => ({
      ...prev,
      [activeSessionId]: {
        ...prev[activeSessionId],
        chatHistory: newHistory,
      },
    }));
  }

  // Remove a single file from current session
  function removeFile(idx) {
    setSessions(prev => ({
      ...prev,
      [activeSessionId]: {
        ...prev[activeSessionId],
        uploadedFiles: prev[activeSessionId].uploadedFiles.filter((_, i) => i !== idx),
      },
    }));
  }

  // Remove all files from current session
  function removeAllFiles() {
    setSessions(prev => ({
      ...prev,
      [activeSessionId]: {
        ...prev[activeSessionId],
        uploadedFiles: [],
      },
    }));
  }

  // Delete session
  function deleteSession(sessionId) {
    if (
      !window.confirm(
        `Delete history "${sessionId}"? This cannot be undone.`
      )
    )
      return;

    setSessions((prev) => {
      const updated = { ...prev };
      delete updated[sessionId];

      if (sessionId === activeSessionId) {
        const keys = Object.keys(updated);
        setActiveSessionId(keys.length ? keys[0] : generateSessionId());
      }

      return updated;
    });
  }

  // Create new session: empty chat and files
  function createNewSession() {
    const newId = generateSessionId();
    setSessions((prev) => ({
      ...prev,
      [newId]: { chatHistory: "", uploadedFiles: [] },
    }));
    setActiveSessionId(newId);
  }

  return (
    <div className="App">
      {/* Sidebar */}
      <aside className="sidebar" aria-label="Chat history">
        <div className="sidebar-header">
          <h2>History</h2>
          <button
            className="new-session-btn"
            onClick={createNewSession}
            aria-label="Create new session"
          >
            <span style={{fontSize: "1.3em", marginRight: 6}}>➕</span> New Session
          </button>
        </div>

        {Object.keys(sessions).length === 0 && (
          <p>No history yet. Create one!</p>
        )}

        <ul style={{ padding: 0, margin: 0, listStyle: "none", flexGrow: 1 }}>
          {Object.entries(sessions).map(([id, data]) => (
            <li
              key={id}
              className={`history-item ${id === activeSessionId ? "active" : ""}`}
              onClick={() => setActiveSessionId(id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveSessionId(id);
                }
              }}
              aria-current={id === activeSessionId ? "page" : undefined}
            >
              <div
                style={{
                  flex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={id}
              >
                {data.chatHistory
                  ? data.chatHistory.substring(0, 40).replace(/\n/g, " ") + "..."
                  : <em>No chat yet</em>}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(id);
                }}
                title={`Delete history ${id}`}
                aria-label={`Delete history ${id}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main chat and upload container */}
      <main className="chat-window" role="main" style={{ display: "flex", flexDirection: "column", height: "100vh", marginTop: 0, paddingTop: 0 }}>
        <h1 style={{ marginTop: 0, paddingTop: 0 }}>Chatbot</h1>

        {/* File upload */}
        <section style={{ marginBottom: 20, flexShrink: 0 }}>
          <h2>Upload Document</h2>
          <form onSubmit={handleFileUpload} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label htmlFor="file-upload" style={{
              display: "inline-block",
              background: "#fff",
              color: "#1976d2",
              border: "1px solidrgb(255, 255, 255)",
              borderRadius: "18px",
              padding: "7px 18px",
              fontWeight: 600,
              fontSize: "0.98rem",
              cursor: "pointer",
              width: "fit-content"
            }}>
              Choose Files
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.txt,.docx"
              multiple
              style={{ display: "none" }}
              onChange={(e) => setFiles(Array.from(e.target.files))}
            />
            {/* Show selected file names below */}
            {files.length > 0 && (
              <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px", color: "#1976d2", fontWeight: 500 }}>
                {files.map((file, idx) => (
                  <li key={idx}>{file.name}</li>
                ))}
              </ul>
            )}
            <button
              type="submit"
              className="small-upload-btn"
              disabled={files.length === 0}
              style={{ width: "120px", marginTop: "8px" }}
            >
              <span role="img" aria-label="Upload" style={{ marginRight: 6 }}>📤</span>
              Upload
            </button>
          </form>
          {/* Show list of all uploaded files for this session */}
          <div style={{ marginTop: "10px" }}>
            <strong>Uploaded Files:</strong>
            <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>
              {uploadedFiles.length === 0 && <li style={{ color: "#888" }}>No files uploaded yet.</li>}
              {uploadedFiles.map((file, idx) => (
                <li
                  key={idx}
                  style={{
                    color: "#1976d2",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <span>{file.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    style={{
                      marginLeft: 12,
                      background: "none",
                      border: "none",
                      color: "#c00",
                      fontSize: "1.2em",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title={`Remove ${file.name}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {uploadedFiles.length > 0 && (
              <button
                onClick={removeAllFiles}
                style={{
                  marginTop: 8,
                  background: "#fff",
                  color: "#c00",
                  border: "1px solid #c00",
                  borderRadius: "12px",
                  padding: "4px 16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Remove All
              </button>
            )}
          </div>
          <p>{ingestMessage}</p>
        </section>

        <Chat
          sessionId={activeSessionId}
          chatHistory={sessions[activeSessionId]?.chatHistory || ""}
          setChatHistory={updateChatHistory}
        />
      </main>
    </div>
  );
}
