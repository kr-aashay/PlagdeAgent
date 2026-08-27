/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — app.js
   Architecture: 100% client-side. Zero API calls. Zero rate limits.
   Handles 10,000+ simultaneous users with no backend whatsoever.
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── MCQ Question Bank ────────────────────────────────────────────────────────
const mcqQuestions = [
  {
    id: 1,
    question: "Which of the following is the most responsible way to use AI?",
    options: [
      {
        key: "A",
        text: "Submit AI-generated work as your own without checking it.",
        isCorrect: false,
        reason: "Submitting unchecked AI output risks presenting false or hallucinated information as fact."
      },
      {
        key: "B",
        text: "Verify AI-generated information before using it.",
        isCorrect: true,
        reason: "Fact-checking ensures accuracy, prevents misinformation, and maintains human responsibility."
      },
      {
        key: "C",
        text: "Share AI-generated misinformation.",
        isCorrect: false,
        reason: "Spreading unverified or misleading AI content causes real-world harm and erodes digital trust."
      },
      {
        key: "D",
        text: "Use AI to cheat in exams.",
        isCorrect: false,
        reason: "Using AI to bypass genuine learning defeats the educational process and violates academic integrity."
      }
    ]
  },
  {
    id: 2,
    question: "When using AI, personal or confidential information should:",
    options: [
      {
        key: "A",
        text: "Be shared with any AI tool.",
        isCorrect: false,
        reason: "Inputting sensitive data into public AI models can lead to severe privacy breaches and data leaks."
      },
      {
        key: "B",
        text: "Be posted publicly for better results.",
        isCorrect: false,
        reason: "Publicly exposing confidential records compromises personal and organizational security."
      },
      {
        key: "C",
        text: "Be protected and shared only when appropriate.",
        isCorrect: true,
        reason: "Protecting personal data aligns with privacy laws and responsible data governance."
      },
      {
        key: "D",
        text: "Not matter.",
        isCorrect: false,
        reason: "Data security and privacy are critical pillars of ethical technology usage."
      }
    ]
  },
  {
    id: 3,
    question: "AI should be used to:",
    options: [
      {
        key: "A",
        text: "Replace human judgment completely.",
        isCorrect: false,
        reason: "AI lacks critical thinking and moral reasoning; human oversight is always necessary."
      },
      {
        key: "B",
        text: "Create fake or misleading content.",
        isCorrect: false,
        reason: "Generating deceptive media or deepfakes undermines truth and digital safety."
      },
      {
        key: "C",
        text: "Support learning, innovation, and responsible decision-making.",
        isCorrect: true,
        reason: "AI serves best as an augmentative tool that empowers human learning and innovation."
      },
      {
        key: "D",
        text: "Harm others online.",
        isCorrect: false,
        reason: "Technology should never be weaponized for harassment or digital harm."
      }
    ]
  },
  {
    id: 4,
    question: "Who is ultimately responsible for decisions made using AI?",
    options: [
      {
        key: "A",
        text: "The AI tool alone",
        isCorrect: false,
        reason: "An AI system is a software program and cannot hold moral or legal liability."
      },
      {
        key: "B",
        text: "The user or organization using the AI",
        isCorrect: true,
        reason: "Human operators remain fully accountable for the outcomes of AI-assisted decisions."
      },
      {
        key: "C",
        text: "The internet",
        isCorrect: false,
        reason: "The internet is a network infrastructure, not an accountable entity."
      },
      {
        key: "D",
        text: "No one",
        isCorrect: false,
        reason: "Decisions always carry consequences, making human accountability essential."
      }
    ]
  },
  {
    id: 5,
    question: "If you use AI to create a report, presentation, or assignment, what is the best practice?",
    options: [
      {
        key: "A",
        text: "Claim it was entirely your own work.",
        isCorrect: false,
        reason: "Falsely taking total credit for AI-generated material violates honesty and attribution standards."
      },
      {
        key: "B",
        text: "Hide the fact that AI was used.",
        isCorrect: false,
        reason: "Concealing AI assistance breaches professional and academic transparency."
      },
      {
        key: "C",
        text: "Review, improve, and acknowledge AI assistance when required.",
        isCorrect: true,
        reason: "Combining human review with transparent disclosure represents high ethical standards."
      },
      {
        key: "D",
        text: "Submit it without reading it.",
        isCorrect: false,
        reason: "Submitting unreviewed work abdicates personal responsibility for quality and accuracy."
      }
    ]
  }
];

// ─── Polite error openings (rotate to avoid repetition) ──────────────────────
// {name} is replaced at runtime with the student's actual name.
const politeErrorOpenings = [
  "Sorry {name}, that option does not align with the responsible approach.",
  "Hold on {name}, let's think carefully about this choice.",
  "Not quite, {name}. That option introduces some ethical risks.",
  "Good try, {name}, but that choice doesn't follow responsible AI principles.",
  "Take another look, {name}. That path has a critical flaw."
];

// ─── Correct-answer personalised reinforcements ──────────────────────────────
const correctReinforcements = [
  "Spot on, {name}! {reason}",
  "Excellent choice, {name}! {reason}",
  "That's exactly right, {name}. {reason}",
  "Well done, {name}! {reason}",
  "Perfect, {name}. {reason}"
];

