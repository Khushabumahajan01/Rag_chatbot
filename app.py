import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv, find_dotenv
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA
from fastapi.middleware.cors import CORSMiddleware
from typing import List

# Load environment variables
load_dotenv(find_dotenv(), override=True)

app = FastAPI()

# Embedding model
hf_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
VECTOR_STORE = None

# Allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with allowed origins for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory chat session storage
session_state = {}

class ChatRequest(BaseModel):
    session_id: str
    message: str
    temperature: float = 0.5

def load_documents(file_path):
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
        documents = loader.load()

        # Optional: decode or re-encode the content if needed
        for doc in documents:
            try:
                doc.page_content = doc.page_content.encode('utf-8', errors='ignore').decode('utf-8')
            except Exception as e:
                print(f"Encoding error in document: {e}")
        return documents

    elif ext == ".txt":
        loader = TextLoader(file_path, encoding="utf-8")
        return loader.load()

    elif ext == ".docx":
        loader = Docx2txtLoader(file_path)
        return loader.load()

    else:
        raise ValueError("Unsupported file type. Please upload PDF, TXT, or DOCX.")

def chunk_documents(docs, chunk_size=256, chunk_overlap=50):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return splitter.split_documents(docs)

def create_vector_store(chunks):
    return FAISS.from_documents(documents=chunks, embedding=hf_embeddings)

@app.post("/ingest")
async def ingest(files: List[UploadFile] = File(...), chunk_size: int = 256):
    global VECTOR_STORE
    try:
        all_chunks = []
        for file in files:
            file_location = f"./{file.filename}"
            with open(file_location, "wb") as f:
                f.write(await file.read())
            docs = load_documents(file_location)
            chunks = chunk_documents(docs, chunk_size=chunk_size)
            all_chunks.extend(chunks)

        if VECTOR_STORE is not None:
            VECTOR_STORE.add_documents(all_chunks)
        else:
            VECTOR_STORE = create_vector_store(all_chunks)

        return {
            "message": f"Successfully ingested {len(files)} file(s)",
            "chunks_created": len(all_chunks),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    global VECTOR_STORE, session_state

    if VECTOR_STORE is None:
        return JSONResponse(content={"error": "No documents ingested yet. Please upload a document first."}, status_code=400)

    try:
        llm = ChatGroq(model="llama3-8b-8192", temperature=req.temperature)
        retriever = VECTOR_STORE.as_retriever(search_type="similarity", search_kwargs={"k": 10})
        qa_chain = RetrievalQA.from_chain_type(llm=llm, chain_type="stuff", retriever=retriever)

        answer = qa_chain.invoke(req.message)

        if req.session_id not in session_state:
            session_state[req.session_id] = {"history": "", "uploaded_files": []}

        entry = f"Q: {req.message}\nA: {answer['result']}\n{'-'*100}\n"
        session_state[req.session_id]["history"] = entry + session_state[req.session_id]["history"]

        return JSONResponse({
            "question": req.message,
            "answer": answer["result"],
            "history": session_state[req.session_id]["history"]
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/clear")
def clear_history(session_id: str = Query(...)):
    global session_state
    if session_id in session_state:
        session_state[session_id]["history"] = ""
        return JSONResponse({"message": f"Chat history cleared for session '{session_id}'."})
    else:
        return JSONResponse({"message": "No history found for this session."}, status_code=404)

@app.post("/session")
def create_new_session():
    import random, string
    def generate_session_id():
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    new_id = generate_session_id()
    session_state[new_id] = {"history": "", "uploaded_files": []}
    return JSONResponse({"message": "New session created", "session_id": new_id})

