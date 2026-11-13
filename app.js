// public/app.js - SkillBridge Web Application Logic
let currentStudentId = localStorage.getItem('sb_student_id') || 'std_abhi';
let currentToken = localStorage.getItem('sb_token') || null;
let currentTab = 'dashboard';
let activeSessionRoomInterval = null;
let activeRoomBookingId = null;
let currentQuizData = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  await loadCurrentStudent();
  await loadDashboard();
  loadAllMasterSkills();
}

// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border transition-all duration-300 transform translate-y-2 opacity-0 ${
    type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50' :
    type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-500/50' :
    'bg-indigo-950/90 text-indigo-200 border-indigo-500/50'
  }`;

  const icon = type === 'success' ? 'fa-circle-check text-emerald-400' :
               type === 'error' ? 'fa-triangle-exclamation text-rose-400' :
               'fa-circle-info text-indigo-400';

  toast.innerHTML = `<i class="fa-solid ${icon} mr-1.5"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Tab Switching
function switchTab(tabId) {
  currentTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('text-indigo-400', 'bg-indigo-950/60', 'border-indigo-500/30');
    btn.classList.add('text-slate-400');
  });
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.classList.add('text-indigo-400', 'bg-indigo-950/60', 'border-indigo-500/30');
    activeNav.classList.remove('text-slate-400');
  }

  // Update panels
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) activePane.classList.remove('hidden');

  // Load tab specific content
  if (tabId === 'dashboard') loadDashboard();
  if (tabId === 'matching') loadMatchingPartners();
  if (tabId === 'skills') loadMySkills();
  if (tabId === 'sessions') loadSessions();
  if (tabId === 'credits') loadCreditsLedger();
  if (tabId === 'passport') loadLearningPassport();
  if (tabId === 'gapfinder') loadGapFinder();
}

// 1. Load Current Student & Profile
async function loadCurrentStudent() {
  try {
    const res = await fetch(`/api/auth/me?demoId=${currentStudentId}`);
    const data = await res.json();
    if (data.success && data.student) {
      const s = data.student;
      document.getElementById('header-name').textContent = s.name;
      document.getElementById('header-college').textContent = s.college;
      document.getElementById('header-avatar').src = s.avatar;
      document.getElementById('dash-greeting-name').textContent = s.name.split(' ')[0];
      document.getElementById('header-credit-balance').textContent = data.credits?.balance || 100;
      document.getElementById('dropdown-full-info').textContent = `${s.name} (${s.college})`;
    }
  } catch (e) {
    console.error('Failed to load student profile', e);
  }
}