// ─── Deterministic follow-up responses (client-side, topic-keyed) ────────────
// Used after the quiz when the student asks free-form questions.
const followUpTopics = [
  {
    keywords: ["bias", "biased", "fair", "fairness", "discriminat"],
    response: (name) => `Great question, ${name}! AI bias occurs when training data reflects historical inequalities. Responsible practitioners audit models for fairness, test on diverse populations, and document known limitations before deployment.`
  },
  {
    keywords: ["privacy", "data", "personal", "gdpr", "confidential"],
    response: (name) => `Privacy is foundational, ${name}. Best practice means collecting only what's necessary (data minimisation), being transparent about usage, and giving people control over their own information — principles enshrined in regulations like GDPR.`
  },
  {
    keywords: ["transparent", "transparency", "explainab", "black box", "interpret"],
    response: (name) => `Transparency matters enormously, ${name}. Explainable AI (XAI) helps humans understand why a model made a decision, making it possible to catch errors, challenge outcomes, and build warranted trust.`
  },
  {
    keywords: ["responsible", "ethics", "ethical", "principle"],
    response: (name) => `Responsible AI rests on five pillars, ${name}: fairness, transparency, privacy, accountability, and safety. Keeping all five in balance — rather than optimising for just one — is what separates ethical practice from compliance theatre.`
  },
  {
    keywords: ["accountab", "responsibl", "blame", "liable", "liability"],
    response: (name) => `Accountability means humans — not the AI — own the outcomes, ${name}. That requires clear documentation of who made which decision, audit trails, and meaningful human review before high-stakes actions are taken.`
  },
  {
    keywords: ["deepfake", "fake", "misinform", "disinform", "hallucin"],
    response: (name) => `Misinformation is one of AI's biggest risks, ${name}. Combating it means verifying sources, using detection tools for synthetic media, and cultivating the habit of checking before sharing — exactly what you demonstrated in this assessment.`
  },
  {
    keywords: ["job", "work", "automat", "replac", "employment"],
    response: (name) => `AI reshapes work rather than simply replacing it, ${name}. Historical evidence shows technology creates new roles while eliminating others. The key is continuous skill development and designing AI systems that augment human capability rather than purely cut costs.`
  },
  {
    keywords: ["certif", "badge", "pledge", "download"],
    response: (name) => `Your badge is displayed in the popup, ${name}. Click "Download Badge" to save it as a PNG. It records your commitment to the five principles you just demonstrated.`
  },
  {
    keywords: ["learn", "study", "student", "education", "school", "academic"],
    response: (name) => `AI in education should enhance curiosity, not shortcut it, ${name}. Use AI to explore ideas, get explanations, and surface new perspectives — then verify, synthesise, and form your own conclusions. That's where real learning lives.`
  }
];

const fallbackFollowUp = (name) =>
  `That's a thoughtful question, ${name}. The core principle is always to keep humans informed, in control, and accountable when AI is involved. Keep exploring — responsible AI practice is a lifelong commitment, not a one-time pledge.`;

// ─── API base — all backend calls go to /APO/* ───────────────────────────────
// In production nginx routes vucse.app/APO → localhost:6003/APO
// Locally npm start serves everything from port 6003 directly.
const API_BASE = "/APO";
let state = {
  userName:        "",
  userType:        "student",   // "student" | "employee"
  userIdentifier:  "",          // reg no or emp id
  participantId:   null,        // MongoDB _id returned by /api/register
  currentQ:        0,
  errorOpeningIdx: 0,
  correctMsgIdx:   0,
  totalRetries:    0,
  result:          null,
  phase:           "register"   // "register" | "quiz" | "pledge" | "done"
};

// ─── DOM References ───────────────────────────────────────────────────────────
const $msgs         = document.getElementById("chatMessages");
// Registration bar (replaces old nameEntryBar — kept as $nameBar for restart compat)
const $nameBar      = document.getElementById("regBar");
const $nameInput    = document.getElementById("nameInput");
const $startBtn     = document.getElementById("startBtn");
const $regIdInput   = document.getElementById("regIdInput");
const $regIdIcon    = document.getElementById("regIdIcon");
const $regError     = document.getElementById("regError");
const $typeBtnStudent  = document.getElementById("typeBtnStudent");
const $typeBtnEmployee = document.getElementById("typeBtnEmployee");
const $mcqOptions   = document.getElementById("mcqOptions");
const $optionsGrid  = document.getElementById("optionsGrid");
const $chatInputBar = document.getElementById("chatInputBar");
const $chatInput    = document.getElementById("chatInput");
const $sendBtn      = document.getElementById("sendBtn");
const $badgeHolder  = document.getElementById("badgePlaceholder");
const $badgeResult  = document.getElementById("badgeResult");
const $badgeCanvas  = document.getElementById("badgeCanvas");
const $downloadCertBtn = document.getElementById("downloadCertBtn");
const $downloadBadgeBtn = document.getElementById("downloadBadgeBtn");
const $restartBtn   = document.getElementById("restartBtn");
const $badgeSummary = document.getElementById("badgeSummary");
const $statusText   = document.getElementById("statusText");
const $statusDot    = document.getElementById("statusDot");
const $progressPill     = document.getElementById("progressPill");
const $progressPillText = document.getElementById("progressPillText");
const $progressPillFill = document.getElementById("progressPillFill");
const $pledgeBar        = document.getElementById("pledgeBar");
const $pledgeScroll     = document.getElementById("pledgeScroll");
const $pledgeScrollHint = document.getElementById("pledgeScrollHint");
const $agreeBtn         = document.getElementById("agreeBtn");

// ─── Utility: HTML escape ─────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Utility: current time string ────────────────────────────────────────────
function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Status indicator ─────────────────────────────────────────────────────────
function setStatus(label, thinking = false) {
  $statusText.textContent = label;
  $statusDot.classList.toggle("thinking", thinking);
}

