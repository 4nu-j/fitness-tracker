// app.js — Main controller: routing, state management, UI binding

const App = (() => {
  // ── State ──────────────────────────────────────────────────
  let currentScreen   = 'splash';
  let selectedExercise = null;
  let cameraActive    = false;
  let workoutActive   = false;
  let workoutStart    = null;
  let timerInterval   = null;
  let elapsedSeconds  = 0;
  let sessionCalories = 0;
  const USER_WEIGHT   = 70; // kg — could be made configurable
  const MAX_FEEDBACK  = 6;

  // ── Screen Routing ─────────────────────────────────────────
  function goTo(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screen);
    if (el) el.classList.add('active');
    currentScreen = screen;

    if (screen === 'dashboard') renderDashboard();
    if (screen === 'history')   renderHistory();
    if (screen === 'analytics') renderAnalytics();
    if (screen === 'workout' && !selectedExercise) {
      goTo('dashboard');
      alert('Please select an exercise from the dashboard first!');
    }
  }

  // ── Dashboard ──────────────────────────────────────────────
  function renderDashboard() {
    // Greeting
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good Morning 💪' : hr < 17 ? 'Good Afternoon ⚡' : 'Good Evening 🔥';
    document.getElementById('greeting').textContent = greet;

    // Stats
    const stats = Storage.getStats();
    document.getElementById('totalWorkouts').textContent = stats.totalWorkouts;
    document.getElementById('totalReps').textContent = stats.totalReps;
    document.getElementById('totalCalories').textContent = Math.round(stats.totalCalories);
    document.getElementById('totalTime').textContent = formatTime(stats.totalSeconds);
    document.getElementById('streakCount').textContent = stats.streak;

    // Exercise cards
    const grid = document.getElementById('exerciseGrid');
    grid.innerHTML = '';
    getAllExercises().forEach(ex => {
      const card = document.createElement('div');
      card.className = 'exercise-card' + (selectedExercise?.id === ex.id ? ' selected' : '');
      card.innerHTML = `
        <span class="ex-diff diff-${ex.difficulty}">${ex.difficulty}</span>
        <span class="ex-icon">${ex.icon}</span>
        <span class="ex-name">${ex.name}</span>
        <span class="ex-muscle">${ex.muscle}</span>
      `;
      card.addEventListener('click', () => selectExercise(ex));
      grid.appendChild(card);
    });

    // Weekly chart
    Charts.renderWeekly('weeklyChart', stats.weeklyReps || [0,0,0,0,0,0,0]);
  }

  function selectExercise(ex) {
    selectedExercise = ex;
    document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('selected'));
    renderDashboard();
    // Go to workout screen
    setTimeout(() => startWorkoutScreen(ex), 200);
  }

  // ── Workout Screen ─────────────────────────────────────────
  function startWorkoutScreen(ex) {
    document.getElementById('workoutExerciseName').textContent = ex.name.toUpperCase();
    document.getElementById('currentSet').textContent = '1';
    document.getElementById('totalSets').textContent  = ex.targetSets;
    document.getElementById('repCount').textContent   = '0';
    document.getElementById('liveCalories').textContent = '0';
    document.getElementById('workoutTimer').textContent = '00:00';
    document.getElementById('repProgressFill').style.width = '0%';

    // Reset analyzer
    Analyzer.loadExercise(ex, ex.targetReps, ex.targetSets);

    // Feedback callbacks
    Analyzer.onRep((reps, set) => {
      updateRepUI(reps);
    });
    Analyzer.onFeedback((fb) => {
      addFeedbackItem(fb.message, fb.type);
    });
    Analyzer.onFormScore((score) => {
      updateFormScoreUI(score);
    });

    goTo('workout');
    addFeedbackItem(`Exercise loaded: ${ex.name}. Enable camera to begin pose detection.`, 'info');
    addFeedbackItem(`Target: ${ex.targetReps} reps × ${ex.targetSets} sets`, 'info');

    // Start timer
    startTimer();
    workoutActive = true;
  }

  function startTimer() {
    clearInterval(timerInterval);
    workoutStart  = Date.now();
    elapsedSeconds = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds = Math.round((Date.now() - workoutStart) / 1000);
      document.getElementById('workoutTimer').textContent = formatSeconds(elapsedSeconds);
      // Live calories
      sessionCalories = Analyzer.calcCalories(elapsedSeconds, USER_WEIGHT);
      document.getElementById('liveCalories').textContent = sessionCalories;
    }, 1000);
  }

  // ── Camera ─────────────────────────────────────────────────
  async function startCamera() {
    if (cameraActive) return;
    try {
      const video  = document.getElementById('webcam');
      const canvas = document.getElementById('poseCanvas');

      setStatus('detecting', 'Loading pose model...');

      const cam = PoseEngine.init(video, canvas, (data) => {
        if (!data.angles) return;

        // Update angle displays
        updateAngleDisplay(data.angles);

        // Run AI analysis
        const result = Analyzer.analyze(data.angles);
        if (!result) return;

        // Quality-based status
        if (data.quality > 70) {
          setStatus('active', 'Pose detected ✓');
        } else if (data.quality > 40) {
          setStatus('detecting', 'Partial pose');
        } else {
          setStatus('', 'No pose detected');
        }
      });

      PoseEngine.start();
      cameraActive = true;

      // Hide overlay
      document.getElementById('cameraOverlay').classList.add('hidden');
      addFeedbackItem('🎥 Camera active — get into position!', 'info');

    } catch (err) {
      addFeedbackItem('❌ Camera access denied. Please allow camera permissions.', 'error');
      console.error(err);
    }
  }

  function toggleCamera() {
    if (cameraActive) {
      PoseEngine.stop();
      cameraActive = false;
      document.getElementById('cameraOverlay').classList.remove('hidden');
      setStatus('', 'Camera off');
    } else {
      startCamera();
    }
  }

  // ── UI Updaters ────────────────────────────────────────────
  function updateRepUI(reps) {
    const el = document.getElementById('repCount');
    el.textContent = reps;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 120);

    // Progress bar
    const pct = Math.min(100, (reps / (selectedExercise?.targetReps || 12)) * 100);
    document.getElementById('repProgressFill').style.width = pct + '%';

    if (reps === selectedExercise?.targetReps) {
      addFeedbackItem(`✅ Set complete! Hit Next Set to continue.`, 'good');
    }
  }

  function updateFormScoreUI(score) {
    const el    = document.getElementById('formScoreVal');
    const ring  = document.getElementById('formRing');
    el.textContent = score;

    const color = score > 75 ? '#00e676' : score > 50 ? '#ffa726' : '#ff3b5c';
    const deg   = Math.round((score / 100) * 360);
    ring.style.background = `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)`;
    el.style.color = color;
  }

  function updateAngleDisplay(angles) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = isNaN(val) ? '--°' : val + '°';
    };
    set('angleLeftElbow',  angles.leftElbow);
    set('angleRightElbow', angles.rightElbow);
    set('angleLeftKnee',   angles.leftKnee);
    set('angleRightKnee',  angles.rightKnee);
    set('angleLeftHip',    angles.leftHip);
    set('angleRightHip',   angles.rightHip);
  }

  function setStatus(type, text) {
    const dot  = document.getElementById('statusDot');
    const span = document.getElementById('statusText');
    dot.className  = 'status-dot' + (type ? ' ' + type : '');
    span.textContent = text;
  }

  function addFeedbackItem(msg, type) {
    const list = document.getElementById('feedbackList');
    const item = document.createElement('div');
    item.className = `feedback-item ${type}`;
    item.textContent = msg;
    list.prepend(item);

    // Keep max N items
    while (list.children.length > MAX_FEEDBACK) {
      list.removeChild(list.lastChild);
    }
  }

  // ── Workout Controls ───────────────────────────────────────
  function resetSet() {
    Analyzer.resetSet();
    document.getElementById('repCount').textContent = '0';
    document.getElementById('repProgressFill').style.width = '0%';
    addFeedbackItem('Set reset.', 'info');
  }

  function nextSet() {
    const ok = Analyzer.nextSet();
    if (ok) {
      const state = Analyzer.getState();
      document.getElementById('currentSet').textContent = state.setCount;
      document.getElementById('repCount').textContent   = '0';
      document.getElementById('repProgressFill').style.width = '0%';
      addFeedbackItem(`🏁 Set ${state.setCount - 1} done! Rest 60s, then begin Set ${state.setCount}.`, 'good');
    } else {
      addFeedbackItem('All sets complete! Hit Finish to save your session.', 'good');
    }
  }

  function finishWorkout() {
    clearInterval(timerInterval);
    const state   = Analyzer.getState();
    const summary = Analyzer.generateSummary();
    const calories = Analyzer.calcCalories(elapsedSeconds, USER_WEIGHT);

    showResultModal({
      exercise: selectedExercise.name,
      exerciseId: selectedExercise.id,
      totalReps: state.repCount,
      totalSets: state.setCount - 1,
      formScore: state.formScore,
      durationSeconds: elapsedSeconds,
      calories,
      summary,
    });
  }

  function showResultModal(data) {
    document.getElementById('resultGrid').innerHTML = `
      <div class="result-item">
        <span class="result-item-val">${data.totalReps}</span>
        <span class="result-item-lbl">Total Reps</span>
      </div>
      <div class="result-item">
        <span class="result-item-val">${data.totalSets}</span>
        <span class="result-item-lbl">Sets Done</span>
      </div>
      <div class="result-item">
        <span class="result-item-val">${data.formScore}%</span>
        <span class="result-item-lbl">Form Score</span>
      </div>
      <div class="result-item">
        <span class="result-item-val">${Math.round(data.calories)}</span>
        <span class="result-item-lbl">Calories 🔥</span>
      </div>
      <div class="result-item">
        <span class="result-item-val">${formatSeconds(data.durationSeconds)}</span>
        <span class="result-item-lbl">Duration</span>
      </div>
      <div class="result-item">
        <span class="result-item-val">${selectedExercise.icon}</span>
        <span class="result-item-lbl">${data.exercise}</span>
      </div>
    `;

    document.getElementById('formFeedbackSummary').innerHTML = `
      <strong>${data.summary.rating}</strong><br/>
      ${data.summary.tips.map(t => `• ${t}`).join('<br/>')}
    `;

    // Store for save
    window._pendingSession = data;
    document.getElementById('resultModal').classList.remove('hidden');
  }

  function saveAndClose() {
    const s = window._pendingSession;
    if (s) {
      Storage.addSession({
        exercise: s.exerciseId,
        exerciseName: s.exercise,
        totalReps: s.totalReps,
        totalSets: s.totalSets,
        formScore: s.formScore,
        durationSeconds: s.durationSeconds,
        calories: s.calories,
      });
    }
    document.getElementById('resultModal').classList.add('hidden');
    PoseEngine.stop();
    cameraActive = false;
    workoutActive = false;
    selectedExercise = null;
    goTo('dashboard');
  }

  function exitWorkout() {
    if (workoutActive && !confirm('Exit workout? Progress will be lost.')) return;
    clearInterval(timerInterval);
    PoseEngine.stop();
    cameraActive = false;
    workoutActive = false;
    goTo('dashboard');
  }

  // ── History Screen ─────────────────────────────────────────
  function renderHistory() {
    const hist = Storage.getHistory();
    const list = document.getElementById('historyList');
    list.innerHTML = '';

    if (!hist.length) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No workouts yet. Go crush it! 💪</p>';
      return;
    }

    hist.forEach(s => {
      const ex = getExercise(s.exercise) || { icon: '🏋️' };
      const d  = new Date(s.id);
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <span class="history-ex-icon">${ex.icon}</span>
        <div class="history-info">
          <div class="history-name">${s.exerciseName || s.exercise}</div>
          <div class="history-date">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="history-stats">
          <div class="h-stat"><span class="h-stat-val">${s.totalReps || 0}</span><span class="h-stat-lbl">Reps</span></div>
          <div class="h-stat"><span class="h-stat-val">${s.formScore || 0}%</span><span class="h-stat-lbl">Form</span></div>
          <div class="h-stat"><span class="h-stat-val">${Math.round(s.calories || 0)}</span><span class="h-stat-lbl">kcal</span></div>
          <div class="h-stat"><span class="h-stat-val">${formatSeconds(s.durationSeconds || 0)}</span><span class="h-stat-lbl">Time</span></div>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // ── Analytics Screen ───────────────────────────────────────
  function renderAnalytics() {
    const hist = Storage.getHistory();
    Charts.renderExerciseChart('exerciseChart', hist);
    Charts.renderFormTrend('formTrendChart', hist);
    Charts.renderCalorieChart('calorieChart', hist);

    // Personal bests
    const pbs = Storage.getPBs();
    const pbList = document.getElementById('pbList');
    pbList.innerHTML = '';
    if (!Object.keys(pbs).length) {
      pbList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Complete workouts to see your personal bests!</p>';
    } else {
      Object.entries(pbs).forEach(([exId, reps]) => {
        const ex = getExercise(exId) || { icon: '🏋️', name: exId };
        const item = document.createElement('div');
        item.className = 'pb-item';
        item.innerHTML = `<span class="pb-item-name">${ex.icon} ${ex.name || exId}</span><span class="pb-item-val">${reps} reps 🏆</span>`;
        pbList.appendChild(item);
      });
    }
  }

  // ── Utilities ──────────────────────────────────────────────
  function formatSeconds(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    // Splash auto-transition after 600ms
    setTimeout(() => {
      document.getElementById('splash').classList.add('active');
    }, 100);
  }

  init();

  return {
    goTo, startCamera, toggleCamera,
    resetSet, nextSet, finishWorkout,
    saveAndClose, exitWorkout,
  };
})();
