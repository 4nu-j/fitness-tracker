// charts.js — All Chart.js chart rendering

const Charts = (() => {
  const ACCENT  = '#e8ff00';
  const ACCENT2 = '#00d4ff';
  const DANGER  = '#ff3b5c';
  const SUCCESS = '#00e676';
  const MUTED   = 'rgba(255,255,255,0.12)';
  const TEXT    = '#6b7a8d';

  Chart.defaults.color = TEXT;
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  const instances = {};

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  // ── Weekly Rep Chart (Dashboard) ──────────────────────────
  function renderWeekly(canvasId, weeklyReps) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Reps',
          data: weeklyReps,
          backgroundColor: labels.map((_, i) => {
            const today = new Date().getDay();
            const idx = today === 0 ? 6 : today - 1;
            return i === idx ? ACCENT : 'rgba(232,255,0,0.2)';
          }),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: MUTED } },
          y: { grid: { color: MUTED }, beginAtZero: true, ticks: { stepSize: 5 } },
        },
      },
    });
  }

  // ── Exercise Reps Chart (Analytics) ───────────────────────
  function renderExerciseChart(canvasId, history) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const counts = {};
    history.forEach(s => {
      counts[s.exercise] = (counts[s.exercise] || 0) + (s.totalReps || 0);
    });

    const labels = Object.keys(counts);
    const data   = Object.values(counts);

    if (!labels.length) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [ACCENT, ACCENT2, SUCCESS, DANGER, '#ffa726', '#ce93d8'],
          borderWidth: 2,
          borderColor: '#0d1117',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 16, color: '#f0f4f8' } },
        },
      },
    });
  }

  // ── Form Score Trend (Analytics) ──────────────────────────
  function renderFormTrend(canvasId, history) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const recent = history.slice(0, 10).reverse();
    const labels = recent.map((_, i) => `Session ${i + 1}`);
    const data   = recent.map(s => s.formScore || 0);

    if (!labels.length) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Form Score',
          data,
          borderColor: SUCCESS,
          backgroundColor: 'rgba(0,230,118,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: SUCCESS,
          pointRadius: 5,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, grid: { color: MUTED } },
          x: { grid: { color: MUTED } },
        },
      },
    });
  }

  // ── Calorie Chart (Analytics) ──────────────────────────────
  function renderCalorieChart(canvasId, history) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const recent = history.slice(0, 8).reverse();
    const labels = recent.map(s => {
      const d = new Date(s.id);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    const data = recent.map(s => s.calories || 0);

    if (!labels.length) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Calories',
          data,
          backgroundColor: 'rgba(255,167,38,0.5)',
          borderColor: '#ffa726',
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: MUTED } },
          x: { grid: { color: MUTED } },
        },
      },
    });
  }

  return { renderWeekly, renderExerciseChart, renderFormTrend, renderCalorieChart };
})();