// ─── Header progress pill ─────────────────────────────────────────────────────
function updatePill(completed) {
  const total = mcqQuestions.length;
  const pct   = Math.round((completed / total) * 100);
  $progressPillText.textContent = `Q ${completed} / ${total}`;
  $progressPillFill.style.width = `${pct}%`;
}

// ─── Chat message factory ─────────────────────────────────────────────────────
function addMsg(role, html) {
  const wrap   = document.createElement("div");
  wrap.className = `msg ${role === "agent" ? "agent" : "user"}`;

  const avatar      = document.createElement("div");
  avatar.className  = "msg-avatar";
  avatar.textContent = role === "agent" ? "🤖" : "👤";

  const body        = document.createElement("div");
  body.className    = "msg-body";

  const bubble      = document.createElement("div");
  bubble.className  = "msg-bubble";
  bubble.innerHTML  = html;

  const ts          = document.createElement("div");
  ts.className      = "msg-time";
  ts.textContent    = timeNow();

  body.appendChild(bubble);
  body.appendChild(ts);
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  $msgs.appendChild(wrap);
  $msgs.scrollTop = $msgs.scrollHeight;
  return wrap;
}

// ─── Typing indicator (simulated AI "thinking") ───────────────────────────────
function showTyping() {
  const wrap        = document.createElement("div");
  wrap.className    = "msg agent";
  wrap.id           = "typingWrap";

  const avatar      = document.createElement("div");
  avatar.className  = "msg-avatar";
  avatar.textContent = "🤖";

  const ind         = document.createElement("div");
  ind.className     = "typing-indicator";
  for (let i = 0; i < 3; i++) {
    const d       = document.createElement("div");
    d.className   = "typing-dot";
    ind.appendChild(d);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(ind);
  $msgs.appendChild(wrap);
  $msgs.scrollTop = $msgs.scrollHeight;
}
function hideTyping() {
  document.getElementById("typingWrap")?.remove();
}

// ─── Inline progress bar (appended after each correct answer) ────────────────
function addProgressBar(completed) {
  const total = mcqQuestions.length;
  const pct   = Math.round((completed / total) * 100);

  const wrap = document.createElement("div");
  wrap.className = "progress-bar-wrap";
  wrap.innerHTML = `
    <div class="progress-label">
      <span>Assessment Progress</span>
      <span>${completed} / ${total} complete</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width:0%"></div>
    </div>`;

  $msgs.appendChild(wrap);
  $msgs.scrollTop = $msgs.scrollHeight;

  // Animate fill on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = wrap.querySelector(".progress-fill");
      if (fill) fill.style.width = `${pct}%`;
    });
  });
}

// ─── Background particles ─────────────────────────────────────────────────────
(function spawnParticles() {
  const wrap   = document.getElementById("bgParticles");
  const colors = ["#6366f1", "#818cf8", "#22c55e", "#f59e0b", "#a5b4fc"];
  for (let i = 0; i < 26; i++) {
    const el   = document.createElement("div");
    const size = Math.random() * 110 + 18;
    el.className = "particle";
    el.style.cssText =
      `width:${size}px;height:${size}px;` +
      `left:${Math.random() * 100}%;` +
      `background:${colors[i % colors.length]};` +
      `animation-duration:${Math.random() * 18 + 10}s;` +
      `animation-delay:-${Math.random() * 18}s;`;
    wrap.appendChild(el);
  }
})();

// ─── Welcome message ──────────────────────────────────────────────────────────
function showWelcome() {
  addMsg("agent",
    `Welcome to the <strong>Vignan AI Ethics Pledge</strong>. ⚖️<br><br>
     You are about to take a short <strong>5-question assessment</strong> designed to evaluate your understanding of responsible, ethical, and human-centered Artificial Intelligence practices.<br><br>
     Complete all five questions to demonstrate your commitment to Responsible AI and earn your personalized <em>AI Ethics Badge</em>.<br><br>
     Please enter your details below to begin the assessment.`
  );
}

// ─── Type toggle ──────────────────────────────────────────────────────────────
function setType(type) {
  state.userType = type;
  if (type === "student") {
    $typeBtnStudent.classList.add("active");
    $typeBtnEmployee.classList.remove("active");
    $regIdInput.placeholder = "Registration number…";
    $regIdIcon.textContent  = "🎓";
  } else {
    $typeBtnEmployee.classList.add("active");
    $typeBtnStudent.classList.remove("active");
    $regIdInput.placeholder = "Employee ID…";
    $regIdIcon.textContent  = "💼";
  }
}