// 2. Load Dashboard
async function loadDashboard() {
  try {
    const res = await fetch(`/api/auth/me?demoId=${currentStudentId}`);
    const data = await res.json();
    if (!data.success) return;

    // Update stats
    document.getElementById('dash-stat-credits').textContent = data.credits.balance;
    document.getElementById('dash-stat-hours').textContent = data.stats.hoursTaught;
    document.getElementById('dash-stat-students').textContent = data.stats.studentsMentored;
    document.getElementById('dash-stat-rating').textContent = data.stats.avgRating;

    // Load upcoming bookings
    const bkRes = await fetch(`/api/bookings?studentId=${currentStudentId}`);
    const bkData = await bkRes.json();
    const upcomingContainer = document.getElementById('dash-upcoming-list');
    upcomingContainer.innerHTML = '';

    const pendingOrAccepted = (bkData.bookings || []).filter(b => b.status === 'ACCEPTED' || b.status === 'PENDING').slice(0, 3);

    if (pendingOrAccepted.length === 0) {
      upcomingContainer.innerHTML = `
        <div class="text-center py-6 text-slate-500 text-xs">
          <i class="fa-regular fa-calendar-xmark text-2xl mb-2 text-slate-600 block"></i>
          No upcoming sessions scheduled yet. Find a partner to start learning!
        </div>
      `;
    } else {
      pendingOrAccepted.forEach(b => {
        const isTeacher = b.teacher_id === currentStudentId;
        const otherName = isTeacher ? b.learner_name : b.teacher_name;
        const otherCollege = isTeacher ? b.learner_college : b.teacher_college;
        const otherAvatar = isTeacher ? b.learner_avatar : b.teacher_avatar;

        const div = document.createElement('div');
        div.className = 'bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition';
        div.innerHTML = `
          <div class="flex items-center space-x-3">
            <img src="${otherAvatar}" class="w-10 h-10 rounded-xl object-cover border border-indigo-500/40">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-bold text-white">${otherName}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold ${isTeacher ? 'bg-indigo-500/20 text-indigo-300' : 'bg-cyan-500/20 text-cyan-300'}">
                  ${isTeacher ? 'Teaching' : 'Learning'}
                </span>
              </div>
              <p class="text-[11px] text-slate-400">${b.topic} (${b.duration_minutes}m)</p>
              <p class="text-[10px] text-slate-500"><i class="fa-regular fa-clock mr-1"></i>${b.session_date} at ${b.session_time}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            ${b.status === 'ACCEPTED' ? `
              <button onclick="openLiveRoom('${b.booking_id}')" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition flex items-center">
                <i class="fa-solid fa-video mr-1 text-[10px]"></i> Enter Room
              </button>
            ` : `
              <span class="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                Pending
              </span>
            `}
          </div>
        `;
        upcomingContainer.appendChild(div);
      });
    }

    // Load Badges in Dashboard
    const badgesContainer = document.getElementById('dash-badges-list');
    badgesContainer.innerHTML = '';
    (data.badges || []).slice(0, 4).forEach(b => {
      const bDiv = document.createElement('div');
      bDiv.className = 'bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center space-x-3';
      bDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm">
          <i class="${b.icon}"></i>
        </div>
        <div class="truncate">
          <h5 class="text-xs font-bold text-white truncate">${b.title}</h5>
          <p class="text-[10px] text-slate-400 truncate">${b.description}</p>
        </div>
      `;
      badgesContainer.appendChild(bDiv);
    });

  } catch (e) {
    console.error('Error loading dashboard', e);
  }
}

// 3. Load Smart Matching Partners
async function loadMatchingPartners() {
  const filterSkill = document.getElementById('matching-filter-skill').value;
  const grid = document.getElementById('partners-grid');
  grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>Analyzing reciprocal skill matches...</div>';

  try {
    const res = await fetch(`/api/matching/find-partners?studentId=${currentStudentId}&skill=${encodeURIComponent(filterSkill)}`);
    const data = await res.json();
    if (!data.success) return;

    grid.innerHTML = '';

    if (data.matches.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400">
          <i class="fa-solid fa-user-slash text-3xl mb-2 text-slate-600 block"></i>
          No matching partners found for this filter. Try selecting "All Skills"!
        </div>
      `;
      return;
    }

    data.matches.forEach(m => {
      const cand = m.student;
      const card = document.createElement('div');
      card.className = `glass-card rounded-2xl p-5 border flex flex-col justify-between ${
        m.isTwoWayReciprocal ? 'border-indigo-500/50 bg-gradient-to-br from-indigo-950/30 to-slate-900/80' : 'border-slate-800'
      }`;

      // Build tags
      let badgesHtml = '';
      if (m.isTwoWayReciprocal) {
        badgesHtml += `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center"><i class="fa-solid fa-bolt mr-1 text-amber-400"></i> PERFECT 2-WAY MATCH</span>`;
      }
      if (m.rating >= 4.8) {
        badgesHtml += `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center"><i class="fa-solid fa-star mr-1"></i> ${m.rating} ★</span>`;
      }

      // Can teach display
      const teachListHtml = m.allCandTeaches.map(t => `
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${t.verified ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}">
          ${t.verified ? '<i class="fa-solid fa-certificate text-[9px] mr-1 text-emerald-400"></i>' : ''}
          ${t.skill_name}
        </span>
      `).join(' ');

      // Wants to learn display
      const learnListHtml = m.allCandWants.map(w => `
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-950/40 text-cyan-300 border border-cyan-500/20">
          ${w.skill_name}
        </span>
      `).join(' ');

      // Target skill for booking
      const primarySkillId = m.candCanTeachMe[0]?.skill_id || m.allCandTeaches[0]?.skill_id || 'skill_java';
      const primarySkillName = m.candCanTeachMe[0]?.skill_name || m.allCandTeaches[0]?.skill_name || 'Skill';

      card.innerHTML = `
        <div class="space-y-4">
          <!-- Card Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <img src="${cand.avatar}" class="w-12 h-12 rounded-xl object-cover border-2 ${m.isTwoWayReciprocal ? 'border-indigo-500' : 'border-slate-700'}">
              <div>
                <h4 class="font-bold text-white text-sm flex items-center">
                  ${cand.name}
                </h4>
                <p class="text-[11px] text-indigo-400 font-medium">${cand.college}</p>
                <p class="text-[10px] text-slate-400">${cand.department}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="text-sm font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 block">
                ${m.matchPercentage}%
              </span>
              <span class="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block mt-0.5">Match</span>
            </div>
          </div>

          <!-- Badges -->
          <div class="flex flex-wrap gap-1.5">
            ${badgesHtml}
          </div>

          <!-- Bio -->
          <p class="text-xs text-slate-300 line-clamp-2 leading-relaxed">
            ${cand.bio}
          </p>

          <!-- Skills breakdown -->
          <div class="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div>
              <span class="text-[10px] uppercase font-bold text-indigo-400 block mb-1">Can Teach:</span>
              <div class="flex flex-wrap gap-1">${teachListHtml}</div>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-cyan-400 block mb-1">Wants to Learn:</span>
              <div class="flex flex-wrap gap-1">${learnListHtml}</div>
            </div>
          </div>

          <!-- Compatibility breakdown explanation -->
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
            <span class="text-[10px] font-bold uppercase text-slate-400 block"><i class="fa-solid fa-sparkles text-amber-400 mr-1"></i> Match Reasoning:</span>
            ${m.reasons.map(r => `<p class="flex items-center"><i class="fa-solid fa-check text-emerald-400 mr-1.5 text-[9px]"></i>${r}</p>`).join('')}
          </div>
        </div>

        <!-- Action Button -->
        <div class="pt-4 mt-2">
          <button onclick="openBookingModal('${cand.student_id}', '${primarySkillId}', '${primarySkillName}', '${cand.name}', '${cand.college}', '${cand.avatar}')" class="w-full py-2.5 rounded-xl ${
            m.isTwoWayReciprocal ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-800 hover:bg-slate-700'
          } text-white font-semibold text-xs shadow-lg transition flex items-center justify-center">
            <i class="fa-solid fa-calendar-plus mr-1.5"></i> Request Session with ${cand.name.split(' ')[0]}
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

  } catch (e) {
    console.error('Error finding matching partners', e);
  }
}

// 4. Load My Skills
async function loadMySkills() {
  try {
    const res = await fetch(`/api/auth/me?demoId=${currentStudentId}`);
    const data = await res.json();
    if (!data.success) return;

    const teachList = document.getElementById('teach-skills-list');
    const learnList = document.getElementById('learn-skills-list');
    teachList.innerHTML = '';
    learnList.innerHTML = '';

    const teachSkills = data.skills.filter(s => s.skill_type === 'TEACH');
    const learnSkills = data.skills.filter(s => s.skill_type === 'LEARN');

    document.getElementById('teach-skills-count').textContent = `${teachSkills.length} Skills`;
    document.getElementById('learn-skills-count').textContent = `${learnSkills.length} Skills`;

    // Render Teach Skills
    teachSkills.forEach(s => {
      const div = document.createElement('div');
      div.className = 'bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition';
      div.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg">
            <i class="${s.icon || 'fa-solid fa-code'}"></i>
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h4 class="font-bold text-white text-sm">${s.skill_name}</h4>
              ${s.verified ? `
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <i class="fa-solid fa-certificate text-[9px] mr-1"></i> VERIFIED (${s.verified_score}%)
                </span>
              ` : `
                <span class="text-[10px] text-slate-500 font-medium">Unverified</span>
              `}
            </div>
            <p class="text-xs text-slate-400">Level: <span class="text-slate-300 font-semibold">${s.proficiency}</span> • Category: ${s.category}</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          ${!s.verified ? `
            <button onclick="openQuizModal('${s.skill_id}', '${s.skill_name}')" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition flex items-center">
              <i class="fa-solid fa-shield-check mr-1 text-[10px]"></i> Take Quiz to Verify
            </button>
          ` : `
            <button onclick="openQuizModal('${s.skill_id}', '${s.skill_name}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition">
              Retake Quiz
            </button>
          `}
          <button onclick="removeSkill('${s.skill_id}', 'TEACH')" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      `;
      teachList.appendChild(div);
    });

    // Render Learn Skills
    learnSkills.forEach(s => {
      const div = document.createElement('div');
      div.className = 'bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition';
      div.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg">
            <i class="${s.icon || 'fa-solid fa-code'}"></i>
          </div>
          <div>
            <h4 class="font-bold text-white text-sm">${s.skill_name}</h4>
            <p class="text-xs text-slate-400">Target Proficiency: <span class="text-cyan-300 font-semibold">${s.proficiency}</span> • Category: ${s.category}</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button onclick="switchTab('matching')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center">
            <i class="fa-solid fa-magnifying-glass mr-1 text-[10px]"></i> Find Tutors
          </button>
          <button onclick="removeSkill('${s.skill_id}', 'LEARN')" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      `;
      learnList.appendChild(div);
    });

  } catch (e) {
    console.error('Error loading my skills', e);
  }
}

// 5. Load Sessions
let allSessionsCache = [];
let currentSessionFilter = 'ALL';

async function loadSessions() {
  const container = document.getElementById('sessions-container');
  container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading sessions...</div>';

  try {
    const res = await fetch(`/api/bookings?studentId=${currentStudentId}`);
    const data = await res.json();
    if (!data.success) return;

    allSessionsCache = data.bookings || [];
    renderFilteredSessions();
  } catch (e) {
    console.error('Error loading sessions', e);
  }
}

function filterSessions(status) {
  currentSessionFilter = status;
  document.querySelectorAll('.session-filter-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white');
    btn.classList.add('text-slate-400');
  });
  const activeBtn = document.getElementById(`session-filter-${status}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-indigo-600', 'text-white');
    activeBtn.classList.remove('text-slate-400');
  }
  renderFilteredSessions();
}

function renderFilteredSessions() {
  const container = document.getElementById('sessions-container');
  container.innerHTML = '';

  let list = allSessionsCache;
  if (currentSessionFilter !== 'ALL') {
    list = allSessionsCache.filter(b => b.status === currentSessionFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-8 text-center text-slate-400 text-xs border border-slate-800">
        <i class="fa-regular fa-calendar-xmark text-3xl mb-2 text-slate-600 block"></i>
        No sessions found in this category.
      </div>
    `;
    return;
  }

  list.forEach(b => {
    const isTeacher = b.teacher_id === currentStudentId;
    const isLearner = b.learner_id === currentStudentId;
    const otherName = isTeacher ? b.learner_name : b.teacher_name;
    const otherAvatar = isTeacher ? b.learner_avatar : b.teacher_avatar;
    const otherCollege = isTeacher ? b.learner_college : b.teacher_college;

    const div = document.createElement('div');
    div.className = 'glass-card rounded-2xl p-5 border border-slate-800 space-y-3';

    let statusPill = '';
    if (b.status === 'PENDING') {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">Pending Request</span>`;
    } else if (b.status === 'ACCEPTED') {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Confirmed & Scheduled</span>`;
    } else if (b.status === 'COMPLETED') {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">Completed & Credits Transferred</span>`;
    } else if (b.status === 'REJECTED') {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">Declined (Refunded)</span>`;
    }

    div.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div class="flex items-center space-x-3">
          <img src="${otherAvatar}" class="w-12 h-12 rounded-xl object-cover border border-indigo-500/40">
          <div>
            <div class="flex items-center space-x-2">
              <h4 class="font-bold text-white text-sm">${otherName}</h4>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded ${isTeacher ? 'bg-indigo-950 text-indigo-300' : 'bg-cyan-950 text-cyan-300'}">
                ${isTeacher ? 'You are Teaching' : 'You are Learning'}
              </span>
            </div>
            <p class="text-xs text-indigo-400 font-medium">${otherCollege}</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          ${statusPill}
          <span class="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            ${b.credit_amount} Credits
          </span>
        </div>
      </div>

      <!-- Session Details -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <span class="text-[10px] uppercase text-slate-500 font-semibold block">Topic</span>
          <span class="text-slate-200 font-medium">${b.topic}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-slate-500 font-semibold block">Date & Time</span>
          <span class="text-slate-200 font-mono">${b.session_date} at ${b.session_time} (${b.duration_minutes}m)</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-slate-500 font-semibold block">Skill</span>
          <span class="text-indigo-400 font-medium">${b.skill_name}</span>
        </div>
      </div>

      ${b.notes ? `
        <div class="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-xs text-slate-400 italic">
          "${b.notes}"
        </div>
      ` : ''}

      <!-- Action Buttons depending on role and status -->
      <div class="pt-2 flex flex-wrap items-center justify-end gap-2">
        ${b.status === 'PENDING' && isTeacher ? `
          <button onclick="respondBooking('${b.booking_id}', 'ACCEPT')" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">
            <i class="fa-solid fa-check mr-1"></i> Accept Request
          </button>
          <button onclick="respondBooking('${b.booking_id}', 'REJECT')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-xs font-medium transition">
            Decline
          </button>
        ` : ''}

        ${b.status === 'ACCEPTED' ? `
          <button onclick="openLiveRoom('${b.booking_id}')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center">
            <i class="fa-solid fa-video mr-1.5"></i> Enter Live Room
          </button>
        ` : ''}

        ${b.status === 'COMPLETED' ? `
          <button onclick="openReviewModal('${b.booking_id}')" class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition flex items-center">
            <i class="fa-solid fa-star mr-1"></i> Leave / View Review
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

// 6. Respond to booking (Accept/Reject)
async function respondBooking(bookingId, action) {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/respond`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadSessions();
      loadCurrentStudent();
    } else {
      showToast(data.message, 'error');
    }
  } catch (e) {
    showToast('Failed to respond to booking', 'error');
  }
}

// 7. Live Virtual Session Room
async function openLiveRoom(bookingId) {
  activeRoomBookingId = bookingId;
  const modal = document.getElementById('modal-session-room');
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/bookings/${bookingId}/room`);
    const data = await res.json();
    if (!data.success) return;

    const s = data.session;
    document.getElementById('room-session-topic').textContent = `${s.topic} (${s.skill_name})`;
    document.getElementById('room-teacher-name').textContent = s.teacher_name;
    document.getElementById('room-learner-name').textContent = s.learner_name;
    document.getElementById('room-teacher-stream').src = s.teacher_avatar;
    document.getElementById('room-learner-stream').src = s.learner_avatar;
    document.getElementById('room-credit-payout').textContent = `Payout: ${s.credit_amount} Credits`;

    updateRoomConfirmationChips(s.teacher_confirmed, s.learner_confirmed);

    // Start timer simulator
    startRoomTimer(s.duration_minutes * 60);
  } catch (e) {
    console.error('Error opening room', e);
  }
}

function updateRoomConfirmationChips(tConf, lConf) {
  const tChip = document.getElementById('room-teacher-confirm-chip');
  const lChip = document.getElementById('room-learner-confirm-chip');

  if (tConf === 1) {
    tChip.className = 'p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-center text-emerald-300 font-bold';
    tChip.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Teacher Confirmed';
  } else {
    tChip.className = 'p-2 rounded-lg bg-slate-900 border border-slate-700 text-center text-slate-400';
    tChip.innerHTML = '<i class="fa-regular fa-circle mr-1"></i> Teacher Pending';
  }

  if (lConf === 1) {
    lChip.className = 'p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-center text-emerald-300 font-bold';
    lChip.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Learner Confirmed';
  } else {
    lChip.className = 'p-2 rounded-lg bg-slate-900 border border-slate-700 text-center text-slate-400';
    lChip.innerHTML = '<i class="fa-regular fa-circle mr-1"></i> Learner Pending';
  }
}

function startRoomTimer(seconds) {
  if (activeSessionRoomInterval) clearInterval(activeSessionRoomInterval);
  let remaining = seconds;

  activeSessionRoomInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(activeSessionRoomInterval);
      return;
    }
    remaining--;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    document.getElementById('room-timer-display').textContent = 
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, 1000);
}

async function confirmRoomCompletion(forceDemo = false) {
  if (!activeRoomBookingId) return;

  try {
    const res = await fetch(`/api/bookings/${activeRoomBookingId}/confirm-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentStudentId,
        forceDemoComplete: forceDemo
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');

      if (data.status === 'COMPLETED') {
        // Trigger celebratory confetti!
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
        updateRoomConfirmationChips(1, 1);
        setTimeout(() => {
          closeModal('modal-session-room');
          openReviewModal(activeRoomBookingId);
          loadSessions();
          loadCurrentStudent();
        }, 1500);
      } else {
        updateRoomConfirmationChips(data.teacherConfirmed ? 1 : 0, data.learnerConfirmed ? 1 : 0);
      }
    } else {
      showToast(data.message, 'error');
    }
  } catch (e) {
    showToast('Failed to confirm completion', 'error');
  }
}

// 8. Skill Verification Quiz Assessment
async function openQuizModal(skillId, skillName) {
  const modal = document.getElementById('modal-quiz');
  modal.classList.remove('hidden');
  document.getElementById('quiz-skill-title').textContent = `${skillName} Technical Assessment`;
  document.getElementById('quiz-result-banner').classList.add('hidden');
  document.getElementById('quiz-submit-btn').classList.remove('hidden');

  const container = document.getElementById('quiz-questions-container');
  container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading assessment questions...</div>';

  try {
    const res = await fetch(`/api/verify/quiz/${skillId}`);
    const data = await res.json();
    if (!data.success) return;

    currentQuizData = { skillId, questions: data.questions };
    container.innerHTML = '';

    data.questions.forEach((q, idx) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3';
      qDiv.innerHTML = `
        <div class="flex items-start space-x-2">
          <span class="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
            ${idx + 1}
          </span>
          <p class="text-xs font-semibold text-white leading-relaxed">${q.question}</p>
        </div>
        <div class="space-y-2 pt-1">
          ${q.options.map((opt, optIdx) => `
            <label class="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-indigo-950/30 hover:border-indigo-500/40 cursor-pointer transition text-xs text-slate-300">
              <input type="radio" name="quiz-q-${idx}" value="${optIdx}" class="text-indigo-600">
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
      `;
      container.appendChild(qDiv);
    });
  } catch (e) {
    console.error('Error loading quiz', e);
  }
}

async function submitQuiz() {
  if (!currentQuizData) return;

  const answers = {};
  let answeredCount = 0;

  currentQuizData.questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="quiz-q-${idx}"]:checked`);
    if (selected) {
      answers[idx] = parseInt(selected.value, 10);
      answeredCount++;
    }
  });

  if (answeredCount < currentQuizData.questions.length) {
    showToast(`Please answer all ${currentQuizData.questions.length} questions before submitting!`, 'error');
    return;
  }

  try {
    const res = await fetch('/api/verify/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentStudentId,
        skillId: currentQuizData.skillId,
        answers
      })
    });
    const data = await res.json();
    if (!data.success) return;

    // Display result banner
    const banner = document.getElementById('quiz-result-banner');
    banner.classList.remove('hidden');

    if (data.passed) {
      banner.className = 'p-5 rounded-2xl border bg-emerald-950/70 border-emerald-500/50 text-emerald-200 text-xs space-y-2';
      banner.innerHTML = `
        <div class="flex items-center space-x-2 font-bold text-sm text-emerald-300">
          <i class="fa-solid fa-trophy text-amber-400 text-lg"></i>
          <span>Official Verification Earned! (${data.score}%)</span>
        </div>
        <p>${data.message}</p>
        <p class="font-medium text-white">Your skill is now officially marked as VERIFIED on your public profile and Learning Passport!</p>
      `;

      if (typeof confetti === 'function') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }
    } else {
      banner.className = 'p-5 rounded-2xl border bg-amber-950/70 border-amber-500/50 text-amber-200 text-xs space-y-2';
      banner.innerHTML = `
        <div class="flex items-center space-x-2 font-bold text-sm text-amber-300">
          <i class="fa-solid fa-circle-exclamation text-lg"></i>
          <span>Score: ${data.score}% (${data.correctCount}/${data.totalQuestions} correct)</span>
        </div>
        <p>${data.message}</p>
      `;
    }

    document.getElementById('quiz-submit-btn').classList.add('hidden');
    loadMySkills();
    loadCurrentStudent();

  } catch (e) {
    showToast('Failed to evaluate assessment', 'error');
  }
}

