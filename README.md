# 🏰 BrainCastle — Modern Quiz Application

> Designed and engineered for **codeapostle1**. Built with traditional, clean HTML5, CSS3, Vanilla JavaScript (ES6+), Node.js, Express.js, and SQLite (`better-sqlite3`).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **npm** v9+

### 2. Installation & Setup
```bash
# Clone or navigate to the project directory
cd "c:\Users\USER\Desktop\Kasu quiz"

# Install dependencies (only 5 core, beginner-friendly packages)
npm install
```

### 3. Running the Application
```bash
# Production / Standard run:
npm start

# Development mode (with auto-restart on changes):
npm run dev
```

Visit the application in your browser:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Default Creator Credentials

| Role | Email | Password | Author / Display Name |
| :--- | :--- | :--- | :--- |
| **Creator** | `creator@example.com` | `password123` | **`codeapostle1`** |

You can also register brand-new creator accounts directly on the [Registration Page](http://localhost:3000/login.html).

---

## ✨ Features & Architecture

### 1. Public Quiz Discovery
- **Rebranded & Polished**: Clean modern design with rich indigo and emerald accents.
- **Header & Navigation**: Elegant brand logo with a dedicated **hamburger menu** that prevents button squeezing across small and large screens.
- **Search & Filter**: Real-time debounced keyword search and category pills (*Web Development*, *Computer Science*, *General Science*, *World History*).
- **Quiz Cards**: Display covers, categories, `✨ New` badges, question counts, creation dates, and author credits.

### 2. Interactive Quiz Engine
- **Customizable Quiz Timer**:
  - Choose whether to enable a timer or play untimed.
  - Set quick presets (**1m, 2m, 5m, 10m, 15m**) or any **custom duration** (e.g. 7 minutes).
  - Live countdown widget with color warnings (amber under 60s, red under 20s) and automatic submission when time expires.
- **Question Count & Shuffle**: Attempt any subset of questions, and choose between randomized order or original creator order.
- **Centered Zero-Scroll Viewport**:
  - Precision single-screen layout on both mobile phones and desktop displays.
  - Options, question text, hint drawers, and navigation controls (`Prev`, `Q X of Y`, `Next` / `Submit`) fit cleanly on screen without vertical scrolling.
- **Keyboard Shortcuts**: Select options with `1-4` or `A-D`; navigate questions with `←` and `→` arrow keys.
- **Submission Guard**: Confirmation modal shows answered vs. unanswered counts and prevents double-clicks.

### 3. Server-Side Evaluation & Results
- **Anti-Cheat Design**: Correct answers (`is_correct`) are never delivered to the client during gameplay. All scoring is calculated on the server.
- **Animated Circular Score Meter**: Smooth SVG percentage ring color-coded by mastery (Green $\ge 80\%$, Amber $\ge 50\%$, Red $< 50\%$).
- **Filterable Review**: Filter cards by **All**, **Incorrect**, or **Correct** to inspect the correct choices alongside detailed explanations.
- **Smart Replay**: Restarts the quiz with your exact previous settings (re-shuffling questions if shuffle was enabled).

### 4. Creator Studio (Admin Dashboard)
- **Protected Sessions**: Secure `httpOnly` server-side sessions powered by `express-session` and `bcryptjs` password hashing.
- **Collection Management**: Create, edit, and delete quiz collections with categories, descriptions, and cover images.
- **Publish / Unpublish Toggle**: Drafts stay hidden until published; published quizzes appear immediately on the public homepage.
- **Organized Question Editor**:
  - Add, edit, and delete questions without full page reloads.
  - Radio selector for the correct answer, option text inputs, optional hints, and solution explanations.
- **Quiz Preview Mode**: Walk through questions and verify answers before publishing live.

---

## 🗄 Database Design (SQLite)

The database schema (`src/db/schema.sql`) enforces relational integrity with `PRAGMA foreign_keys = ON;`:
- `users`: Creator accounts & bcrypt hashes
- `categories`: Topic classifications
- `collections`: Quiz collections owned by creators
- `questions`: Individual quiz items belonging to collections
- `options`: Multiple-choice answers belonging to questions
- `quiz_attempts`: Persistent attempt scoring records
- `quiz_attempt_answers`: Detailed question-level answer breakdown for reviews

---

## 📁 Project Structure

```text
c:\Users\USER\Desktop\Kasu quiz\
├── server.js               # Express application entrypoint
├── package.json            # Scripts & dependencies
├── .env                    # Environment configuration
├── data/
│   └── quiz.db             # SQLite database file (WAL mode enabled)
├── src/
│   ├── config.js           # Configuration loader
│   ├── db/
│   │   ├── database.js     # SQLite connection & WAL mode
│   │   ├── schema.sql      # 7 Relational SQLite tables & indexes
│   │   └── seed.js         # Seeder for demo collections & codeapostle1
│   ├── middleware/
│   │   └── auth.js         # Session authentication guards
│   └── routes/
│       ├── auth.js         # Register, Login, Logout, Me
│       ├── categories.js   # Category listing
│       ├── collections.js  # Public & Creator CRUD collections
│       ├── questions.js    # Creator CRUD questions & options
│       └── quiz.js         # Start session, submit & evaluate, review
└── public/
    ├── index.html          # Public Homepage
    ├── quiz.html           # Centered Zero-Scroll Quiz Player
    ├── results.html        # Score & Detailed Answer Review
    ├── login.html          # Creator Sign In & Registration
    ├── admin.html          # Creator Studio Dashboard
    ├── css/
    │   ├── base.css        # Typography, colors, transitions
    │   ├── components.css  # Buttons, modals, hamburger drawer, cards
    │   ├── quiz.css        # Centered viewport player & results
    │   └── admin.css       # Creator dashboard & question manager
    └── js/
        ├── api.js          # Fetch client wrapper
        ├── utils.js        # Alerts, escaping, formatting
        ├── app.js          # Homepage controller & modal
        ├── quiz.js         # Quiz player & countdown timer
        ├── results.js      # Results & circular meter
        ├── auth.js         # Login/register controller
        └── admin.js        # Creator studio controller
```

---

## 👤 Author
Developed by **[codeapostle1](https://github.com/codeapostle1)**.