// ─── Registration submission → POST /api/register ─────────────────────────────
async function startQuiz() {
  const identifier = $regIdInput.value.trim().toUpperCase();

  // Client-side validation
  if (!identifier) {
    const label = state.userType === "student" ? "registration number" : "employee ID";
    showRegError(`Please enter your ${label}.`);
    $regIdInput.focus(); return;
  }

  // Disable form while submitting
  $startBtn.disabled = true;
  $startBtn.textContent = "Registering…";
  hideRegError();

  try {
    const resp = await fetch(`${API_BASE}/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        type:       state.userType,
        identifier
      })
    });

    const data = await resp.json();

    // Check if user already completed the oath
    if (data.alreadyCompleted) {
      showRegError(data.message || "You have already completed the AI Ethics Pledge.");
      $startBtn.disabled = false;
      $startBtn.textContent = "Begin Assessment →";
      return;
    }

    if (!resp.ok || !data.ok) {
      showRegError(data.message || data.error || "Registration failed. Please check your ID.");
      $startBtn.disabled = false;
      $startBtn.textContent = "Begin Assessment →";
      return;
    }

    // Store in state (name is returned by the database lookup)
    state.userName       = data.name;
    state.userIdentifier = identifier;
    state.participantId  = data.participantId;
    state.phase          = "quiz";

  } catch (err) {
    console.warn("Registration API unreachable:", err.message);
    showRegError("Server connection failed. Registration requires an active university record check.");
    $startBtn.disabled = false;
    $startBtn.textContent = "Begin Assessment →";
    return;
  }

  // Hide reg bar, show progress pill
  $nameBar.style.display      = "none";
  $progressPill.style.display = "flex";
  updatePill(0);

  // Echo registration as a user "message" in the chat
  const typeLabel = state.userType === "student" ? "Student" : "Employee";
  addMsg("user",
    `${esc(name)} &mdash; ${typeLabel} &mdash; ${esc(state.userIdentifier)}`
  );

  // Coach greeting — name already known, no second ask
  setStatus("Coaching…", true);
  showTyping();
  setTimeout(() => {
    hideTyping();
    setStatus("Ready");
    addMsg("agent",
      `Welcome, <strong>${esc(name)}</strong>! 👋<br><br>
       I’m delighted to have you here.<br><br>
       I’ll guide you through <strong>${mcqQuestions.length} essential questions</strong> on AI ethics and responsible AI use.<br><br>
       For each question, select the option that best reflects ethical, responsible, and human-centered AI practices. You’ll receive personalized feedback after every response. If your answer is not the most appropriate choice, I’ll explain the reasoning and give you another opportunity to make the right decision.<br><br>
       Let’s begin your AI Ethics journey! ⚖️🤖`
    );
    setTimeout(() => presentQuestion(), 500);
  }, 900);
}

function showRegError(msg) {
  $regError.textContent    = "⚠ " + msg;
  $regError.style.display  = "block";
}
function hideRegError() {
  $regError.style.display = "none";
}

// ─── Present current question ─────────────────────────────────────────────────
function presentQuestion() {
  const q = mcqQuestions[state.currentQ];
  if (!q) return;

  addMsg("agent",
    `<strong>Question ${q.id} of ${mcqQuestions.length}</strong><br><br>${esc(q.question)}`
  );

  // Build option buttons
  $optionsGrid.innerHTML = "";
  q.options.forEach(opt => {
    const btn             = document.createElement("button");
    btn.className         = "option-btn";
    btn.dataset.key       = opt.key;
    btn.innerHTML         =
      `<span class="option-label">${esc(opt.key)}</span>${esc(opt.text)}`;
    btn.addEventListener("click", () => handleAnswer(opt, q));
    $optionsGrid.appendChild(btn);
  });

  $mcqOptions.style.display = "block";
  $msgs.scrollTop = $msgs.scrollHeight;
}

// ─── Answer handler — the core coach logic ───────────────────────────────────
function handleAnswer(opt, question) {
  // Immediately lock all buttons to prevent double-clicks
  document.querySelectorAll(".option-btn").forEach(b => b.classList.add("disabled"));

  // Highlight the chosen button
  const chosenBtn = document.querySelector(`.option-btn[data-key="${opt.key}"]`);

  // Echo the student's choice as a user message
  addMsg("user", `<strong>${esc(opt.key)}</strong> — ${esc(opt.text)}`);

  // Hide options panel while coach "thinks"
  $mcqOptions.style.display = "none";

  setStatus("Coaching…", true);
  showTyping();

  // Simulate a brief coaching pause (instant in terms of computation — pure UX)
  const delay = opt.isCorrect ? 600 : 800;
  setTimeout(() => {
    hideTyping();
    setStatus("Ready");

    if (opt.isCorrect) {
      onCorrect(opt, question);
    } else {
      onIncorrect(opt, question);
    }
  }, delay);
}

// ─── Correct answer path ──────────────────────────────────────────────────────
function onCorrect(opt, question) {
  // Build personalised reinforcement, cycling through templates
  const template = correctReinforcements[state.correctMsgIdx % correctReinforcements.length];
  state.correctMsgIdx++;

  const feedback = template
    .replace("{name}", esc(state.userName))
    .replace("{reason}", esc(opt.reason));

  addMsg("agent",
    `<span class="feedback-chip correct">✓ Correct</span><br><br>${feedback}`
  );

  // Advance state — only happens on correct answer
  state.currentQ++;
  updatePill(state.currentQ);
  addProgressBar(state.currentQ);

  if (state.currentQ >= mcqQuestions.length) {
    // All questions answered — finalise
    setTimeout(() => finalizeAssessment(), 900);
  } else {
    // Move to next question
    setTimeout(() => {
      addMsg("agent",
        `Moving on — <strong>Question ${state.currentQ + 1}</strong> of ${mcqQuestions.length}:`
      );
      setTimeout(() => presentQuestion(), 400);
    }, 700);
  }
}

// ─── Incorrect answer path — FREEZE on current question ──────────────────────
function onIncorrect(opt, question) {
  // Rotate through polite openings, replacing {name} placeholder
  const opening = politeErrorOpenings[state.errorOpeningIdx % politeErrorOpenings.length]
    .replace("{name}", esc(state.userName));
  state.errorOpeningIdx++;
  state.totalRetries++;

  addMsg("agent",
    `<span class="feedback-chip incorrect">✗ Let's Reconsider</span><br><br>
     <strong>${opening}</strong><br><br>
     ${esc(opt.reason)}<br><br>
     Re-read the options carefully and try <strong>Question ${question.id}</strong> again 👇`
  );

  // Re-present the SAME question — student stays frozen on it
  setTimeout(() => presentQuestion(), 700);
}

// ─── Finalize assessment & compute archetype ──────────────────────────────────
function finalizeAssessment() {
  state.phase = "done";
  setStatus("Complete ✓");
  $progressPill.style.display = "none";

  // Determine archetype purely from retries — 100% deterministic, no LLM
  let archetype, tagline, summary, emoji;

  if (state.totalRetries === 0) {
    archetype = "Ethics Vanguard";
    tagline   = "Guided by Unwavering Principles";
    emoji     = "🛡️";
    summary   = `${state.userName} completed the AI Ethics Pledge with flawless precision — selecting the correct, responsible option on the very first attempt for every question. A true Ethics Vanguard.`;
  } else if (state.totalRetries <= 2) {
    archetype = "Responsible Practitioner";
    tagline   = "Reflective and Principled";
    emoji     = "🌿";
    summary   = `${state.userName} demonstrated thoughtful reflection throughout the assessment, learning from feedback and aligning each answer with responsible AI principles.`;
  } else {
    archetype = "Ethics Apprentice";
    tagline   = "Dedicated to Continuous Growth";
    emoji     = "✍️";
    summary   = `${state.userName} completed the AI Ethics Pledge through interactive coaching, showing persistence and a genuine commitment to learning the principles of ethical AI.`;
  }

  // Store result on state so agreeAndReveal() can use it
  state.result = { name: state.userName, archetype, tagline, summary, emoji };

  addMsg("agent",
    `🎉 <strong>Outstanding, ${esc(state.userName)}!</strong><br><br>
     You've answered all ${mcqQuestions.length} questions correctly and demonstrated a strong
     understanding of responsible AI principles.<br><br>
     <strong>Designation:</strong> ${esc(emoji)} ${esc(archetype)}<br>
     <strong>Tagline:</strong> <em>${esc(tagline)}</em><br><br>
     One final step — read the <strong>Vignan AI Responsibility Oath</strong> below and
     click <em>"I Agree &amp; Claim My Badge"</em> to generate and unlock your
     personalised badge. 👇`
  );

  // Show the pledge bar — badge is gated behind agreement
  showPledgeBar();
}

// ─── Pledge bar — opens the modal overlay; scroll detection unlocks agree ─────
function showPledgeBar() {
  const overlay = document.getElementById("pledgeModalOverlay");
  if (overlay) overlay.style.display = "flex";

  $pledgeBar.style.display = "none";
  $msgs.scrollTop = $msgs.scrollHeight;

  const scrollEl = document.getElementById("pledgeScroll");
  const hintEl   = document.getElementById("pledgeScrollHint");
  const agreeEl  = document.getElementById("agreeBtn");

  if (!scrollEl || !agreeEl) return;

  // CRITICAL: reset to top so user reads from the beginning (not pre-scrolled to bottom)
  scrollEl.scrollTop = 0;

  function checkScroll() {
    const atBottom = Math.ceil(scrollEl.scrollTop) + scrollEl.clientHeight >= scrollEl.scrollHeight - 15;
    if (atBottom) {
      agreeEl.disabled = false;
      agreeEl.style.background = "linear-gradient(135deg, #6366f1, #818cf8)";
      if (hintEl) hintEl.classList.add("hidden");
      scrollEl.removeEventListener("scroll", checkScroll);
    }
  }

  scrollEl.addEventListener("scroll", checkScroll);

  // Check layout after modal is fully rendered to handle cases where no scrolling is needed
  setTimeout(() => {
    checkScroll();
  }, 150);
}

// ─── Agreement confirmed — close pledge modal, render badge ─────────────
function agreeAndReveal() {
  const pledgeOverlay = document.getElementById("pledgeModalOverlay");
  if (pledgeOverlay) pledgeOverlay.style.display = "none";
  $pledgeBar.style.display = "none";

  addMsg("user", `✍️ I, <strong>${esc(state.userName)}</strong>, agree to the Vignan AI Responsibility Oath.`);

  setStatus("Generating…", true);
  showTyping();

  // Fire-and-forget: mark pledge complete in MongoDB
  if (state.participantId) {
    fetch(`${API_BASE}/pledge-complete`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        participantId: state.participantId,
        archetype:     state.result?.archetype || "",
        totalRetries:  state.totalRetries
      })
    }).catch(err => console.warn("pledge-complete API error (non-fatal):", err.message));
  }

  setTimeout(() => {
    hideTyping();
    setStatus("Ready");

    addMsg("agent",
      `🏅 <strong>Your commitment is recorded, ${esc(state.userName)}!</strong><br><br>
       Your personalised certificate is downloading automatically. You can also download your <strong>AI Ethics Badge</strong> below.<br><br>
       Feel free to ask me any follow-up questions about AI ethics below.`
    );

    // Automatically trigger certificate download
    downloadFile("certificate").catch(err => console.warn("Auto certificate download failed:", err.message));

    renderBadgePreview(state.result, () => {
      const certOverlay = document.getElementById("certModalOverlay");
      if (certOverlay) certOverlay.style.display = "flex";
    });

    $downloadCertBtn.classList.remove("locked");
    $downloadBadgeBtn.classList.remove("locked");
    $chatInputBar.style.display = "flex";
  }, 1000);
}

// ─── Deterministic follow-up chat (zero API calls) ───────────────────────────
function sendFreeChat() {
  const raw = $chatInput.value.trim();
  if (!raw) return;
  $chatInput.value = "";

  addMsg("user", esc(raw));
  setStatus("Thinking…", true);
  showTyping();

  setTimeout(() => {
    hideTyping();
    setStatus("Ready");

    const lower    = raw.toLowerCase();
    const matched  = followUpTopics.find(t =>
      t.keywords.some(kw => lower.includes(kw))
    );
    const response = matched
      ? matched.response(esc(state.userName))
      : fallbackFollowUp(esc(state.userName));

    addMsg("agent", response);
  }, 700);
}

// ─── Preload badge and certificate template images at boot ──────────────────
const _badgeImg = new Image();
_badgeImg.src   = "/oath/assets/badge-template.png";

const _certImg = new Image();
_certImg.src   = "/oath/assets/certificate-template.png";
// onload/onerror handled silently — render functions check naturalWidth

// ─── Helper: Draw Name on Badge (Complex Layout) ──────────────────────────────
function drawNameOnBadge(canvas, ctx, result) {
  ctx.save();

  function getLines(text, maxW, font) {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines = [];
    let   line  = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const test = line + " " + words[i];
      if (ctx.measureText(test).width <= maxW) {
        line = test;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const maxW = canvas.width * 0.65;
  const maxFSize = Math.round(canvas.width * (35 / 420));
  let fSize = maxFSize;
  let lines = [result.name];

  // Try single line layout first
  let singleFit = false;
  let singleFSize = maxFSize;
  while (singleFSize > 20) {
    ctx.font = `bold ${singleFSize}px 'Poppins', 'Segoe UI', Arial, sans-serif`;
    if (ctx.measureText(result.name).width <= maxW) {
      singleFit = true;
      break;
    }
    singleFSize -= 2;
  }

  const minSingleThreshold = Math.round(canvas.width * (20 / 420));
  if (singleFit && singleFSize >= minSingleThreshold) {
    fSize = singleFSize;
    lines = [result.name];
  } else {
    fSize = Math.round(canvas.width * 0.08);
    while (fSize > 20) {
      const font = `bold ${fSize}px 'Poppins', 'Segoe UI', Arial, sans-serif`;
      const attempt = getLines(result.name, maxW, font);
      const allFit = attempt.every(line => ctx.measureText(line).width <= maxW);

      if (attempt.length <= 2 && allFit) {
        lines = attempt;
        break;
      }
      fSize -= 2;
    }

    if (lines.length > 1 && fSize > Math.round(canvas.width * 0.045)) {
      fSize = Math.round(canvas.width * 0.045);
    }
  }

  ctx.font      = `bold ${fSize}px 'Poppins', 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const centreY    = canvas.height * 0.48;
  const lineHeight = fSize * 1.25;

  const startY = centreY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, canvas.width / 2, startY + i * lineHeight));

  ctx.restore();
}

