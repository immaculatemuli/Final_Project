# 🎓 Intellicode — Master Presentation & Defense Guide
### Mount Kenya University | Final Year Project

---

## 📺 PART 1: THE DEMO (How to present the system)

### **Step 1: The Landing Page (The "First Impression")**
- **Action**: Open the website and scroll through the "Hero" section.
- **What to say**: "Intellicode is an AI-powered code quality analysis platform. It helps developers catch bugs, fix security vulnerabilities, and understand complex code in seconds."

### **Step 2: Sign In (The Security)**
- **Action**: Click the "Sign In" button and use Google.
- **What to say**: "We use **Firebase Authentication** for secure Google logins. User data and history are stored safely in **Firebase Firestore**."

### **Step 3: Multi-Input (The Versatility)**
- **Action**: Show the 4 tabs: Paste, Upload, Folder, GitHub.
- **What to say**: "We are more flexible than other tools. You can analyze a single snippet, a local project folder, or even a live **GitHub repository** without downloading it."

### **Step 4: AI Analysis & Risk Radar**
- **Action**: Click **"Analyze Code"** and point to the **Radar Chart**.
- **What to say**: "The AI doesn't just find bugs; it generates a **Risk Radar Chart**. This gives a visual score for Security, Readability, and Performance."

### **Step 5: Junior Mode (Explain to Junior)**
- **Action**: Click the **"Junior Mode"** button.
- **What to say**: "We have a unique **Junior Mode**. If a piece of code is too complex, the AI breaks it down into simple English, explaining the purpose, logic, and key points for a student or junior developer."

### **Step 6: Interactive Editor & Auto-Fix**
- **Action**: Click **"Auto-Fix"**.
- **What to say**: "This is the most powerful feature. We have an **Interactive Editor**. The AI doesn't just tell you what's wrong—it **rewrites the code** correctly for you and shows a side-by-side comparison."

### **Step 7: AI Chat Assistant**
- **Action**: Open the **Floating Chat Icon** in the bottom corner.
- **What to say**: "If you have a specific question, you can **chat with the AI**. It knows your code and can give custom advice in real-time."

---

## 🛠️ PART 2: THE TECHNICAL DEFENSE (For the Panel)

### 1. The Technology Stack
| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Tailwind CSS |
| **Backend** | Vercel Serverless Functions (`/api/*.js`) |
| **Database** | Firebase Firestore (NoSQL Document Database) |
| **Authentication** | Firebase Auth (Google Sign-In) |
| **AI Models** | Groq (Llama 3.3-70B) & OpenAI (GPT-4o-mini) |
| **Email** | Nodemailer (for Analysis Reports) |

### 2. The Database (Firestore)
- **Structure**: It is **NoSQL**. We use "Collections" instead of tables.
- **Key Collection**: `analyses`. It stores the code snippet, the score, and the array of issues found.
- **Why NoSQL?**: "Because our data is hierarchical. One analysis has many bugs. In SQL, this requires complex joins. In NoSQL, it's one single document, which is faster and easier to scale."

### 3. The Dual-Engine Analyzer (CRITICAL)
If they ask how it works, explain the two engines:
1.  **Static Engine (`codeAnalysis.ts`)**: Uses Regular Expressions to find "known" bugs instantly (like missing semicolons or hardcoded passwords).
2.  **AI Engine (`api/analyzeCode.js`)**: Uses an LLM to understand the *meaning* of the code. It finds logic bugs that a regex can never see.

### 4. Folder Structure Map
- **`src/components/`**: The UI components (Buttons, Panels).
- **`src/services/`**: The logic (Talking to AI and Firebase).
- **`api/`**: The serverless backend functions (The Brain).
- **`functions/`**: Background tasks like sending emails.

### 5. Likely Panel Questions & Answers
- **Q: How is it different from Copilot?**
  - *A: Copilot helps you **write** code. Intellicode **reviews** and **teaches** code. We focus on quality and education (Junior Mode).*
- **Q: Is the data secure?**
  - *A: Yes. All API keys are hidden on the server (Vercel). The browser never sees the keys. We also use Rate Limiting to prevent abuse.*
- **Q: Why use Groq and OpenAI?**
  - *A: Groq is ultra-fast. We use it for speed. We keep OpenAI as a fallback to ensure the system never goes down.*

---

## 📊 KEY METRICS EXPLAINED
- **Overall Score (0-100)**: A weighted average of all metrics.
- **Cyclomatic Complexity**: Measures the number of independent paths through your code (if statements, loops). High = hard to test.
- **Technical Debt**: The estimated hours required to fix all identified bugs.

---
*This guide covers everything. Good luck, Immaculate!*