// 9. Load Credits Wallet & Transaction Ledger
async function loadCreditsLedger() {
  try {
    const res = await fetch(`/api/credits?studentId=${currentStudentId}`);
    const data = await res.json();
    if (!data.success) return;

    const c = data.credits;
    document.getElementById('credits-wallet-balance').textContent = c.balance;
    document.getElementById('credits-escrow-balance').textContent = `${c.escrow_balance} Credits`;
    document.getElementById('credits-total-earned').textContent = `${c.total_earned} Credits`;
    document.getElementById('credits-total-spent').textContent = `${c.total_spent} Credits`;

    const tbody = document.getElementById('credits-ledger-body');
    tbody.innerHTML = '';

    (data.transactions || []).forEach(t => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/60 transition';
      const isPositive = t.amount > 0;
      const formattedDate = new Date(t.created_at).toLocaleString();

      tr.innerHTML = `
        <td class="py-3 px-4 text-slate-400">${formattedDate}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
            t.type === 'WELCOME_BONUS' ? 'bg-indigo-500/20 text-indigo-300' :
            t.type === 'TEACHING_EARNED' ? 'bg-emerald-500/20 text-emerald-300' :
            t.type === 'SESSION_ESCROW' ? 'bg-amber-500/20 text-amber-300' :
            'bg-slate-800 text-slate-300'
          }">
            ${t.type}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-300 font-sans">${t.description}</td>
        <td class="py-3 px-4 text-right font-bold ${isPositive ? 'text-emerald-400' : t.amount < 0 ? 'text-rose-400' : 'text-slate-400'}">
          ${isPositive ? '+' : ''}${t.amount}
        </td>
        <td class="py-3 px-4 text-right font-bold text-white">${t.balance_after}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error('Error loading credits ledger', e);
  }
}

// 10. Claim Demo Faucet
async function claimDemoFaucet() {
  try {
    const res = await fetch('/api/credits/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: currentStudentId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadCreditsLedger();
      loadCurrentStudent();
    }
  } catch (e) {
    showToast('Failed to claim practice credits', 'error');
  }
}

// 11. Load Learning Passport (Verified Portfolio)
async function loadLearningPassport() {
  try {
    const res = await fetch(`/api/passport/${currentStudentId}`);
    const data = await res.json();
    if (!data.success) return;

    const p = data.passport;
    const s = p.student;

    document.getElementById('passport-credential-id').textContent = p.credentialId;
    document.getElementById('passport-avatar').src = s.avatar;
    document.getElementById('passport-name').textContent = s.name;
    document.getElementById('passport-dept').textContent = s.department;
    document.getElementById('passport-college').textContent = s.college;

    document.getElementById('passport-hours').textContent = `${Math.round(p.stats.totalTeachingMinutes / 6) / 10} hrs`;
    document.getElementById('passport-mentored').textContent = `${p.stats.totalStudentsMentored} Students`;
    document.getElementById('passport-rating').textContent = `${p.stats.avgRating} ★`;

    // Skills grid
    const skillsGrid = document.getElementById('passport-skills-grid');
    skillsGrid.innerHTML = '';
    p.verifiedSkills.forEach(sk => {
      const div = document.createElement('div');
      div.className = 'bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between';
      div.innerHTML = `
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm">
            <i class="${sk.icon || 'fa-solid fa-code'}"></i>
          </div>
          <div>
            <span class="text-xs font-bold text-white block">${sk.skill_name}</span>
            <span class="text-[10px] text-slate-400">${sk.proficiency}</span>
          </div>
        </div>
        <div>
          ${sk.verified ? `
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center">
              <i class="fa-solid fa-shield-check mr-1 text-[9px]"></i> ${sk.verified_score}%
            </span>
          ` : `
            <span class="text-[10px] text-slate-500 font-medium">Declared</span>
          `}
        </div>
      `;
      skillsGrid.appendChild(div);
    });

    // Badges grid
    const badgesGrid = document.getElementById('passport-badges-grid');
    badgesGrid.innerHTML = '';
    p.badges.forEach(b => {
      const bDiv = document.createElement('div');
      bDiv.className = 'bg-slate-900/80 p-3 rounded-xl border border-amber-500/30 flex items-center space-x-3';
      bDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm">
          <i class="${b.icon}"></i>
        </div>
        <div>
          <span class="text-xs font-bold text-white block">${b.title}</span>
          <span class="text-[10px] text-slate-400 block">${b.description}</span>
        </div>
      `;
      badgesGrid.appendChild(bDiv);
    });

    // Reviews list
    const reviewsList = document.getElementById('passport-reviews-list');
    reviewsList.innerHTML = '';
    if (p.reviews.length === 0) {
      reviewsList.innerHTML = '<p class="text-xs text-slate-500">No peer reviews yet.</p>';
    } else {
      p.reviews.forEach(r => {
        const rDiv = document.createElement('div');
        rDiv.className = 'bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2';
        rDiv.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2.5">
              <img src="${r.reviewer_avatar}" class="w-8 h-8 rounded-full object-cover">
              <div>
                <span class="text-xs font-bold text-white">${r.reviewer_name}</span>
                <span class="text-[10px] text-slate-400 block">${r.reviewer_college}</span>
              </div>
            </div>
            <div class="text-amber-400 text-xs font-bold">
              ${'★'.repeat(r.rating)}
            </div>
          </div>
          <p class="text-xs text-slate-300 italic">"${r.feedback}"</p>
          ${r.skills_tagged ? `<span class="inline-block text-[10px] text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">${r.skills_tagged}</span>` : ''}
        `;
        reviewsList.appendChild(rDiv);
      });
    }

  } catch (e) {
    console.error('Error loading passport', e);
  }
}

// 12. Load Smart Gap Finder
async function loadGapFinder() {
  const role = document.getElementById('gapfinder-role-select').value;
  const container = document.getElementById('gapfinder-results');
  container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Analyzing roadmap gap competencies...</div>';

  try {
    const res = await fetch(`/api/matching/gap-finder?studentId=${currentStudentId}&role=${role}`);
    const data = await res.json();
    if (!data.success) return;

    container.innerHTML = `
      <!-- Readiness Progress Bar -->
      <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-white uppercase tracking-wider">Roadmap Readiness for ${data.roadmap.title}</span>
          <span class="font-mono font-bold text-emerald-400 text-sm">${data.readinessPercentage}% Ready</span>
        </div>
        <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div class="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-700" style="width: ${data.readinessPercentage}%"></div>
        </div>
        <p class="text-[11px] text-slate-400">${data.masteredSkills.length} of ${data.roadmap.requiredSkills.length} competencies acquired or verified.</p>
      </div>

      <!-- Gap Breakdown & Recommended Student Mentors -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Missing Skills to Learn -->
        <div class="glass-card rounded-2xl p-6 border border-rose-500/30 space-y-4">
          <div class="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <div class="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h4 class="font-bold text-white text-sm">Identified Skill Gaps (${data.gapSkills.length})</h4>
              <p class="text-[11px] text-slate-400">Skills needed for this career profile</p>
            </div>
          </div>

          <div class="space-y-4">
            ${data.gapSkills.map(g => `
              <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-white">${g.name}</span>
                  <span class="text-[10px] text-slate-400">${g.category}</span>
                </div>
                
                <div>
                  <span class="text-[10px] uppercase font-bold text-indigo-400 block mb-1">Recommended Student Mentors Teaching This:</span>
                  ${g.availableTutors.length === 0 ? '<p class="text-[11px] text-slate-500">No active tutors registered yet.</p>' : `
                    <div class="space-y-2">
                      ${g.availableTutors.map(t => `
                        <div class="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <div class="flex items-center space-x-2">
                            <img src="${t.avatar}" class="w-7 h-7 rounded-full object-cover">
                            <div>
                              <span class="text-xs font-semibold text-slate-200">${t.name}</span>
                              <span class="text-[10px] text-slate-400 block">${t.college}</span>
                            </div>
                          </div>
                          <button onclick="openBookingModal('${t.student_id}', '${g.id}', '${g.name}', '${t.name}', '${t.college}', '${t.avatar}')" class="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition">
                            Book
                          </button>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Mastered Competencies -->
        <div class="glass-card rounded-2xl p-6 border border-emerald-500/30 space-y-4">
          <div class="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <h4 class="font-bold text-white text-sm">Competencies Mastered (${data.masteredSkills.length})</h4>
              <p class="text-[11px] text-slate-400">Skills already in your profile</p>
            </div>
          </div>

          <div class="space-y-3">
            ${data.masteredSkills.map(m => `
              <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-white">${m.name}</span>
                  <span class="text-[10px] text-slate-400 block">${m.category} • Level: ${m.userProficiency}</span>
                </div>
                ${m.verified ? `
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <i class="fa-solid fa-certificate text-[9px] mr-1"></i> VERIFIED
                  </span>
                ` : `
                  <span class="text-[10px] text-slate-400">Declared</span>
                `}
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

  } catch (e) {
    console.error('Error loading gap finder', e);
  }
}

// 13. Booking Modal Open & Submit
function openBookingModal(teacherId, skillId, skillName = 'UI/UX Design', teacherName = 'Rahul Verma', teacherCollege = 'NID Ahmedabad', teacherAvatar = '') {
  document.getElementById('booking-teacher-id').value = teacherId;
  document.getElementById('booking-skill-id').value = skillId;
  document.getElementById('booking-skill-display').value = skillName;
  document.getElementById('booking-teacher-name').textContent = teacherName;
  document.getElementById('booking-teacher-college').textContent = teacherCollege;
  if (teacherAvatar) document.getElementById('booking-teacher-avatar').src = teacherAvatar;

  // Set default date tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('booking-date').value = tomorrow.toISOString().split('T')[0];

  updateBookingCost();
  document.getElementById('modal-booking').classList.remove('hidden');
}

function updateBookingCost() {
  const duration = parseInt(document.getElementById('booking-duration').value, 10);
  document.getElementById('booking-cost-display').textContent = `${duration} Credits`;
}

async function submitBookingRequest() {
  const teacherId = document.getElementById('booking-teacher-id').value;
  const skillId = document.getElementById('booking-skill-id').value;
  const topic = document.getElementById('booking-topic').value || 'Peer Skill Exchange Session';
  const sessionDate = document.getElementById('booking-date').value;
  const sessionTime = document.getElementById('booking-time').value;
  const durationMinutes = parseInt(document.getElementById('booking-duration').value, 10);

  if (!sessionDate || !sessionTime) {
    showToast('Please select a valid session date and time!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learnerId: currentStudentId,
        teacherId,
        skillId,
        topic,
        sessionDate,
        sessionTime,
        durationMinutes
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-booking');
      loadCurrentStudent();
      switchTab('sessions');
    } else {
      showToast(data.message, 'error');
    }
  } catch (e) {
    showToast('Failed to create booking', 'error');
  }
}

// 14. Review Modal Open & Submit
function openReviewModal(bookingId) {
  document.getElementById('review-booking-id').value = bookingId;
  document.getElementById('modal-review').classList.remove('hidden');
}

function setRating(rating) {
  document.getElementById('review-rating').value = rating;
  const stars = document.querySelectorAll('#star-rating-container .star-btn');
  stars.forEach((s, idx) => {
    if (idx < rating) {
      s.className = 'fa-solid fa-star text-amber-400 star-btn';
    } else {
      s.className = 'fa-solid fa-star text-slate-700 star-btn';
    }
  });
}

async function submitReview() {
  const bookingId = document.getElementById('review-booking-id').value;
  const rating = parseInt(document.getElementById('review-rating').value, 10);
  const feedback = document.getElementById('review-feedback').value;
  const skillsTagged = document.getElementById('review-skills-tagged').value;

  if (!feedback) {
    showToast('Please provide written feedback for the peer mentor!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewerId: currentStudentId,
        bookingId,
        rating,
        feedback,
        skillsTagged
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-review');
      loadCurrentStudent();
    } else {
      showToast(data.message, 'error');
    }
  } catch (e) {
    showToast('Failed to submit review', 'error');
  }
}

// 15. Manage Skills: Add & Remove
async function loadAllMasterSkills() {
  try {
    const res = await fetch('/api/skills');
    const data = await res.json();
    if (!data.success) return;

    const select = document.getElementById('add-skill-select');
    select.innerHTML = '';
    data.skills.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.skill_id;
      opt.textContent = `${s.skill_name} (${s.category})`;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Error loading master skills', e);
  }
}

function openAddSkillModal() {
  document.getElementById('modal-add-skill').classList.remove('hidden');
}

async function submitAddSkill() {
  const skillId = document.getElementById('add-skill-select').value;
  const skillType = document.querySelector('input[name="add-skill-type"]:checked').value;
  const proficiency = document.getElementById('add-skill-proficiency').value;

  try {
    const res = await fetch('/api/skills/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentStudentId,
        skillId,
        skillType,
        proficiency
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-add-skill');
      loadMySkills();
    } else {
      showToast(data.message, 'error');
    }
  } catch (e) {
    showToast('Failed to add skill', 'error');
  }
}

async function removeSkill(skillId, skillType) {
  if (!confirm('Remove this skill from your profile?')) return;
  try {
    const res = await fetch('/api/skills/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentStudentId,
        skillId,
        skillType
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadMySkills();
    }
  } catch (e) {
    showToast('Failed to remove skill', 'error');
  }
}

// 16. Demo Persona Switcher
function openDemoSwitchModal() {
  document.getElementById('modal-demo-switch').classList.remove('hidden');
  toggleUserDropdown(false);
}

async function switchDemoPersona(studentId) {
  currentStudentId = studentId;
  localStorage.setItem('sb_student_id', studentId);
  closeModal('modal-demo-switch');
  showToast(`Active persona switched! Reloading profile...`, 'info');
  await initApp();
}

function toggleUserDropdown(forceClose) {
  const menu = document.getElementById('user-dropdown');
  if (forceClose === false) {
    menu.classList.add('hidden');
  } else {
    menu.classList.toggle('hidden');
  }
}

// Modal closing generic
function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
  if (modalId === 'modal-session-room' && activeSessionRoomInterval) {
    clearInterval(activeSessionRoomInterval);
  }
}
