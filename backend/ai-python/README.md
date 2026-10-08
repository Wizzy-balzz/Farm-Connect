# FarmConnect Python AI/NLP Service

The dedicated, authoritative Python AI/NLP microservice for FarmConnect agricultural marketplace.

---

## 1. Architecture

```
React (Frontend)
   │
   │ Authenticated API requests (JWT Cookie)
   ▼
Node.js / Express (Port 5000)
   │ [Business operations, Auth, Payments, Orders, Delivery]
   │
   │ Authenticated Internal AI Request (Header: X-Internal-Service-Key)
   ▼
Python AI/NLP Service (Port 8000)
   ├── FastAPI Application (app.main:app)
   ├── Internal Auth & RBAC (app.core.security)
   ├── Sanitizing Observability (app.core.logging)
   ├── MySQL Connection Manager (app.database.connection)
   └── Subsystems:
         ├── NLP Pipeline (intent, entity, normalization, multilingual)
         ├── Gemini GenAI Client (retry, exponential backoff, jitter, fallback)
         ├── Agentic Planners & Copilots (farming, selling, market)
         ├── Crop Vision & Plant Pathology
         ├── Voice STT & TTS
         └── Safe Action Proposals (human confirmation cards)
```

---

## 2. Requirements & Installation

- **Python Version**: 3.11+ (verified on Python 3.12.10)
- **Virtual Environment**: `backend/ai-python/venv`

### Setup Instructions (Windows / Linux / macOS)

```bash
# Navigate to Python service directory
cd backend/ai-python

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 3. Environment Variables

Create `.env` inside `backend/ai-python/` or share with root backend:

```env
# Server
PYTHON_AI_PORT=8000
PYTHON_AI_HOST=127.0.0.1
DEBUG=false
LOG_LEVEL=INFO

# Internal Security Header
INTERNAL_API_SECRET=farmconnect_internal_ai_secret_dev_key

# Node.js Gateway
NODE_BACKEND_URL=http://127.0.0.1:5000

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
GEMINI_TIMEOUT_SECONDS=45
GEMINI_MAX_RETRIES=3

# Database (MySQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=farmconnect
DB_POOL_SIZE=5

# Voice & Multimodal Providers
STT_PROVIDER=gemini
TTS_PROVIDER=google
MAX_VOICE_FILE_SIZE_MB=10
MAX_IMAGE_FILE_SIZE_MB=10
```

---

## 4. Service Startup

```bash
# Start with Uvicorn
venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 5. API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Service health status | Public |
| `GET` | `/api/ai/diagnostics` | System diagnostics & Gemini health | Public |
| `POST` | `/api/ai/chat` | Main conversational AI agent | Internal (`X-Internal-Service-Key`) |
| `GET` | `/api/ai/conversations` | Conversation history | Internal |
| `POST` | `/api/ai/actions/confirm` | Safe action confirmation | Internal |
| `POST` | `/api/ai/actions/cancel` | Cancel action proposal | Internal |
| `GET` | `/api/ai/actions/history` | Action audit history | Internal |
| `POST` | `/api/ai/image-analysis` | Multimodal crop health vision | Internal |
| `POST` | `/api/ai/voice` | Voice STT transcription | Internal |
| `POST` | `/api/ai/tts` | Voice TTS speech synthesis | Internal |
| `GET` | `/api/ai/memory` | Personal AI memories | Internal |
| `GET` | `/api/ai/goals` | Farming goal tracking | Internal |
| `POST` | `/api/ai/copilot/plan` | Multi-step agentic planning | Internal |
| `GET` | `/api/ai/insights` | Proactive agricultural alerts | Internal |
| `POST` | `/api/ai/marketplace/selling-strategy` | Data-driven crop selling advice | Internal |
| `GET` | `/api/ai/analytics/farmer-report` | Complete farm performance report | Internal |

---

## 6. Security & Boundaries

1. **Zero Secret Leakage**: Sanitizing loggers scrub API keys, JWT tokens, and credentials before writing to logs.
2. **Internal Service Authentication**: Protected endpoints enforce the `X-Internal-Service-Key` header.
3. **Database Write Boundary**: Python AI service is restricted from mutating core business tables (`users`, `products`, `orders`, `order_items`, `payments`, `delivery_pricing_rules`, `otp_verifications`). It manages only AI subsystem tables (`ai_*`).
4. **Human Confirmation Mandate**: Mutation actions prepare short-lived cryptographic proposals; execution requires explicit button confirmation on the user interface.

---

## 7. Running Tests

```bash
$env:PYTHONPATH = "d:\MWTEL\myi-react-app\backend\ai-python"
& "d:\MWTEL\myi-react-app\backend\ai-python\venv\Scripts\python.exe" -m pytest "backend/ai-python/tests"
```
