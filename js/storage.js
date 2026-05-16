// storage.js — All persistence via localStorage (no backend/DB needed)

const Storage = (() => {
  const KEYS = {
    HISTORY: 'formai_history',
    STATS:   'formai_stats',
    PBS:     'formai_pbs',
  };

  // ── Stats ──────────────────────────────────────────────────
  function getStats() {
    const d = localStorage.getItem(KEYS.STATS);
    return d ? JSON.parse(d) : {
      totalWorkouts: 0,
      totalReps: 0,
      totalCalories: 0,
      totalSeconds: 0,
      lastWorkoutDate: null,
      streak: 0,
      weeklyReps: [0,0,0,0,0,0,0], // Mon–Sun
    };
  }

  function saveStats(stats) {
    localStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  }

  // ── History ────────────────────────────────────────────────
  function getHistory() {
    const d = localStorage.getItem(KEYS.HISTORY);
    return d ? JSON.parse(d) : [];
  }

  function addSession(session) {
    const hist = getHistory();
    hist.unshift({ ...session, id: Date.now() });
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(hist));

    // Update stats
    const stats = getStats();
    stats.totalWorkouts++;
    stats.totalReps += session.totalReps || 0;
    stats.totalCalories += session.calories || 0;
    stats.totalSeconds += session.durationSeconds || 0;

    // Weekly reps
    const day = new Date().getDay(); // 0=Sun
    const idx = day === 0 ? 6 : day - 1; // Mon=0
    stats.weeklyReps[idx] = (stats.weeklyReps[idx] || 0) + (session.totalReps || 0);

    // Streak
    const today = new Date().toDateString();
    if (stats.lastWorkoutDate === today) {
      // same day, no change
    } else {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      stats.streak = stats.lastWorkoutDate === yesterday ? stats.streak + 1 : 1;
      stats.lastWorkoutDate = today;
    }
    saveStats(stats);

    // Update PBs
    updatePB(session.exercise, session.totalReps || 0);
  }

  // ── Personal Bests ─────────────────────────────────────────
  function getPBs() {
    const d = localStorage.getItem(KEYS.PBS);
    return d ? JSON.parse(d) : {};
  }

  function updatePB(exercise, reps) {
    const pbs = getPBs();
    if (!pbs[exercise] || reps > pbs[exercise]) {
      pbs[exercise] = reps;
      localStorage.setItem(KEYS.PBS, JSON.stringify(pbs));
    }
  }

  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return { getStats, saveStats, getHistory, addSession, getPBs, updatePB, clearAll };
})();