// ─── Helper: Draw Badge Fallback ──────────────────────────────────────────────
function drawBadgeFallback(canvas, ctx, result) {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0,   "#0f0c29");
  grad.addColorStop(0.5, "#1a1560");
  grad.addColorStop(1,   "#312e81");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let x = 30; x < canvas.width; x += 38) {
    for (let y = 30; y < canvas.height; y += 38) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#a5b4fc";
  ctx.font      = "bold 38px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("AI Ethics Pledge", canvas.width / 2, 140);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(canvas.width * 0.1, 170, canvas.width * 0.8, 2);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "22px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("This certifies that", canvas.width / 2, 230);
  ctx.fillStyle = "#ffffff";
  let nSize = 64;
  ctx.font = `bold ${nSize}px 'Segoe UI', Arial, sans-serif`;
  while (nSize > 28 && ctx.measureText(result.name).width > canvas.width * 0.78) {
    nSize -= 2; ctx.font = `bold ${nSize}px 'Segoe UI', Arial, sans-serif`;
  }
  ctx.fillText(result.name, canvas.width / 2, 320);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(canvas.width * 0.2, 350, canvas.width * 0.6, 1);
  ctx.fillStyle = "#94a3b8"; ctx.font = "20px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("has completed the AI Ethics Pledge Assessment", canvas.width / 2, 400);
  ctx.fillStyle = "#818cf8"; ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`${result.emoji}  ${result.archetype}`, canvas.width / 2, 470);
  ctx.fillStyle = "#64748b"; ctx.font = "italic 18px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`"${result.tagline}"`, canvas.width / 2, 510);
  ctx.fillStyle = "#475569"; ctx.font = "16px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }),
    canvas.width / 2, canvas.height - 60);
}

