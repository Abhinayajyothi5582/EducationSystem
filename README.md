# 🎓 SkillBridge – Verified Student-to-Student Skill Exchange Platform

> **"You teach what you know, and learn what you need."**  
> *Zero course fees, 100% verified peer-to-peer learning.*

---

## 🌟 Executive Summary
SkillBridge is a student-to-student learning platform designed to eliminate financial barriers to higher education and practical skills training. Instead of paying expensive course fees to commercial bootcamps, students teach each other:

- **Abhi** knows **Java** but wants to learn **UI/UX Design**.
- **Rahul** knows **UI/UX Design** but wants to learn **Java**.
- **SkillBridge connects both students.** Abhi teaches Java, and Rahul teaches UI/UX Design. Both gain verified knowledge with **zero monetary exchange**!
- **Priya** teaches **Python** and wants **Java**; SkillBridge pairs her with Abhi as a verified tutor, powered by learning credits!

---

## 🚀 Key Modules Built & Implemented

### 1. Module 1: Student Registration & Authentication
- **Full Student Profile:** Name, Email, College Name, Department / Course, Bio, and Avatar.
- **Security:** Salted PBKDF2 cryptographic password hashing and HMAC-signed JWT authentication.
- **Welcome Bonus:** Every newly registered student automatically receives **100 Free Learning Credits** in their digital wallet.
- **Instant Hackathon Persona Switcher:** 1-click switcher between **Abhi (IIT Delhi)**, **Rahul (NID Ahmedabad)**, and **Priya (BITS Pilani)** for live demonstrations.

### 2. Module 2: Student Skill Profile
- **Two Distinct Sections:**
  - **Skills I Can Teach:** Displays subject, category, declared proficiency (Beginner to Expert), and official **VERIFIED** badge.
  - **Skills I Want to Learn:** Target topics used by the matching engine to find complementary peers.
- **Interactive Skill Management:** Dynamically add, update, or remove skills with categories (Frontend, Backend, Design, Data & AI, Database, DevOps).

### 3. Module 3: Smart Skill Matching Engine
- **Bi-directional Reciprocity Algorithm:**
  ```java
  if (studentA.getTeachingSkills().contains(studentB.getLearningSkill()) && 
      studentB.getTeachingSkills().contains(studentA.getLearningSkill())) {
      System.out.println("Perfect Skill Match Found!");
  }
  ```
- **Match Compatibility Percentage (0–99%):**
  - Two-Way Reciprocal Partner Match: **+55%**
  - Verified Skill Badge (80%+ Assessment Score): **+20%**
  - Campus / College Synergy: **+15%**
  - Top-Rated Mentor (4.8★+): **+10%**
- **Match Reasoning Breakdown:** Explains why two students are compatible before booking.

### 4. Module 4: Session Booking & Exchange Manager
- **Full Booking Lifecycle:** Send learning request, specify date, time slot, duration (30/45/60/90 mins), and topic notes.
- **Teacher Actions:** Accept or Decline requests (declining automatically refunds held escrow credits).
- **Interactive Live Session Room Simulator:**
  - Real-time synchronized countdown timer.
  - Split simulated video streams (Teacher speaking, Learner listening).
  - Collaborative session scratchpad & code notes.
  - **Mutual Completion Confirmation:** Dual confirmation buttons ensuring credits transfer only when both participants confirm.

### 5. Module 5: Skill Exchange Credit Economy
- **Core Rule:** `1 completed teaching minute = 1 learning credit` (e.g. 60-minute session = 60 credits).
- **Escrow Protection:** Credits are temporarily locked in escrow upon request so tutors are guaranteed payout upon session finish.
- **Mutual Release:** Once both students click "Confirm Session Complete", credits are transferred directly to the teacher's wallet.
- **Immutable Transaction Ledger:** Complete audit trail of welcome bonuses, escrow holds, teaching earnings, and refunds.
- **Hackathon Test Faucet:** Built-in faucet button to grant +50 practice credits during demo presentations.

