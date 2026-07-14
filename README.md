# Hybrid Brand Logo Retrieval and Verification System

A full-stack AI-powered Brand Logo Retrieval System that retrieves and verifies brand logos using semantic image search and computer vision techniques.

The system combines **OpenCLIP**, **FAISS**, **EasyOCR**, **ORB**, and **Template Normalized Cross-Correlation (NCC)** to provide accurate logo retrieval and verification through an interactive web interface.

---

## Features

- Semantic logo retrieval using OpenCLIP
- Fast vector similarity search using FAISS
- OCR-based brand name verification
- ORB feature matching for logo verification
- Template NCC verification for simple logos
- Rule-based hybrid decision logic
- Workflow comparison visualization
- Detailed retrieval analysis
- Responsive React frontend
- FastAPI backend

---

## Technologies Used

### Frontend
- React.js
- JavaScript
- CSS

### Backend
- Python
- FastAPI

### AI & Computer Vision
- OpenCLIP (ViT-B/32)
- EasyOCR
- OpenCV
- FAISS
- ORB
- Template NCC

### Database
- SQLite

---

## Project Structure

```
Logo-Retrieval/
│
├── backend/
│   ├── main.py
│   ├── search.py
│   ├── preprocess.py
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── data/
│   ├── logos.db
│   ├── faiss_index.bin
│   ├── faiss_meta.pkl
│   └── ground-truth.json
│
├── templates/
│   ├── BurgerKing/
│   ├── McDonalds/
│   └── ...
│
└── README.md
```

---

## Retrieval Pipeline

```
User Query
      │
      ▼
OpenCLIP Text Embedding
      │
      ▼
FAISS Similarity Search
      │
      ▼
Candidate Images
      │
 ┌────┼─────┐
 ▼    ▼     ▼
OCR  ORB   NCC
 └────┼─────┘
      ▼
Decision Logic
      ▼
Ranked Results
```

---

## How to Run

### 1. Clone the Repository

```bash
git clone https://github.com/<username>/<repository-name>.git

cd Logo-Retrieval
```

---

### 2. Backend Setup

Navigate to the backend folder.

```bash
cd backend
```

Create a virtual environment.

```bash
python -m venv venv
```

Activate it.

Windows

```bash
venv\Scripts\activate
```

Linux / Mac

```bash
source venv/bin/activate
```

Install dependencies.

```bash
pip install -r requirements.txt
```

Run the backend.

```bash
uvicorn main:app --reload
```

Backend runs on

```
http://127.0.0.1:8001
```

---

### 3. Frontend Setup

Open another terminal.

```bash
cd frontend
```

Install packages.

```bash
npm install
```

Run React.

```bash
npm run dev
```

Frontend runs on

```
http://localhost:5173
```

---

## Required Files

The backend requires the following generated files inside the **data** directory.

```
logos.db
faiss_index.bin
faiss_meta.pkl
ground-truth.json
```

If these files are missing, execute the preprocessing script to generate them.

```bash
python preprocess.py
```

---

## Dataset

The project uses

- Food Logo Dataset (Kaggle)
- Additional logo images collected using a Python web scraping script

Total dataset:

- **936 brands**
- **23,110 images**
- Approximately **25 images per brand**

---

## API Endpoints

### Search

```
POST /search
```

Search logos using a brand name.

---

### Compare

```
POST /compare
```

Displays intermediate retrieval stages.

---

### Metrics

```
GET /metrics
```

Returns retrieval statistics.

---

## Workflow Comparison

The comparison interface displays every stage of the retrieval process.

1. CLIP Visual Analysis
2. OCR Text Detection
3. ORB Verification
4. Template NCC Verification
5. Hybrid Score Calculation
6. Final Decision

---

## Results

The system displays

- Ranked logo images
- CLIP similarity
- OCR verification
- ORB keypoint matches
- NCC score
- Hybrid score
- Final decision
- Workflow visualization

---

## References

- OpenCLIP
- FastAPI
- React
- OpenCV
- FAISS
- EasyOCR
- SQLite

---

## Author

**Kiruthiga J**

B.Tech Information Technology

College of Engineering Guindy (Anna University)

Internship Project – Alpha Cloud Labs
