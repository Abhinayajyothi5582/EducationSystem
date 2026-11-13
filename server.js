// server.js - SkillBridge: Verified Peer-to-Peer Skill Exchange Platform
// Fully self-contained backend using Node.js built-ins and official node:sqlite
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'skillbridge.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new DatabaseSync(DB_PATH);

// Create tables according to Hackathon specification
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    college TEXT NOT NULL,
    department TEXT NOT NULL,
    bio TEXT,
    avatar TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skills (
    skill_id TEXT PRIMARY KEY,
    skill_name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS student_skills (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    skill_type TEXT NOT NULL, -- 'TEACH' or 'LEARN'
    proficiency TEXT NOT NULL, -- 'Beginner', 'Intermediate', 'Advanced', 'Expert'
    verified INTEGER DEFAULT 0,
    verified_at TEXT,
    verified_score INTEGER DEFAULT 0,
    verification_method TEXT,
    FOREIGN KEY(student_id) REFERENCES students(student_id),
    FOREIGN KEY(skill_id) REFERENCES skills(skill_id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    booking_id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    session_date TEXT NOT NULL,
    session_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    credit_amount INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'PENDING', 'ACCEPTED', 'REJECTED', 'IN_SESSION', 'COMPLETED', 'CANCELLED'
    meeting_link TEXT,
    notes TEXT,
    teacher_confirmed INTEGER DEFAULT 0,
    learner_confirmed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS credits (
    credit_id TEXT PRIMARY KEY,
    student_id TEXT UNIQUE NOT NULL,
    balance INTEGER NOT NULL DEFAULT 100,
    escrow_balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    txn_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'WELCOME_BONUS', 'TEACHING_EARNED', 'SESSION_ESCROW', 'ESCROW_RELEASED', 'ESCROW_REFUNDED', 'PRACTICE_GRANT'
    booking_id TEXT,
    description TEXT NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    review_id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    reviewee_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    skills_tagged TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS badges (
    badge_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    badge_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    awarded_at TEXT NOT NULL
  );
`);

// Password hashing utilities
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const result = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  return result === hash;
}

// Token simulation (HMAC signed)
const JWT_SECRET = 'skillbridge-hackathon-2026-secret-key';
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Seed Initial Data if empty
function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (count > 0) return;

  console.log('[SkillBridge] Seeding initial database with sample students, skills, and sessions...');

  // 1. Insert master skills
  const skills = [
    { id: 'skill_java', name: 'Java', category: 'Backend', icon: 'fa-brands fa-java', desc: 'Core Java, OOP, Collections, Concurrency & JVM' },
    { id: 'skill_uiux', name: 'UI/UX Design', category: 'Design', icon: 'fa-solid fa-bezier-curve', desc: 'Design systems, Wireframing, Figma, User Research' },
    { id: 'skill_python', name: 'Python', category: 'Data & AI', icon: 'fa-brands fa-python', desc: 'Python syntax, data manipulation, automation & scripts' },
    { id: 'skill_react', name: 'React.js', category: 'Frontend', icon: 'fa-brands fa-react', desc: 'React Hooks, Virtual DOM, State Management & Tailwind' },
    { id: 'skill_html_css', name: 'HTML & CSS', category: 'Frontend', icon: 'fa-brands fa-html5', desc: 'Semantic HTML5, CSS Grid, Flexbox, Responsive Web Design' },
    { id: 'skill_sql', name: 'SQL & Databases', category: 'Database', icon: 'fa-solid fa-database', desc: 'Relational schema design, complex joins, indexing & ACID' },
    { id: 'skill_springboot', name: 'Spring Boot', category: 'Backend', icon: 'fa-solid fa-leaf', desc: 'REST APIs, Spring Data JPA, Security & Microservices' },
    { id: 'skill_ml', name: 'Machine Learning', category: 'Data & AI', icon: 'fa-solid fa-brain', desc: 'Scikit-learn, Neural Networks, Supervised & Unsupervised' },
    { id: 'skill_figma', name: 'Figma Prototyping', category: 'Design', icon: 'fa-brands fa-figma', desc: 'Interactive prototypes, component variants & micro-animations' },
    { id: 'skill_docker', name: 'Docker & DevOps', category: 'DevOps', icon: 'fa-brands fa-docker', desc: 'Containerization, Docker Compose, CI/CD pipeline basics' },
    { id: 'skill_dsa', name: 'Data Structures & Algorithms', category: 'Core CS', icon: 'fa-solid fa-code-branch', desc: 'Trees, Graphs, Dynamic Programming & Complexity Analysis' }
  ];

  const insertSkill = db.prepare('INSERT INTO skills (skill_id, skill_name, category, icon, description) VALUES (?, ?, ?, ?, ?)');
  for (const s of skills) {
    insertSkill.run(s.id, s.name, s.category, s.icon, s.desc);
  }

  // 2. Insert students (Abhi, Rahul, Priya, Kavya, Aman)
  const defaultPw = hashPassword('password123');

  const students = [
    {
      id: 'std_abhi',
      name: 'Abhi Sharma',
      email: 'abhi@skillbridge.edu',
      college: 'IIT Delhi',
      department: 'Computer Science & Engineering',
      bio: 'Final year CS undergrad passionate about backend systems, distributed databases, and Java. Eager to master modern UI/UX design to build beautiful full-stack web products.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'std_rahul',
      name: 'Rahul Verma',
      email: 'rahul@skillbridge.edu',
      college: 'NID Ahmedabad',
      department: 'Interaction & Product Design',
      bio: 'Design enthusiast with 3 years of Figma & human-computer interaction experience. Currently designing SaaS platforms and wanting to learn Java and backend fundamentals.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'std_priya',
      name: 'Priya Nair',
      email: 'priya@skillbridge.edu',
      college: 'BITS Pilani',
      department: 'Software Engineering & AI',
      bio: 'Data science & Python researcher working on NLP and machine learning. Looking for strong Java and Spring Boot mentors for enterprise software engineering.',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'std_kavya',
      name: 'Kavya Patel',
      email: 'kavya@skillbridge.edu',
      college: 'DTU Delhi',
      department: 'Information Technology',
      bio: 'Backend developer specializing in Spring Boot microservices and Docker containers. Looking to learn Machine Learning and Python data pipelines.',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'std_aman',
      name: 'Aman Gupta',
      email: 'aman@skillbridge.edu',
      college: 'IIIT Hyderabad',
      department: 'Robotics & Artificial Intelligence',
      bio: 'AI researcher working on computer vision. Wants to learn SQL schema design and React frontend development.',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
    }
  ];

  const insertStudent = db.prepare(`
    INSERT INTO students (student_id, name, email, password_hash, salt, college, department, bio, avatar, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const st of students) {
    insertStudent.run(st.id, st.name, st.email, defaultPw.hash, defaultPw.salt, st.college, st.department, st.bio, st.avatar, now);
  }

  // 3. Insert student skills
  const studentSkills = [
    // Abhi: Teaches Java (Verified 95), SQL (Verified 90); Wants: UI/UX, React.js
    { id: 'ss_1', student_id: 'std_abhi', skill_id: 'skill_java', type: 'TEACH', prof: 'Expert', verified: 1, score: 95, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_2', student_id: 'std_abhi', skill_id: 'skill_sql', type: 'TEACH', prof: 'Advanced', verified: 1, score: 90, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_3', student_id: 'std_abhi', skill_id: 'skill_uiux', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },
    { id: 'ss_4', student_id: 'std_abhi', skill_id: 'skill_react', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },

    // Rahul: Teaches UI/UX (Verified 98), Figma (Verified 94); Wants: Java, Python
    { id: 'ss_5', student_id: 'std_rahul', skill_id: 'skill_uiux', type: 'TEACH', prof: 'Expert', verified: 1, score: 98, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_6', student_id: 'std_rahul', skill_id: 'skill_figma', type: 'TEACH', prof: 'Expert', verified: 1, score: 94, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_7', student_id: 'std_rahul', skill_id: 'skill_java', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },
    { id: 'ss_8', student_id: 'std_rahul', skill_id: 'skill_python', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },

    // Priya: Teaches Python (Verified 92), ML; Wants: Java, Spring Boot
    { id: 'ss_9', student_id: 'std_priya', skill_id: 'skill_python', type: 'TEACH', prof: 'Expert', verified: 1, score: 92, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_10', student_id: 'std_priya', skill_id: 'skill_ml', type: 'TEACH', prof: 'Advanced', verified: 1, score: 88, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_11', student_id: 'std_priya', skill_id: 'skill_java', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },
    { id: 'ss_12', student_id: 'std_priya', skill_id: 'skill_springboot', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },

    // Kavya: Teaches Spring Boot (Verified 90), Docker; Wants: ML, Python
    { id: 'ss_13', student_id: 'std_kavya', skill_id: 'skill_springboot', type: 'TEACH', prof: 'Advanced', verified: 1, score: 90, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_14', student_id: 'std_kavya', skill_id: 'skill_docker', type: 'TEACH', prof: 'Intermediate', verified: 0, score: 0, method: null },
    { id: 'ss_15', student_id: 'std_kavya', skill_id: 'skill_ml', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },
    { id: 'ss_16', student_id: 'std_kavya', skill_id: 'skill_python', type: 'LEARN', prof: 'Intermediate', verified: 0, score: 0, method: null },

    // Aman: Teaches ML (Verified 96), Python; Wants: SQL, React.js
    { id: 'ss_17', student_id: 'std_aman', skill_id: 'skill_ml', type: 'TEACH', prof: 'Expert', verified: 1, score: 96, method: 'SkillBridge Verified Assessment' },
    { id: 'ss_18', student_id: 'std_aman', skill_id: 'skill_sql', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null },
    { id: 'ss_19', student_id: 'std_aman', skill_id: 'skill_react', type: 'LEARN', prof: 'Beginner', verified: 0, score: 0, method: null }
  ];

  const insertStudentSkill = db.prepare(`
    INSERT INTO student_skills (id, student_id, skill_id, skill_type, proficiency, verified, verified_at, verified_score, verification_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ss of studentSkills) {
    insertStudentSkill.run(ss.id, ss.student_id, ss.skill_id, ss.type, ss.prof, ss.verified, ss.verified ? now : null, ss.score, ss.method);
  }

  // 4. Initial Credits & Transactions
  const insertCredit = db.prepare('INSERT INTO credits (credit_id, student_id, balance, escrow_balance, total_earned, total_spent, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertTxn = db.prepare('INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  const creditSeeds = [
    { std: 'std_abhi', balance: 180, earned: 120, spent: 40 },
    { std: 'std_rahul', balance: 120, earned: 60, spent: 40 },
    { std: 'std_priya', balance: 90, earned: 0, spent: 10 },
    { std: 'std_kavya', balance: 140, earned: 40, spent: 0 },
    { std: 'std_aman', balance: 100, earned: 0, spent: 0 }
  ];

  for (const c of creditSeeds) {
    insertCredit.run('c_' + c.std, c.std, c.balance, 0, c.earned, c.spent, now);
    insertTxn.run('txn_init_' + c.std, c.std, 100, 'WELCOME_BONUS', null, 'SkillBridge Welcome Bonus - 100 Free Learning Credits', 100, now);
    if (c.earned > 0) {
      insertTxn.run('txn_earn_' + c.std, c.std, c.earned, 'TEACHING_EARNED', null, `Earned ${c.earned} credits for verified peer mentoring sessions`, 100 + c.earned, now);
    }
  }

  // 5. Insert completed booking & reviews
  const insertBooking = db.prepare(`
    INSERT INTO bookings (booking_id, teacher_id, learner_id, skill_id, topic, session_date, session_time, duration_minutes, credit_amount, status, meeting_link, notes, teacher_confirmed, learner_confirmed, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Past completed booking: Rahul taught Abhi UI/UX Design (60 mins = 60 credits)
  insertBooking.run(
    'bk_completed_1',
    'std_rahul',
    'std_abhi',
    'skill_uiux',
    'Figma Component Architecture & Design Tokens',
    '2026-11-10',
    '16:00',
    60,
    60,
    'COMPLETED',
    'https://meet.skillbridge.edu/room/rahul-abhi-uiux',
    'Deep dive into auto-layout, design tokens, and preparing handoffs for developers.',
    1,
    1,
    now,
    now
  );

  // Past completed booking: Abhi taught Priya Java Collections (60 mins = 60 credits)
  insertBooking.run(
    'bk_completed_2',
    'std_abhi',
    'std_priya',
    'skill_java',
    'Java Collections, Concurrency & Streams API',
    '2026-11-11',
    '18:30',
    60,
    60,
    'COMPLETED',
    'https://meet.skillbridge.edu/room/abhi-priya-java',
    'Covered HashMap collision resolution, ForkJoinPool, and practical stream pipelines.',
    1,
    1,
    now,
    now
  );

  // Active upcoming booking: Abhi teaches Rahul Java
  insertBooking.run(
    'bk_upcoming_1',
    'std_abhi',
    'std_rahul',
    'skill_java',
    'Java Core Fundamentals & OOP for UI Designers',
    '2026-11-15',
    '17:00',
    60,
    60,
    'ACCEPTED',
    'https://meet.skillbridge.edu/room/abhi-rahul-java-live',
    'First exchange session: translating design systems into clean Java class hierarchies.',
    0,
    0,
    now,
    null
  );

  // Reviews
  const insertReview = db.prepare(`
    INSERT INTO reviews (review_id, booking_id, reviewer_id, reviewee_id, rating, feedback, skills_tagged, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReview.run(
    'rev_1',
    'bk_completed_1',
    'std_abhi',
    'std_rahul',
    5,
    'Rahul is exceptional! His mastery of Figma and user heuristics helped me build proper responsive design tokens. Highly recommended peer mentor!',
    'UI/UX Design, Figma',
    now
  );

  insertReview.run(
    'rev_2',
    'bk_completed_2',
    'std_priya',
    'std_abhi',
    5,
    'Abhi simplified Java concurrency and multithreading so clearly. Handled all my questions patiently with live code snippets. Earned all 60 credits and more!',
    'Java, Concurrency, OOP',
    now
  );

  // Badges
  const insertBadge = db.prepare(`
    INSERT INTO badges (badge_id, student_id, badge_type, title, description, icon, awarded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertBadge.run('b_1', 'std_abhi', 'VERIFIED_MENTOR', 'Verified Java Mentor', 'Passed official 95% SkillBridge assessment test', 'fa-solid fa-certificate', now);
  insertBadge.run('b_2', 'std_abhi', 'TOP_RATED', '5-Star Peer Tutor', 'Maintained a flawless 5.0 rating over multiple sessions', 'fa-solid fa-star', now);
  insertBadge.run('b_3', 'std_abhi', 'CENTURION', '100+ Teaching Minutes', 'Conducted over 120 minutes of verified peer learning', 'fa-solid fa-clock', now);

  insertBadge.run('b_4', 'std_rahul', 'VERIFIED_MENTOR', 'Verified UI/UX Specialist', 'Passed 98% Design Heuristics assessment', 'fa-solid fa-palette', now);
  insertBadge.run('b_5', 'std_rahul', 'RECIPROCITY_STAR', 'Reciprocal Pioneer', 'Successfully completed mutual two-way skill exchange', 'fa-solid fa-handshake', now);

  insertBadge.run('b_6', 'std_priya', 'VERIFIED_MENTOR', 'Verified Python Programmer', 'Passed 92% Python Architecture assessment', 'fa-solid fa-code', now);

  console.log('[SkillBridge] Database successfully seeded!');
}

seedDatabase();

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

// Quiz Question Bank for skill verification
const QUIZ_BANK = {
  skill_java: [
    {
      q: 'Which data structure does Java HashMap use internally when a bucket encounters hash collisions beyond TREEIFY_THRESHOLD?',
      options: ['Doubly Linked List', 'Red-Black Tree', 'Skip List', 'AVL Tree'],
      answer: 1,
      explanation: 'Java 8+ converts linked list buckets into balanced Red-Black trees when the bucket size exceeds 8 (TREEIFY_THRESHOLD).'
    },
    {
      q: 'What is the key difference between StringBuffer and StringBuilder in Java?',
      options: ['StringBuffer is synchronized and thread-safe; StringBuilder is not', 'StringBuilder is synchronized; StringBuffer is not', 'StringBuffer is immutable; StringBuilder is mutable', 'There is no functional difference'],
      answer: 0,
      explanation: 'StringBuffer methods are synchronized for thread-safety, whereas StringBuilder is unsynchronized and faster for single-threaded usage.'
    },
    {
      q: 'In Java memory model, where are object instances allocated?',
      options: ['Call Stack', 'Heap Memory', 'Metaspace', 'Program Counter Register'],
      answer: 1,
      explanation: 'All objects in Java are dynamically allocated on the Heap.'
    },
    {
      q: 'Which functional interface in java.util.function takes one argument and returns a boolean?',
      options: ['Function<T, R>', 'Consumer<T>', 'Predicate<T>', 'Supplier<T>'],
      answer: 2,
      explanation: 'Predicate<T> represents a predicate (boolean-valued function) of one argument.'
    },
    {
      q: 'What does the `volatile` keyword guarantee in multi-threaded Java applications?',
      options: ['Atomicity of compound operations', 'Visibility of changes across threads and prevents instruction reordering', 'Automatic mutual exclusion lock like synchronized', 'Deadlock prevention'],
      answer: 1,
      explanation: 'volatile guarantees memory visibility across threads and establishes a happens-before relationship, preventing hardware instruction reordering.'
    }
  ],
  skill_uiux: [
    {
      q: 'Which Nielsen Norman usability heuristic emphasizes that system state should be transparent to the user in reasonable time?',
      options: ['Visibility of system status', 'Match between system and real world', 'Error prevention', 'Recognition rather than recall'],
      answer: 0,
      explanation: 'Nielsen Heuristic #1: Visibility of System Status requires the design to always keep users informed about what is going on.'
    },
    {
      q: 'According to WCAG 2.1 AA standards, what is the minimum required contrast ratio for normal body text?',
      options: ['3:1', '4.5:1', '7:1', '10:1'],
      answer: 1,
      explanation: 'WCAG 2.1 AA mandates at least 4.5:1 contrast ratio for normal text and 3:1 for large text (18pt+ or 14pt bold).'
    },
    {
      q: 'What is the primary purpose of creating an atomic Design Token?',
      options: ['To replace CSS completely', 'To store design decisions (colors, spacing, typography) as reusable variables across platforms', 'To create 3D graphic models', 'To automate wireframing'],
      answer: 1,
      explanation: 'Design tokens are platform-agnostic variables storing visual attributes (color, typography, elevation, spacing).'
    },
    {
      q: 'In user-centered design, what is an "Affordance"?',
      options: ['The monetary cost of a subscription', 'A property of an object that suggests how it can be used or interacted with', 'The speed at which a page loads', 'The font kerning balance'],
      answer: 1,
      explanation: 'Affordance is a relationship between an object and a person that communicates potential action (e.g. a 3D bevel affords pressing).'
    },
    {
      q: 'What does Fitts\'s Law state regarding interactive UI targets?',
      options: ['Users read in an F-shaped pattern', 'The time to acquire a target is a function of the distance to and width of the target', 'Users cannot remember more than 7 items', 'Simpler forms always convert better'],
      answer: 1,
      explanation: 'Fitts\'s Law models target acquisition time as a function of target distance and target size.'
    }
  ],
  skill_python: [
    {
      q: 'What is the Global Interpreter Lock (GIL) in CPython?',
      options: ['A security sandbox for preventing unauthorized file access', 'A mutex that allows only one native thread to execute Python bytecodes at once', 'A compiler optimization for matrix multiplication', 'A database lock manager'],
      answer: 1,
      explanation: 'The GIL in CPython is a mutex that prevents multiple native threads from executing Python bytecodes simultaneously.'
    },
    {
      q: 'What does a Python generator function use instead of `return` to yield values lazily?',
      options: ['emit', 'yield', 'produce', 'defer'],
      answer: 1,
      explanation: 'Python generators use the `yield` statement to produce values iteratively without loading the entire sequence into memory.'
    },
    {
      q: 'In Python, what is the time complexity of looking up a key in a standard `dict` on average?',
      options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
      answer: 0,
      explanation: 'Python dictionaries are implemented as hash tables with average O(1) key lookup complexity.'
    },
    {
      q: 'Which built-in module provides decorators like `@dataclass`?',
      options: ['functools', 'dataclasses', 'collections', 'typing'],
      answer: 1,
      explanation: 'The `dataclasses` module provides the `@dataclass` decorator for generating boilerplate code (init, repr, eq).'
    },
    {
      q: 'What will `[x * 2 for x in range(5) if x % 2 == 0]` evaluate to?',
      options: ['[0, 2, 4]', '[0, 4, 8]', '[2, 4, 6]', '[0, 2, 4, 6, 8]'],
      answer: 1,
      explanation: 'Even numbers in range(5) are 0, 2, 4. Multiplied by 2 yields [0, 4, 8].'
    }
  ],
  skill_react: [
    {
      q: 'What is the primary rule when using React Hooks?',
      options: ['Always call Hooks inside conditional loops', 'Only call Hooks at the top level of React function components or custom hooks', 'Hooks must be called inside useEffect only', 'Hooks cannot have dependencies'],
      answer: 1,
      explanation: 'Hooks must always be called at the top level of React functions, not inside loops, conditions, or nested functions.'
    },
    {
      q: 'What does the Virtual DOM in React primarily optimize?',
      options: ['Network bandwidth', 'Direct expensive manipulations of the real browser DOM via batched diffing', 'Database query execution', 'CSS download time'],
      answer: 1,
      explanation: 'The Virtual DOM computes minimal diffs between states and batches updates to minimize costly real DOM repaints and reflows.'
    },
    {
      q: 'When should you use the `useCallback` Hook?',
      options: ['To memoize expensive calculation values', 'To memoize a callback function instance between renders to prevent unnecessary child re-renders', 'To fetch data from a REST endpoint', 'To handle global routing'],
      answer: 1,
      explanation: '`useCallback` memoizes function definitions between re-renders when passing callbacks to optimized child components.'
    },
    {
      q: 'In React 18, what feature allows state updates to be marked as non-urgent transitions?',
      options: ['startTransition', 'useLayoutEffect', 'deferUpdate', 'batchState'],
      answer: 0,
      explanation: 'React 18 introduces `startTransition` to mark UI updates as transitions that can be interrupted by urgent inputs.'
    },
    {
      q: 'Why should list items have stable and unique `key` props in React?',
      options: ['For CSS styling selectors', 'To help React identify which items have changed, been added, or been removed during reconciliation', 'To ensure alphabetical ordering', 'To support localStorage caching'],
      answer: 1,
      explanation: 'Keys give elements a stable identity across renders so React can efficiently match and patch DOM nodes.'
    }
  ],
  skill_sql: [
    {
      q: 'Which SQL index type is best suited for range queries (e.g. BETWEEN, >, <)?',
      options: ['Hash Index', 'B-Tree Index', 'Bitmap Index', 'Full-Text Index'],
      answer: 1,
      explanation: 'B-Tree indices maintain sorted order, making them ideal for equality and range-based evaluations.'
    },
    {
      q: 'What does the "I" in ACID database transactions stand for?',
      options: ['Integrity', 'Isolation', 'Indexing', 'Idempotency'],
      answer: 1,
      explanation: 'ACID: Atomicity, Consistency, Isolation, Durability.'
    },
    {
      q: 'What is the difference between WHERE and HAVING in SQL?',
      options: ['WHERE filters rows before aggregation; HAVING filters aggregated groups', 'HAVING filters before aggregation; WHERE filters after', 'They are strictly synonymous', 'HAVING only works on primary keys'],
      answer: 0,
      explanation: 'WHERE filters rows before the GROUP BY aggregation, whereas HAVING filters groups after aggregation.'
    },
    {
      q: 'Which normal form eliminates partial dependency on a composite primary key?',
      options: ['First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'Boyce-Codd Normal Form (BCNF)'],
      answer: 1,
      explanation: '2NF requires 1NF and ensures all non-key attributes are fully functionally dependent on the primary key.'
    },
    {
      q: 'What does a LEFT JOIN return if there is no match in the right table?',
      options: ['It throws a foreign key error', 'All rows from the left table with NULL values for right table columns', 'Only matching rows', 'An empty result set'],
      answer: 1,
      explanation: 'LEFT JOIN keeps all records from the left table and populates right table columns with NULL when no match exists.'
    }
  ]
};

// Skill Gap Definitions for Career Roadmaps
const CAREER_ROADMAPS = {
  'fullstack_java': {
    title: 'Full-Stack Java Enterprise Developer',
    description: 'Modern enterprise development combining robust Java/Spring Boot backends with reactive client interfaces.',
    requiredSkills: [
      { id: 'skill_java', name: 'Java', category: 'Backend' },
      { id: 'skill_springboot', name: 'Spring Boot', category: 'Backend' },
      { id: 'skill_sql', name: 'SQL & Databases', category: 'Database' },
      { id: 'skill_react', name: 'React.js', category: 'Frontend' },
      { id: 'skill_docker', name: 'Docker & DevOps', category: 'DevOps' }
    ]
  },
  'ai_ml_engineer': {
    title: 'AI & Machine Learning Engineer',
    description: 'Applied machine learning, deep neural networks, and Python-driven predictive analytics.',
    requiredSkills: [
      { id: 'skill_python', name: 'Python', category: 'Data & AI' },
      { id: 'skill_ml', name: 'Machine Learning', category: 'Data & AI' },
      { id: 'skill_sql', name: 'SQL & Databases', category: 'Database' },
      { id: 'skill_dsa', name: 'Data Structures & Algorithms', category: 'Core CS' }
    ]
  },
  'uiux_designer': {
    title: 'UI/UX & Product Design Specialist',
    description: 'Human-centered product design, design system architecture, Figma prototyping, and usability testing.',
    requiredSkills: [
      { id: 'skill_uiux', name: 'UI/UX Design', category: 'Design' },
      { id: 'skill_figma', name: 'Figma Prototyping', category: 'Design' },
      { id: 'skill_html_css', name: 'HTML & CSS', category: 'Frontend' },
      { id: 'skill_react', name: 'React.js', category: 'Frontend' }
    ]
  },
  'cloud_devops': {
    title: 'Cloud & Microservices Architect',
    description: 'Containerized microservices, distributed persistence, and automated cloud deployments.',
    requiredSkills: [
      { id: 'skill_docker', name: 'Docker & DevOps', category: 'DevOps' },
      { id: 'skill_springboot', name: 'Spring Boot', category: 'Backend' },
      { id: 'skill_sql', name: 'SQL & Databases', category: 'Database' },
      { id: 'skill_java', name: 'Java', category: 'Backend' }
    ]
  }
};

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse JSON helper
  function parseBody(callback) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        callback(null, json);
      } catch (err) {
        callback(err, null);
      }
    });
  }

  function sendJson(status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  function getAuthStudent() {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/, '');
    const decoded = verifyToken(token);
    if (!decoded || !decoded.student_id) return null;
    return db.prepare('SELECT * FROM students WHERE student_id = ?').get(decoded.student_id);
  }

  // --- API ROUTING ---

  // Health check
  if (pathname === '/api/health') {
    return sendJson(200, {
      status: 'UP',
      platform: 'SkillBridge - Verified Skill Exchange',
      version: '1.0.0',
      activeEngine: 'Reciprocal Smart Matching + Escrow Credit Ledger',
      timestamp: new Date().toISOString()
    });
  }

  // 1. Auth: Register
  if (pathname === '/api/auth/register' && method === 'POST') {
    return parseBody((err, body) => {
      if (err || !body.name || !body.email || !body.password || !body.college) {
        return sendJson(400, { success: false, message: 'Missing required registration fields' });
      }

      const existing = db.prepare('SELECT student_id FROM students WHERE email = ?').get(body.email.toLowerCase().trim());
      if (existing) {
        return sendJson(409, { success: false, message: 'An account with this student email already exists.' });
      }

      const studentId = 'std_' + crypto.randomBytes(4).toString('hex');
      const { hash, salt } = hashPassword(body.password);
      const now = new Date().toISOString();
      const department = body.department || 'General Studies';
      const bio = body.bio || `Student at ${body.college}. Excited to teach and learn on SkillBridge!`;
      const avatar = body.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(body.name)}`;

      db.prepare(`
        INSERT INTO students (student_id, name, email, password_hash, salt, college, department, bio, avatar, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(studentId, body.name, body.email.toLowerCase().trim(), hash, salt, body.college, department, bio, avatar, now);

      // Grant Welcome Credits (100 credits)
      db.prepare(`
        INSERT INTO credits (credit_id, student_id, balance, escrow_balance, total_earned, total_spent, updated_at)
        VALUES (?, ?, 100, 0, 0, 0, ?)
      `).run('c_' + studentId, studentId, now);

      db.prepare(`
        INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at)
        VALUES (?, ?, 100, 'WELCOME_BONUS', null, 'Welcome to SkillBridge! 100 Free Learning Credits Awarded', 100, ?)
      `).run('txn_' + crypto.randomBytes(4).toString('hex'), studentId, now);

      const token = generateToken({ student_id: studentId, email: body.email });
      const student = db.prepare('SELECT student_id, name, email, college, department, bio, avatar, created_at FROM students WHERE student_id = ?').get(studentId);

      return sendJson(201, {
        success: true,
        message: 'Registration successful! 100 learning credits have been added to your wallet.',
        token,
        student
      });
    });
  }

  // 2. Auth: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    return parseBody((err, body) => {
      if (err || !body.email || !body.password) {
        return sendJson(400, { success: false, message: 'Please provide email and password' });
      }

      const student = db.prepare('SELECT * FROM students WHERE email = ?').get(body.email.toLowerCase().trim());
      if (!student || !verifyPassword(body.password, student.password_hash, student.salt)) {
        return sendJson(401, { success: false, message: 'Invalid student email or password.' });
      }

      const token = generateToken({ student_id: student.student_id, email: student.email });
      delete student.password_hash;
      delete student.salt;

      const credits = db.prepare('SELECT balance, escrow_balance, total_earned, total_spent FROM credits WHERE student_id = ?').get(student.student_id) || { balance: 100 };

      return sendJson(200, {
        success: true,
        message: 'Welcome back to SkillBridge!',
        token,
        student,
        credits
      });
    });
  }

  // 3. Auth: Quick Demo Switch (for instant hackathon presentation)
  if (pathname === '/api/auth/demo-switch' && method === 'POST') {
    return parseBody((err, body) => {
      const studentId = body.studentId || 'std_abhi';
      const student = db.prepare('SELECT student_id, name, email, college, department, bio, avatar, created_at FROM students WHERE student_id = ?').get(studentId);
      if (!student) {
        return sendJson(404, { success: false, message: 'Demo student not found' });
      }

      const token = generateToken({ student_id: student.student_id, email: student.email });
      const credits = db.prepare('SELECT balance, escrow_balance, total_earned, total_spent FROM credits WHERE student_id = ?').get(student.student_id);

      return sendJson(200, {
        success: true,
        message: `Switched active student to ${student.name}`,
        token,
        student,
        credits
      });
    });
  }

  // 4. Auth: Get Current Profile
  if (pathname === '/api/auth/me' && method === 'GET') {
    let student = getAuthStudent();
    if (!student && parsedUrl.query.demoId) {
      student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(parsedUrl.query.demoId);
    }
    if (!student) {
      // Default to Abhi for smooth guest view
      student = db.prepare('SELECT * FROM students WHERE student_id = ?').get('std_abhi');
    }

    delete student.password_hash;
    delete student.salt;

    const credits = db.prepare('SELECT balance, escrow_balance, total_earned, total_spent FROM credits WHERE student_id = ?').get(student.student_id);
    const skills = db.prepare(`
      SELECT ss.*, s.skill_name, s.category, s.icon
      FROM student_skills ss
      JOIN skills s ON ss.skill_id = s.skill_id
      WHERE ss.student_id = ?
    `).all(student.student_id);

    const badges = db.prepare('SELECT * FROM badges WHERE student_id = ?').all(student.student_id);
    const stats = {
      completedSessions: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE (teacher_id = ? OR learner_id = ?) AND status = 'COMPLETED'").get(student.student_id, student.student_id).c,
      hoursTaught: Math.round((db.prepare("SELECT COALESCE(SUM(duration_minutes), 0) as m FROM bookings WHERE teacher_id = ? AND status = 'COMPLETED'").get(student.student_id).m / 60) * 10) / 10,
      studentsMentored: db.prepare("SELECT COUNT(DISTINCT learner_id) as s FROM bookings WHERE teacher_id = ? AND status = 'COMPLETED'").get(student.student_id).s,
      avgRating: (db.prepare("SELECT AVG(rating) as r FROM reviews WHERE reviewee_id = ?").get(student.student_id).r || 5.0).toFixed(1)
    };

    return sendJson(200, {
      success: true,
      student,
      credits,
      skills,
      badges,
      stats
    });
  }

  // 5. Skills Master List
  if (pathname === '/api/skills' && method === 'GET') {
    const allSkills = db.prepare('SELECT * FROM skills ORDER BY category, skill_name').all();
    return sendJson(200, { success: true, skills: allSkills });
  }

  // 6. Manage Student Skills: Add Skill
  if (pathname === '/api/skills/add' && method === 'POST') {
    return parseBody((err, body) => {
      const studentId = body.studentId || (getAuthStudent()?.student_id);
      if (!studentId || !body.skillId || !body.skillType) {
        return sendJson(400, { success: false, message: 'Missing skill parameters' });
      }

      // Check if already present
      const existing = db.prepare('SELECT id FROM student_skills WHERE student_id = ? AND skill_id = ? AND skill_type = ?')
        .get(studentId, body.skillId, body.skillType);

      if (existing) {
        return sendJson(409, { success: false, message: 'Skill already registered in this section' });
      }

      const id = 'ss_' + crypto.randomBytes(4).toString('hex');
      const proficiency = body.proficiency || 'Intermediate';

      db.prepare(`
        INSERT INTO student_skills (id, student_id, skill_id, skill_type, proficiency, verified, verified_score)
        VALUES (?, ?, ?, ?, ?, 0, 0)
      `).run(id, studentId, body.skillId, body.skillType, proficiency);

      return sendJson(201, { success: true, message: 'Skill added to your profile successfully!' });
    });
  }

  // 7. Manage Student Skills: Remove Skill
  if (pathname === '/api/skills/remove' && method === 'POST') {
    return parseBody((err, body) => {
      const studentId = body.studentId || (getAuthStudent()?.student_id);
      if (!studentId || !body.skillId || !body.skillType) {
        return sendJson(400, { success: false, message: 'Missing parameters' });
      }

      db.prepare('DELETE FROM student_skills WHERE student_id = ? AND skill_id = ? AND skill_type = ?')
        .run(studentId, body.skillId, body.skillType);

      return sendJson(200, { success: true, message: 'Skill removed from profile' });
    });
  }

  // 8. SMART SKILL MATCHING ENGINE
  // "You teach what you know, and learn what you need."
  // Detects 2-way reciprocal matches and calculated match compatibility score!
  if (pathname === '/api/matching/find-partners' && method === 'GET') {
    let currentId = parsedUrl.query.studentId || getAuthStudent()?.student_id || 'std_abhi';
    const filterSkill = parsedUrl.query.skill;

    const me = db.prepare('SELECT * FROM students WHERE student_id = ?').get(currentId);
    if (!me) return sendJson(404, { success: false, message: 'Student not found' });

    // My teaching & learning skills
    const myTeaches = db.prepare("SELECT s.skill_id, s.skill_name, ss.verified, ss.proficiency FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ? AND ss.skill_type = 'TEACH'").all(currentId);
    const myWants = db.prepare("SELECT s.skill_id, s.skill_name FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ? AND ss.skill_type = 'LEARN'").all(currentId);

    const myTeachMap = new Map(myTeaches.map(t => [t.skill_id, t]));
    const myWantMap = new Map(myWants.map(w => [w.skill_id, w]));

    // All other students
    const candidates = db.prepare('SELECT student_id, name, email, college, department, bio, avatar FROM students WHERE student_id != ?').all(currentId);

    const matches = [];

    for (const cand of candidates) {
      const candTeaches = db.prepare("SELECT s.skill_id, s.skill_name, s.category, s.icon, ss.verified, ss.verified_score, ss.proficiency FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ? AND ss.skill_type = 'TEACH'").all(cand.student_id);
      const candWants = db.prepare("SELECT s.skill_id, s.skill_name, s.category, s.icon FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ? AND ss.skill_type = 'LEARN'").all(cand.student_id);

      // What can candidate teach me? (candTeaches intersects myWants)
      const candCanTeachMe = candTeaches.filter(t => myWantMap.has(t.skill_id));

      // What can I teach candidate? (candWants intersects myTeaches)
      const iCanTeachCand = candWants.filter(w => myTeachMap.has(w.skill_id));

      // Skip candidate if no learning connection exists
      if (candCanTeachMe.length === 0 && iCanTeachCand.length === 0) continue;

      // Filter by requested skill if present
      if (filterSkill && !candCanTeachMe.some(t => t.skill_id === filterSkill || t.skill_name.toLowerCase().includes(filterSkill.toLowerCase()))) {
        continue;
      }

      // Calculate Reciprocity & Match Percentage
      const isTwoWayReciprocal = candCanTeachMe.length > 0 && iCanTeachCand.length > 0;

      let score = 0;
      const reasons = [];

      if (isTwoWayReciprocal) {
        score += 55;
        const teachName = candCanTeachMe[0].skill_name;
        const learnName = iCanTeachCand[0].skill_name;
        reasons.push(`Perfect 2-Way Reciprocal Match: They teach ${teachName} and want your ${learnName}`);
      } else if (candCanTeachMe.length > 0) {
        score += 35;
        reasons.push(`Verified Peer Tutor for ${candCanTeachMe.map(s => s.skill_name).join(', ')}`);
      } else {
        score += 20;
        reasons.push(`Student seeking your mentorship in ${iCanTeachCand.map(s => s.skill_name).join(', ')}`);
      }

      // Verification bonus
      const hasVerified = candTeaches.some(t => t.verified === 1);
      if (hasVerified) {
        score += 18;
        reasons.push('Holds Verified Skill Credentials (80%+ Assessment Score)');
      }

      // College/Department synergy
      if (cand.college === me.college) {
        score += 12;
        reasons.push(`Same Campus Partner (${cand.college})`);
      } else {
        score += 6;
      }

      // Rating bonus
      const avgRating = (db.prepare('SELECT AVG(rating) as r FROM reviews WHERE reviewee_id = ?').get(cand.student_id).r || 5.0);
      if (avgRating >= 4.8) {
        score += 15;
        reasons.push(`Top-Rated Peer Mentor (${avgRating.toFixed(1)} ★)`);
      } else {
        score += 8;
      }

      const matchPercentage = Math.min(score, 99); // Max 99%

      // Reviews summary
      const reviewCount = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE reviewee_id = ?').get(cand.student_id).c;
      const completedSessions = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE teacher_id = ? AND status = 'COMPLETED'").get(cand.student_id).c;

      matches.push({
        student: cand,
        matchPercentage,
        isTwoWayReciprocal,
        candCanTeachMe,
        iCanTeachCand,
        allCandTeaches: candTeaches,
        allCandWants: candWants,
        reasons,
        rating: avgRating.toFixed(1),
        reviewCount,
        completedSessions
      });
    }

    // Sort by match percentage descending, prioritizing two-way reciprocal matches
    matches.sort((a, b) => {
      if (a.isTwoWayReciprocal && !b.isTwoWayReciprocal) return -1;
      if (!a.isTwoWayReciprocal && b.isTwoWayReciprocal) return 1;
      return b.matchPercentage - a.matchPercentage;
    });

    return sendJson(200, {
      success: true,
      currentStudent: me.name,
      totalMatches: matches.length,
      matches
    });
  }

  // 9. Smart Learning Gap Finder
  if (pathname === '/api/matching/gap-finder' && method === 'GET') {
    const studentId = parsedUrl.query.studentId || getAuthStudent()?.student_id || 'std_abhi';
    const roleKey = parsedUrl.query.role || 'fullstack_java';
    const roadmap = CAREER_ROADMAPS[roleKey] || CAREER_ROADMAPS['fullstack_java'];

    // Get current student skills
    const mySkills = db.prepare(`
      SELECT ss.skill_id, ss.skill_type, ss.verified, ss.proficiency, s.skill_name
      FROM student_skills ss
      JOIN skills s ON ss.skill_id = s.skill_id
      WHERE ss.student_id = ?
    `).all(studentId);

    const masteredMap = new Map();
    for (const ms of mySkills) {
      masteredMap.set(ms.skill_id, ms);
    }

    const gapSkills = [];
    const masteredSkills = [];

    for (const reqSkill of roadmap.requiredSkills) {
      if (masteredMap.has(reqSkill.id)) {
        masteredSkills.push({
          ...reqSkill,
          userProficiency: masteredMap.get(reqSkill.id).proficiency,
          verified: masteredMap.get(reqSkill.id).verified === 1
        });
      } else {
        // Find matching teachers on platform for this gap skill
        const teachers = db.prepare(`
          SELECT st.student_id, st.name, st.college, st.avatar, ss.verified, ss.verified_score, ss.proficiency
          FROM student_skills ss
          JOIN students st ON ss.student_id = st.student_id
          WHERE ss.skill_id = ? AND ss.skill_type = 'TEACH' AND st.student_id != ?
          LIMIT 3
        `).all(reqSkill.id, studentId);

        gapSkills.push({
          ...reqSkill,
          availableTutors: teachers
        });
      }
    }

    const readinessPercentage = Math.round((masteredSkills.length / roadmap.requiredSkills.length) * 100);

    return sendJson(200, {
      success: true,
      roadmap,
      allRoles: Object.keys(CAREER_ROADMAPS).map(k => ({ key: k, title: CAREER_ROADMAPS[k].title })),
      readinessPercentage,
      masteredSkills,
      gapSkills
    });
  }

  // 10. Bookings: Get User Bookings
  if (pathname === '/api/bookings' && method === 'GET') {
    const studentId = parsedUrl.query.studentId || getAuthStudent()?.student_id || 'std_abhi';

    const bookings = db.prepare(`
      SELECT 
        b.*,
        s.skill_name, s.category, s.icon as skill_icon,
        teacher.name as teacher_name, teacher.avatar as teacher_avatar, teacher.college as teacher_college,
        learner.name as learner_name, learner.avatar as learner_avatar, learner.college as learner_college
      FROM bookings b
      JOIN skills s ON b.skill_id = s.skill_id
      JOIN students teacher ON b.teacher_id = teacher.student_id
      JOIN students learner ON b.learner_id = learner.student_id
      WHERE b.teacher_id = ? OR b.learner_id = ?
      ORDER BY b.session_date DESC, b.session_time DESC
    `).all(studentId, studentId);

    return sendJson(200, { success: true, bookings });
  }

  // 11. Bookings: Create Session Request (with Escrow Hold)
  if (pathname === '/api/bookings' && method === 'POST') {
    return parseBody((err, body) => {
      const learnerId = body.learnerId || getAuthStudent()?.student_id || 'std_abhi';
      const { teacherId, skillId, topic, sessionDate, sessionTime, durationMinutes, notes } = body;

      if (!teacherId || !skillId || !topic || !sessionDate || !sessionTime) {
        return sendJson(400, { success: false, message: 'Missing required session booking information' });
      }

      if (teacherId === learnerId) {
        return sendJson(400, { success: false, message: 'You cannot book a learning session with yourself.' });
      }

      const duration = parseInt(durationMinutes || 60, 10);
      const creditCost = duration; // 1 minute = 1 credit rule

      // Check Learner credit balance
      const learnerCredits = db.prepare('SELECT balance, escrow_balance FROM credits WHERE student_id = ?').get(learnerId);
      if (!learnerCredits || learnerCredits.balance < creditCost) {
        return sendJson(400, {
          success: false,
          message: `Insufficient credits! This ${duration}-min session requires ${creditCost} learning credits, but your balance is ${learnerCredits?.balance || 0}. Teach other students first to earn more credits!`
        });
      }

      const bookingId = 'bk_' + crypto.randomBytes(5).toString('hex');
      const now = new Date().toISOString();
      const meetingLink = `https://meet.skillbridge.edu/room/${bookingId}`;

      // Deduct from balance into Escrow
      const newBalance = learnerCredits.balance - creditCost;
      const newEscrow = learnerCredits.escrow_balance + creditCost;

      db.prepare(`
        UPDATE credits
        SET balance = ?, escrow_balance = ?, updated_at = ?
        WHERE student_id = ?
      `).run(newBalance, newEscrow, now, learnerId);

      // Log transaction
      db.prepare(`
        INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at)
        VALUES (?, ?, ?, 'SESSION_ESCROW', ?, ?, ?, ?)
      `).run('txn_' + crypto.randomBytes(4).toString('hex'), learnerId, -creditCost, bookingId, `Escrow hold for ${duration}-min session: ${topic}`, newBalance, now);

      // Create Booking
      db.prepare(`
        INSERT INTO bookings (booking_id, teacher_id, learner_id, skill_id, topic, session_date, session_time, duration_minutes, credit_amount, status, meeting_link, notes, teacher_confirmed, learner_confirmed, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, 0, 0, ?)
      `).run(bookingId, teacherId, learnerId, skillId, topic, sessionDate, sessionTime, duration, creditCost, meetingLink, notes || '', now);

      return sendJson(201, {
        success: true,
        message: `Booking request sent to peer mentor! ${creditCost} credits placed securely in escrow until session completion.`,
        bookingId,
        escrowHeld: creditCost,
        remainingBalance: newBalance
      });
    });
  }

  // 12. Bookings: Accept / Reject / Reschedule
  if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/respond') && method === 'PUT') {
    const bookingId = pathname.split('/')[3];
    return parseBody((err, body) => {
      const { action } = body; // 'ACCEPT' or 'REJECT'
      const booking = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(bookingId);
      if (!booking) return sendJson(404, { success: false, message: 'Booking not found' });

      const now = new Date().toISOString();

      if (action === 'ACCEPT') {
        db.prepare("UPDATE bookings SET status = 'ACCEPTED' WHERE booking_id = ?").run(bookingId);
        return sendJson(200, { success: true, message: 'Session booking accepted! The meeting room is now active.' });
      } else if (action === 'REJECT') {
        // Refund learner escrow credits
        const learnerCredits = db.prepare('SELECT balance, escrow_balance FROM credits WHERE student_id = ?').get(booking.learner_id);
        const refundBal = learnerCredits.balance + booking.credit_amount;
        const refundEscrow = Math.max(0, learnerCredits.escrow_balance - booking.credit_amount);

        db.prepare('UPDATE credits SET balance = ?, escrow_balance = ?, updated_at = ? WHERE student_id = ?')
          .run(refundBal, refundEscrow, now, booking.learner_id);

        db.prepare(`
          INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at)
          VALUES (?, ?, ?, 'ESCROW_REFUNDED', ?, ?, ?, ?)
        `).run('txn_' + crypto.randomBytes(4).toString('hex'), booking.learner_id, booking.credit_amount, bookingId, `Session request declined - Escrow refunded (${booking.credit_amount} credits)`, refundBal, now);

        db.prepare("UPDATE bookings SET status = 'REJECTED' WHERE booking_id = ?").run(bookingId);
        return sendJson(200, { success: true, message: 'Booking declined. Escrow credits refunded to student wallet.' });
      }

      return sendJson(400, { success: false, message: 'Invalid action' });
    });
  }

  // 13. Virtual Session Room & Mutual Confirmation
  if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/room') && method === 'GET') {
    const bookingId = pathname.split('/')[3];
    const booking = db.prepare(`
      SELECT b.*, s.skill_name, s.category,
        t.name as teacher_name, t.avatar as teacher_avatar, t.college as teacher_college,
        l.name as learner_name, l.avatar as learner_avatar, l.college as learner_college
      FROM bookings b
      JOIN skills s ON b.skill_id = s.skill_id
      JOIN students t ON b.teacher_id = t.student_id
      JOIN students l ON b.learner_id = l.student_id
      WHERE b.booking_id = ?
    `).get(bookingId);

    if (!booking) return sendJson(404, { success: false, message: 'Session room not found' });
    return sendJson(200, { success: true, session: booking });
  }

  // 14. Confirm Session Completion & Credit Transfer
  // "Credits should only be added after a session is marked completed and confirmed by both participants."
  if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/confirm-complete') && method === 'POST') {
    const bookingId = pathname.split('/')[3];
    return parseBody((err, body) => {
      const studentId = body.studentId || getAuthStudent()?.student_id;
      const forceCompleteBoth = body.forceDemoComplete === true;

      const booking = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(bookingId);
      if (!booking) return sendJson(404, { success: false, message: 'Booking not found' });
      if (booking.status === 'COMPLETED') {
        return sendJson(200, { success: true, message: 'Session was already completed', alreadyCompleted: true });
      }

      let teacherConfirmed = booking.teacher_confirmed;
      let learnerConfirmed = booking.learner_confirmed;

      if (forceCompleteBoth) {
        teacherConfirmed = 1;
        learnerConfirmed = 1;
      } else if (studentId === booking.teacher_id) {
        teacherConfirmed = 1;
      } else if (studentId === booking.learner_id) {
        learnerConfirmed = 1;
      } else {
        teacherConfirmed = 1;
      }

      const now = new Date().toISOString();

      // Check if both participants confirmed
      if (teacherConfirmed === 1 && learnerConfirmed === 1) {
        // Complete session!
        db.prepare(`
          UPDATE bookings
          SET status = 'COMPLETED', teacher_confirmed = 1, learner_confirmed = 1, completed_at = ?
          WHERE booking_id = ?
        `).run(now, bookingId);

        // RELEASE ESCROW & TRANSFER CREDITS!
        // 1 completed teaching minute = 1 learning credit
        const creditAmt = booking.credit_amount;

        // 1. Release learner's escrow hold
        const learnerCredits = db.prepare('SELECT balance, escrow_balance, total_spent FROM credits WHERE student_id = ?').get(booking.learner_id);
        const newLearnerEscrow = Math.max(0, learnerCredits.escrow_balance - creditAmt);
        const newLearnerSpent = learnerCredits.total_spent + creditAmt;

        db.prepare('UPDATE credits SET escrow_balance = ?, total_spent = ?, updated_at = ? WHERE student_id = ?')
          .run(newLearnerEscrow, newLearnerSpent, now, booking.learner_id);

        db.prepare(`
          INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at)
          VALUES (?, ?, ?, 'ESCROW_RELEASED', ?, ?, ?, ?)
        `).run('txn_' + crypto.randomBytes(4).toString('hex'), booking.learner_id, 0, bookingId, `Session completed - Released ${creditAmt} credits from escrow to teacher`, learnerCredits.balance, now);

        // 2. Transfer credits to teacher!
        const teacherCredits = db.prepare('SELECT balance, total_earned FROM credits WHERE student_id = ?').get(booking.teacher_id);
        const newTeacherBalance = teacherCredits.balance + creditAmt;
        const newTeacherEarned = teacherCredits.total_earned + creditAmt;

        db.prepare('UPDATE credits SET balance = ?, total_earned = ?, updated_at = ? WHERE student_id = ?')
          .run(newTeacherBalance, newTeacherEarned, now, booking.teacher_id);

        db.prepare(`
          INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at)
          VALUES (?, ?, ?, 'TEACHING_EARNED', ?, ?, ?, ?)
        `).run('txn_' + crypto.randomBytes(4).toString('hex'), booking.teacher_id, creditAmt, bookingId, `Earned ${creditAmt} learning credits for teaching ${booking.topic}`, newTeacherBalance, now);

        return sendJson(200, {
          success: true,
          bothConfirmed: true,
          status: 'COMPLETED',
          creditsTransferred: creditAmt,
          message: `Mutual confirmation complete! ${creditAmt} learning credits transferred to teacher wallet.`
        });
      } else {
        db.prepare(`
          UPDATE bookings
          SET teacher_confirmed = ?, learner_confirmed = ?
          WHERE booking_id = ?
        `).run(teacherConfirmed, learnerConfirmed, bookingId);

        return sendJson(200, {
          success: true,
          bothConfirmed: false,
          teacherConfirmed: teacherConfirmed === 1,
          learnerConfirmed: learnerConfirmed === 1,
          message: 'Your completion confirmation was recorded! Waiting for peer confirmation.'
        });
      }
    });
  }

  // 15. Skill Verification Assessment Quiz
  if (pathname.startsWith('/api/verify/quiz/') && method === 'GET') {
    const skillId = pathname.split('/')[4];
    const questions = QUIZ_BANK[skillId] || QUIZ_BANK['skill_java'];
    // Send questions without revealing answer key
    const sanitized = questions.map((q, idx) => ({
      index: idx,
      question: q.q,
      options: q.options
    }));

    return sendJson(200, {
      success: true,
      skillId,
      totalQuestions: sanitized.length,
      passingScore: 80,
      questions: sanitized
    });
  }

  // 16. Submit Skill Verification Assessment
  if (pathname === '/api/verify/submit' && method === 'POST') {
    return parseBody((err, body) => {
      const studentId = body.studentId || getAuthStudent()?.student_id || 'std_abhi';
      const { skillId, answers } = body; // answers: { "0": 1, "1": 0, ... }

      const questions = QUIZ_BANK[skillId] || QUIZ_BANK['skill_java'];
      if (!questions) return sendJson(404, { success: false, message: 'Assessment not found for skill' });

      let correctCount = 0;
      const feedback = [];

      questions.forEach((q, idx) => {
        const userAnswer = parseInt(answers[idx], 10);
        const isCorrect = userAnswer === q.answer;
        if (isCorrect) correctCount++;
        feedback.push({
          index: idx,
          isCorrect,
          correctOption: q.options[q.answer],
          explanation: q.explanation
        });
      });

      const scorePercent = Math.round((correctCount / questions.length) * 100);
      const passed = scorePercent >= 80;
      const now = new Date().toISOString();

      if (passed) {
        // Update student skill verified status
        const skill = db.prepare('SELECT skill_name FROM skills WHERE skill_id = ?').get(skillId);
        const existingSS = db.prepare("SELECT id FROM student_skills WHERE student_id = ? AND skill_id = ? AND skill_type = 'TEACH'").get(studentId, skillId);

        if (existingSS) {
          db.prepare(`
            UPDATE student_skills
            SET verified = 1, verified_score = ?, verified_at = ?, verification_method = 'SkillBridge Assessment'
            WHERE id = ?
          `).run(scorePercent, now, existingSS.id);
        } else {
          db.prepare(`
            INSERT INTO student_skills (id, student_id, skill_id, skill_type, proficiency, verified, verified_score, verified_at, verification_method)
            VALUES (?, ?, ?, 'TEACH', 'Advanced', 1, ?, ?, 'SkillBridge Assessment')
          `).run('ss_' + crypto.randomBytes(4).toString('hex'), studentId, skillId, scorePercent, now);
        }

        // Award badge
        const badgeId = 'b_' + crypto.randomBytes(4).toString('hex');
        db.prepare(`
          INSERT INTO badges (badge_id, student_id, badge_type, title, description, icon, awarded_at)
          VALUES (?, ?, 'VERIFIED_MENTOR', ?, ?, 'fa-solid fa-certificate', ?)
        `).run(badgeId, studentId, `Verified ${skill?.skill_name || 'Skill'} Mentor`, `Scored ${scorePercent}% on technical verification assessment`, now);
      }

      return sendJson(200, {
        success: true,
        passed,
        score: scorePercent,
        correctCount,
        totalQuestions: questions.length,
        feedback,
        message: passed
          ? `Congratulations! You scored ${scorePercent}% and earned the official SkillBridge VERIFIED badge!`
          : `You scored ${scorePercent}%. 80% is required for official verification. Feel free to re-attempt anytime!`
      });
    });
  }

  // 17. Reviews: Submit Rating and Feedback
  if (pathname === '/api/reviews' && method === 'POST') {
    return parseBody((err, body) => {
      const reviewerId = body.reviewerId || getAuthStudent()?.student_id;
      const { bookingId, rating, feedback, skillsTagged } = body;

      if (!bookingId || !rating || !feedback) {
        return sendJson(400, { success: false, message: 'Missing review details' });
      }

      const booking = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(bookingId);
      if (!booking) return sendJson(404, { success: false, message: 'Booking not found' });

      // Determine who is being reviewed
      const revieweeId = (reviewerId === booking.teacher_id) ? booking.learner_id : booking.teacher_id;
      const reviewId = 'rev_' + crypto.randomBytes(4).toString('hex');
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO reviews (review_id, booking_id, reviewer_id, reviewee_id, rating, feedback, skills_tagged, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reviewId, bookingId, reviewerId, revieweeId, parseInt(rating, 10), feedback, skillsTagged || '', now);

      return sendJson(201, { success: true, message: 'Feedback and rating submitted! Thank you for supporting peer learning.' });
    });
  }

  // 18. Learning Passport: Verifiable Portfolio
  if (pathname.startsWith('/api/passport/') && method === 'GET') {
    const studentId = pathname.split('/')[3] || 'std_abhi';
    const student = db.prepare('SELECT student_id, name, email, college, department, bio, avatar, created_at FROM students WHERE student_id = ?').get(studentId);
    if (!student) return sendJson(404, { success: false, message: 'Student passport not found' });

    const verifiedSkills = db.prepare(`
      SELECT ss.*, s.skill_name, s.category, s.icon
      FROM student_skills ss
      JOIN skills s ON ss.skill_id = s.skill_id
      WHERE ss.student_id = ? AND ss.skill_type = 'TEACH'
      ORDER BY ss.verified DESC, ss.verified_score DESC
    `).all(studentId);

    const badges = db.prepare('SELECT * FROM badges WHERE student_id = ?').all(studentId);

    const reviews = db.prepare(`
      SELECT r.*, st.name as reviewer_name, st.college as reviewer_college, st.avatar as reviewer_avatar
      FROM reviews r
      JOIN students st ON r.reviewer_id = st.student_id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
    `).all(studentId);

    const stats = {
      totalTeachingMinutes: db.prepare("SELECT COALESCE(SUM(duration_minutes), 0) as m FROM bookings WHERE teacher_id = ? AND status = 'COMPLETED'").get(studentId).m,
      totalSessionsTaught: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE teacher_id = ? AND status = 'COMPLETED'").get(studentId).c,
      totalStudentsMentored: db.prepare("SELECT COUNT(DISTINCT learner_id) as s FROM bookings WHERE teacher_id = ? AND status = 'COMPLETED'").get(studentId).s,
      avgRating: (db.prepare('SELECT AVG(rating) as r FROM reviews WHERE reviewee_id = ?').get(studentId).r || 5.0).toFixed(1)
    };

    return sendJson(200, {
      success: true,
      passport: {
        credentialId: `SB-PASS-${studentId.toUpperCase()}-${crypto.createHash('md5').update(studentId).digest('hex').substring(0, 8).toUpperCase()}`,
        student,
        stats,
        verifiedSkills,
        badges,
        reviews,
        issuedAt: student.created_at
      }
    });
  }

  // 19. Credits: Balance & Transactions
  if (pathname === '/api/credits' && method === 'GET') {
    const studentId = parsedUrl.query.studentId || getAuthStudent()?.student_id || 'std_abhi';
    const credits = db.prepare('SELECT * FROM credits WHERE student_id = ?').get(studentId) || { balance: 100, escrow_balance: 0, total_earned: 0, total_spent: 0 };
    const transactions = db.prepare('SELECT * FROM credit_transactions WHERE student_id = ? ORDER BY created_at DESC LIMIT 50').all(studentId);

    return sendJson(200, { success: true, credits, transactions });
  }

  // 20. Credits Faucet (Demo test grant)
  if (pathname === '/api/credits/faucet' && method === 'POST') {
    return parseBody((err, body) => {
      const studentId = body.studentId || 'std_abhi';
      const credits = db.prepare('SELECT * FROM credits WHERE student_id = ?').get(studentId);
      const newBal = (credits?.balance || 0) + 50;
      const now = new Date().toISOString();

      db.prepare('UPDATE credits SET balance = ?, updated_at = ? WHERE student_id = ?').run(newBal, now, studentId);
      db.prepare(`
        INSERT INTO credit_transactions (txn_id, student_id, amount, type, booking_id, description, balance_after, created_at)
        VALUES (?, ?, 50, 'PRACTICE_GRANT', null, 'Demo Practice Bonus: +50 credits granted', ?, ?)
      `).run('txn_' + crypto.randomBytes(4).toString('hex'), studentId, newBal, now);

      return sendJson(200, { success: true, balance: newBal, message: '50 credits added to your wallet!' });
    });
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  // If path has no extension, try adding .html
  if (!ext && !fs.existsSync(filePath)) {
    filePath += '.html';
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        fs.createReadStream(indexFile).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('SkillBridge File Not Found');
      }
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 SkillBridge Server Running at http://localhost:${PORT}`);
  console.log(`✨ Verified Student-to-Student Skill Exchange Platform`);
  console.log(`📊 Database: SQLite via node:sqlite (${DB_PATH})`);
  console.log(`💡 Demo Students: Abhi, Rahul, Priya, Kavya, Aman`);
  console.log(`=======================================================`);
});
