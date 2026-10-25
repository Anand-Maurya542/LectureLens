# Local Setup & Development Guide

This guide walks you through setting up and running **LectureLens** on your local machine.

---

## 1. Prerequisites

Ensure the following tools are installed:

| Tool | Minimum Version | Installation Check | Notes |
| :--- | :--- | :--- | :--- |
| **Python** | 3.9+ (tested on 3.9.6) | `python3 --version` | Standard Python runtime |
| **Node.js** | 18.0+ | `node --version` | Required for React & Vite |
| **npm** | 9.0+ | `npm --version` | Node package manager |
| **FFmpeg** | 5.0+ | `ffmpeg -version` | Required for media extraction |
| **Git** | 2.20+ | `git --version` | Version control |

### Installing FFmpeg:
- **macOS (Homebrew)**:
  ```bash
  brew install ffmpeg
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt update && sudo apt install -y ffmpeg
  ```
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add `bin` to your system `PATH`.

---

## 2. Setting Up the Backend (Terminal 1)

### 1. Open Terminal & Navigate to `backend/`:
```bash
cd /Users/ananadmauya/Projects/lecturelens/backend
```

### 2. Create and Activate Virtual Environment:
```bash
# If .venv doesn't exist, create it:
python3 -m venv .venv

# Activate on macOS / Linux (zsh or bash):
source .venv/bin/activate

# (On Windows PowerShell: .venv\Scripts\Activate.ps1)
```

### 3. Install Dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables:
Copy the example environment file:
```bash
cp ../.env.example .env
```
Open `backend/.env` in your editor. For offline local development, you can leave `MONGODB_URI=` empty—the backend will automatically use its built-in development fallback (`mongomock-motor`).

To connect to your real MongoDB Atlas cluster, set:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=lecturelens_db
```

### 5. Start the FastAPI Server:
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
*(Ensure there are spaces before `--reload`, `--host`, and `--port`)*

Verify that the terminal outputs:
```text
[INFO] lecturelens.database: Connected to database
[INFO] lecturelens.auth: Default seed users and demo course initialized.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

## 3. Setting Up the Frontend (Terminal 2)

In a new terminal window:

### 1. Navigate to `frontend/`:
```bash
cd /Users/ananadmauya/Projects/lecturelens/frontend
```

### 2. Install Dependencies:
```bash
npm install
```

### 3. Start the Development Server:
```bash
npm run dev
```

The application will be live at: **`http://localhost:5173`**

---

## 4. Verification & Testing the Main Workflows

Open `http://localhost:5173` in your browser. The login screen provides **1-Click Demo Accounts**:

### A. Instructor Workflow:
1. Click **Prof. Sharma (Instructor)** to log in automatically.
2. Go to **Courses** $\rightarrow$ create a new course (e.g. `CS502`). Copy the enrollment code.
3. Go to **Add Lecture** $\rightarrow$ paste a YouTube link (e.g., `https://www.youtube.com/watch?v=kCc8FmEb1nY`) or upload an audio/video file. Click consent and submit.
4. On the **Review** page, view the transcript. Click the pencil icon on any segment to test live corrections.
5. Click **Approve & Publish to Students**.
6. Go to **Quiz Review** and click **Approve for Students** on candidate questions.

### B. Student Workflow:
1. Log out, then click **Priya Verma (Student)**.
2. Enroll in your course using code **`CS401`** (or your newly created code).
3. Open the lecture $\rightarrow$ click any timestamp in the transcript to verify that the video player seeks to that exact moment.
4. Go to **Atlas Search & Q&A** $\rightarrow$ test searching for terms like *"attention mechanism"* or asking *"What replaces recurrence?"*.
5. Take the section quiz and view your personalized revision plan.

---

## 5. Shutting Down the Servers

In each terminal window, press:
```text
CTRL + C
```
To deactivate the Python virtual environment in Terminal 1:
```bash
deactivate
```

