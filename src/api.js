const API_URL = "http://localhost:8000"; // change if needed

export async function ingestFile(file, chunkSize) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chunk_size", chunkSize);

  const res = await fetch(`${API_URL}/ingest`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || err.error || "Error uploading file");
  }
  return res.json();
}

export async function chatMessage(sessionId, message) {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error sending message");
  }
  return res.json();
}

export async function clearChat(sessionId) {
  const res = await fetch(`${API_URL}/clear?session_id=${sessionId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Error clearing history");
  }
  return res.json();
}