// ─── Initial Badge Render (for preview modal) ─────────────────────────────────
function renderBadgePreview(result, onComplete) {
  const canvas = $badgeCanvas;
  const ctx    = canvas.getContext("2d");

  function drawComplete() {
    $badgeSummary.innerHTML =
      `<strong>${esc(result.emoji)} ${esc(result.name)}</strong> — 
       <strong>${esc(result.archetype)}</strong><br>
       <em style="color:#8696a0;font-size:0.77rem">"${esc(result.summary)}"</em>`;

    if (typeof onComplete === "function") onComplete();
  }

  if (_badgeImg.complete && _badgeImg.naturalWidth > 0) {
    canvas.width  = _badgeImg.naturalWidth  || 3375;
    canvas.height = _badgeImg.naturalHeight || 3375;
    ctx.drawImage(_badgeImg, 0, 0, canvas.width, canvas.height);
    drawNameOnBadge(canvas, ctx, result);
    drawComplete();
  } else if (_badgeImg.complete && _badgeImg.naturalWidth === 0) {
    canvas.width  = 800;
    canvas.height = 800;
    drawBadgeFallback(canvas, ctx, result);
    drawComplete();
  } else {
    _badgeImg.onload = () => {
      canvas.width  = _badgeImg.naturalWidth  || 3375;
      canvas.height = _badgeImg.naturalHeight || 3375;
      ctx.drawImage(_badgeImg, 0, 0, canvas.width, canvas.height);
      drawNameOnBadge(canvas, ctx, result);
      drawComplete();
    };
    _badgeImg.onerror = () => {
      canvas.width  = 800;
      canvas.height = 800;
      drawBadgeFallback(canvas, ctx, result);
      drawComplete();
    };
  }
}