### 6. Module 6: Ratings & Verified Skill Portfolio ("Learning Passport")
- **Official Learning Passport:** Digital credential displaying Credential ID, verified teaching hours, total students helped, and average star rating.
- **Interactive Skill Verification Assessment:** Built-in 5-question technical quizzes (Java, UI/UX, Python, React, SQL). Scoring 80%+ awards the official **VERIFIED** badge on their profile and passport!
- **Peer Endorsements:** Star ratings (1–5) and written feedback logged after every completed session.
- **Print / PDF Ready:** Clean printable passport layout ready for resumes and LinkedIn portfolios.

### 7. Standout Feature: Smart Learning Gap Finder
- Select a target career goal (e.g., *Full-Stack Java Enterprise Developer*, *AI & Machine Learning Engineer*, *UI/UX Product Designer*).
- Analyzes acquired vs. missing competencies.
- Recommends direct 1-click booking with verified student peers who teach the missing skills!

---

## 🛠️ Technology Architecture

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Modern Responsive SPA, Tailwind CSS, FontAwesome 6, Canvas Confetti |
| **Live Backend** | Node.js (v26.13.0 native), Native `node:sqlite` DatabaseSync, Web Cryptography |
| **Java Full-Stack Companion** | Complete Spring Boot 3.2+ Maven project (`backend-java/`), Spring Data JPA, Spring Security, JWT, MySQL `schema.sql` |
| **Database Schema** | 6 relational tables: `students`, `skills`, `student_skills`, `bookings`, `credits`, `reviews` |

---

## 🏃 Quick Start Guide

### 1. Launch Web Application (Instant)
Double-click `run.bat` or run in terminal:
```bash
cd skillbridge
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 2. Hackathon Demo Workflow (Judge Presentation)
1. **View Dashboard:** Notice Abhi's profile (Teaches Java, Wants UI/UX) and the highlighted **98% reciprocal match** with Rahul!
2. **Find Partners Tab:** Inspect the Smart Matching Engine ranking Rahul at the top with the **PERFECT 2-WAY MATCH** badge.
3. **Take a Skill Quiz:** Go to *My Skills*, click "Take Quiz to Verify" for Java or UI/UX, score 80%+, and watch the confetti celebrate your new **VERIFIED** badge!
4. **Enter Live Room:** Go to *Sessions*, click "Enter Live Room" on the upcoming session, watch the countdown timer, collaborate in the scratchpad, and click **"1-Click Mutual Finish & Transfer Credits"**!
5. **Inspect Wallet:** Go to *My Credits* and see the 60 credits transferred to the teacher with the full ledger audit log!
6. **Export Learning Passport:** Go to *Learning Passport* to see the official verified credential ID and printable portfolio!
7. **Try Gap Finder:** Open *Gap Finder*, select a career roadmap, and see your readiness score and peer mentors!

---

## 📂 Project Structure
```text
skillbridge/
├── server.js                   # Node.js + SQLite REST Backend & Static Server
├── package.json                # Project configuration
├── run.bat                     # 1-Click launcher
├── data/
│   └── skillbridge.db          # Persistent SQLite database
├── public/
│   ├── index.html              # Full single-page application UI
│   ├── app.js                  # Frontend client logic & API bindings
│   └── style.css               # Glassmorphic custom styling & print CSS
└── backend-java/               # Complete Spring Boot 3.2 Java Codebase
    ├── pom.xml                 # Maven build file with JPA, Security, MySQL
    └── src/
        ├── main/resources/
        │   ├── application.properties
        │   └── schema.sql      # MySQL schema for the 6 core tables
        └── main/java/com/skillbridge/
            ├── SkillBridgeApplication.java
            ├── model/          # Student, Booking, Credit, Skill entities
            ├── repository/     # Spring Data JPA repositories
            └── service/
                ├── MatchingAlgorithmService.java   # Reciprocal 2-way matching logic
                └── BookingCreditService.java       # Session booking & credit escrow
```