// ─── Download badge or certificate with tracking ──────────────────────────────
async function downloadFile(type) {
  const a = document.createElement("a");
  const safeName = state.userName.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-");
  
  // Use a separate offscreen canvas for download rendering so the on-screen preview is never affected or resized
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (type === "certificate") {
    // Render certificate template with just the name
    await renderCertificate(canvas, ctx, state.result);
    a.download = `AI-Ethics-Certificate-${safeName}.png`;
  } else {
    // Render badge template with full design
    await renderBadge(canvas, ctx, state.result);
    a.download = `AI-Ethics-Badge-${safeName}.png`;
  }
  
  a.href = canvas.toDataURL("image/png");
  a.click();
  
  // Track download in database
  if (state.participantId && !String(state.participantId).startsWith("offline_")) {
    try {
      await fetch(`${API_BASE}/track-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: state.participantId,
          downloadType: type
        })
      });
      console.log(`${type} download tracked successfully`);
    } catch (err) {
      console.warn(`Failed to track ${type} download:`, err.message);
    }
  }
}

// ─── Render Certificate (Simple - Just Name) ──────────────────────────────────
async function renderCertificate(canvas, ctx, result) {
  return new Promise((resolve) => {
    function drawCertificate() {
      if (_certImg.complete && _certImg.naturalWidth > 0) {
        // Use certificate template
        canvas.width = _certImg.naturalWidth || 1024;
        canvas.height = _certImg.naturalHeight || 576;
        ctx.drawImage(_certImg, 0, 0, canvas.width, canvas.height);
        
        // Add name in the center blank space
        ctx.save();
        
        // We use Times New Roman for elegant certificate style
        const fontName = "'Times New Roman', serif";
        
        // Dynamic font sizing based on name length
        // Maximum 40px for short names, scales down for longer names
        const maxW = canvas.width * 0.70; // Allow 70% width for name
        const nameLength = result.name.length;
        
        // Calculate starting font size based on name length
        let fSize;
        if (nameLength <= 15) {
          fSize = 40; // Short names get larger size
        } else if (nameLength <= 25) {
          fSize = 36; // Medium names
        } else if (nameLength <= 35) {
          fSize = 32; // Long names
        } else {
          fSize = 28; // Very long names
        }
        
        ctx.fillStyle = "#0b2265"; // Deep blue to match Vignan branding
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = `italic ${fSize}px ${fontName}`;
        
        // Further reduce if text still exceeds max width
        while (fSize > 20 && ctx.measureText(result.name).width > maxW) {
          fSize -= 1;
          ctx.font = `italic ${fSize}px ${fontName}`;
        }
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height * (295 / 576); // Position name higher above the line
        ctx.fillText(result.name, centerX, centerY);
        
        ctx.restore();
        resolve();
      } else {
        drawFallback();
      }
    }
    
    function drawFallback() {
      // Fallback if certificate template not loaded
      canvas.width = 1024;
      canvas.height = 576;
      
      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Borders
      ctx.lineWidth = 15;
      ctx.strokeStyle = "#0b2265";
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#c9a361"; // Gold
      ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);
      
      // Header
      ctx.textAlign = "center";
      ctx.fillStyle = "#0b2265";
      ctx.font = "bold 24px 'Poppins', sans-serif";
      ctx.fillText("CERTIFICATE OF RESPONSIBLE AND ETHICAL AI OATH", canvas.width / 2, 80);
      
      // Pill for Commemoration
      ctx.fillStyle = "#0058b6";
      const pillW = 380;
      const pillH = 28;
      ctx.fillRect((canvas.width - pillW) / 2, 110, pillW, pillH);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px 'Poppins', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("IN COMMEMORATION OF AGENTIC AI DAY", canvas.width / 2, 124);
      
      // Certify text
      ctx.fillStyle = "#111111";
      ctx.font = "italic 16px 'Georgia', serif";
      ctx.fillText("This is to Certify that", canvas.width / 2, 185);
      
      // Draw Name
      ctx.save();
      const fontName = "'Times New Roman', serif";
      
      // Dynamic font sizing based on name length
      const nameLength = result.name.length;
      let fSize;
      if (nameLength <= 15) {
        fSize = 40; // Short names get larger size
      } else if (nameLength <= 25) {
        fSize = 36; // Medium names
      } else if (nameLength <= 35) {
        fSize = 32; // Long names
      } else {
        fSize = 28; // Very long names
      }
      
      ctx.font = `italic ${fSize}px ${fontName}`;
      ctx.fillStyle = "#0b2265";
      ctx.textBaseline = "alphabetic";
      const maxW = canvas.width * 0.70;
      
      // Further reduce if text still exceeds max width
      while (fSize > 20 && ctx.measureText(result.name).width > maxW) {
        fSize -= 1;
        ctx.font = `italic ${fSize}px ${fontName}`;
      }
      ctx.fillText(result.name, canvas.width / 2, 295); // Draw name higher above the line at y=307
      ctx.restore();
      
      // Line under name
      ctx.beginPath();
      ctx.moveTo(300, 307);
      ctx.lineTo(724, 307);
      ctx.strokeStyle = "#99a0ba";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Description
      ctx.fillStyle = "#0b2265";
      ctx.font = "14px 'Poppins', sans-serif";
      const desc1 = "has participated in Ethical and Responsible AI Oath held on the occasion of";
      const desc2 = "Agentic AI Day, Organized by the Vignan's Foundation for Science, Technology and Research,";
      const desc3 = "on 29, August 2026.";
      ctx.fillText(desc1, canvas.width / 2, 345);
      ctx.fillText(desc2, canvas.width / 2, 370);
      ctx.fillText(desc3, canvas.width / 2, 395);
      
      // Footer text
      ctx.fillStyle = "#c9a361";
      ctx.font = "bold 13px 'Poppins', sans-serif";
      ctx.fillText("INNOVATE WITH INTELLIGENCE. LEAD WITH RESPONSIBILITY.", canvas.width / 2, 435);
      
      // Signature
      ctx.fillStyle = "#111111";
      ctx.font = "bold 11px 'Poppins', sans-serif";
      ctx.fillText("Dr. Lavu Rathaiah", canvas.width - 200, 485);
      ctx.font = "10px 'Poppins', sans-serif";
      ctx.fillText("Chairman, Vignan Group of Institutions", canvas.width - 200, 500);
      
      resolve();
    }
    
    if (_certImg.complete && _certImg.naturalWidth > 0) {
      drawCertificate();
    } else if (_certImg.complete && _certImg.naturalWidth === 0) {
      drawFallback();
    } else {
      _certImg.onload = drawCertificate;
      _certImg.onerror = drawFallback;
    }
  });
}

// ─── Render Badge (Full Design) ───────────────────────────────────────────────
async function renderBadge(canvas, ctx, result) {
  return new Promise((resolve) => {
    function drawBadge() {
      if (_badgeImg.complete && _badgeImg.naturalWidth > 0) {
        canvas.width = _badgeImg.naturalWidth || 3375;
        canvas.height = _badgeImg.naturalHeight || 3375;
        ctx.drawImage(_badgeImg, 0, 0, canvas.width, canvas.height);
        drawNameOnBadge(canvas, ctx, result);
        resolve();
      } else {
        // Fallback
        canvas.width = 800;
        canvas.height = 800;
        drawBadgeFallback(canvas, ctx, result);
        resolve();
      }
    }
    
    if (_badgeImg.complete) {
      drawBadge();
    } else {
      _badgeImg.onload = drawBadge;
      _badgeImg.onerror = drawBadge;
    }
  });
}

// ─── Restart — wipe all state and start fresh ─────────────────────────────────
function restart() {
  state = {
    userName:        "",
    userType:        "student",
    userIdentifier:  "",
    participantId:   null,
    currentQ:        0,
    errorOpeningIdx: 0,
    correctMsgIdx:   0,
    totalRetries:    0,
    result:          null,
    phase:           "register"
  };

  $msgs.innerHTML             = "";
  $nameInput.value            = "";
  $regIdInput.value           = "";
  $startBtn.disabled          = false;
  $startBtn.textContent       = "Begin Assessment →";
  hideRegError();
  setType("student");

  $nameBar.style.display      = "block";
  $mcqOptions.style.display   = "none";
  $pledgeBar.style.display    = "none";
  $chatInputBar.style.display = "none";
  $progressPill.style.display = "none";

  const po = document.getElementById("pledgeModalOverlay");
  const co = document.getElementById("certModalOverlay");
  if (po) po.style.display = "none";
  if (co) co.style.display = "none";

  const agreeEl = document.getElementById("agreeBtn");
  const hintEl  = document.getElementById("pledgeScrollHint");
  if (agreeEl) agreeEl.disabled = true;
  if (hintEl)  hintEl.classList.remove("hidden");
  $downloadCertBtn.classList.add("locked");
  $downloadBadgeBtn.classList.add("locked");

  setStatus("Ready");
  showWelcome();
}

// ─── Event listeners ──────────────────────────────────────────────────────────
// Type toggle
$typeBtnStudent.addEventListener("click",  () => setType("student"));
$typeBtnEmployee.addEventListener("click", () => setType("employee"));

// Registration submit (async, so no keydown-Enter on $nameInput — use button)
$startBtn.addEventListener("click", startQuiz);
[$nameInput, $regIdInput].forEach(el => {
  el.addEventListener("keydown", e => { if (e.key === "Enter") startQuiz(); });
});

$agreeBtn.addEventListener("click",   agreeAndReveal);

$sendBtn.addEventListener("click",   sendFreeChat);
$chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendFreeChat(); });

$downloadCertBtn.addEventListener("click", () => downloadFile("certificate"));
$downloadBadgeBtn.addEventListener("click", () => downloadFile("badge"));
$restartBtn.addEventListener("click",  restart);

// ─── Boot ─────────────────────────────────────────────────────────────────────
$downloadCertBtn.classList.add("locked");   // locked until pledge is agreed
$downloadBadgeBtn.classList.add("locked");  // locked until pledge is agreed
showWelcome();
