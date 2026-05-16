// analyzer.js — AI form analysis, rep counting, feedback engine

const Analyzer = (() => {
  let exercise = null;
  let phase = 'down'; // current phase: 'up' or 'down'
  let repCount = 0;
  let setCount = 1;
  let formScore = 100;
  let formEvents = []; // feedback messages for session
  let formPenalty = 0;
  let repGoal = 12;
  let setGoal = 3;
  let onRepCb = null;
  let onFeedbackCb = null;
  let onFormScoreCb = null;

  // Smoothing buffer for angle stability
  const angleBuffer = {};
  const BUFFER_SIZE = 5;

  function smoothAngle(key, val) {
    if (!angleBuffer[key]) angleBuffer[key] = [];
    angleBuffer[key].push(val);
    if (angleBuffer[key].length > BUFFER_SIZE) angleBuffer[key].shift();
    return Math.round(angleBuffer[key].reduce((a, b) => a + b, 0) / angleBuffer[key].length);
  }

  // ── Load Exercise ──────────────────────────────────────────
  function loadExercise(ex, rg, sg) {
    exercise = ex;
    repGoal  = rg || ex.targetReps;
    setGoal  = sg || ex.targetSets;
    reset();
  }

  function reset() {
    phase      = 'down';
    repCount   = 0;
    setCount   = 1;
    formScore  = 100;
    formPenalty = 0;
    formEvents = [];
    Object.keys(angleBuffer).forEach(k => delete angleBuffer[k]);
  }

  function resetSet() {
    phase      = 'down';
    repCount   = 0;
    formPenalty = 0;
  }

  // ── Core Analysis ──────────────────────────────────────────
  function analyze(rawAngles) {
    if (!exercise || !rawAngles) return null;

    // Smooth angles
    const angles = {};
    Object.entries(rawAngles).forEach(([k, v]) => {
      angles[k] = smoothAngle(k, v);
    });

    // Phase detection → rep counting
    const phaseResult = detectPhase(angles);

    // Form rule evaluation
    const feedbacks = evaluateForm(angles);

    // Update live form score (decay-based)
    updateFormScore(feedbacks);

    return { angles, phase, repCount, setCount, formScore, feedbacks };
  }

  // ── Phase Detection & Rep Counting ────────────────────────
  function detectPhase(angles) {
    if (!exercise.phases) return null;

    const upPhase   = exercise.phases.up;
    const downPhase = exercise.phases.down;

    const inRange = (val, [min, max]) => val >= min && val <= max;

    // Check if angles match the "up" phase
    let matchesUp = false, matchesDown = false;

    if (exercise.countJoint === 'elbow') {
      matchesUp   = inRange(angles.leftElbow,  upPhase.leftElbow)   || inRange(angles.rightElbow,  upPhase.rightElbow);
      matchesDown = inRange(angles.leftElbow,  downPhase.leftElbow) || inRange(angles.rightElbow,  downPhase.rightElbow);
    } else if (exercise.countJoint === 'knee') {
      matchesUp   = inRange(angles.leftKnee,  upPhase.leftKnee)   || inRange(angles.rightKnee,  upPhase.rightKnee);
      matchesDown = inRange(angles.leftKnee,  downPhase.leftKnee) || inRange(angles.rightKnee,  downPhase.rightKnee);
    } else if (exercise.countJoint === 'shoulder') {
      matchesUp   = inRange(angles.leftShoulder,  upPhase.leftShoulder)   || inRange(angles.rightShoulder,  upPhase.rightShoulder);
      matchesDown = inRange(angles.leftShoulder,  downPhase.leftShoulder) || inRange(angles.rightShoulder,  downPhase.rightShoulder);
    } else if (exercise.countJoint === 'time') {
      return null; // time-based, handled separately
    }

    // State machine: down → up → down = 1 rep
    if (phase === 'down' && matchesUp) {
      phase = 'up';
    } else if (phase === 'up' && matchesDown) {
      phase = 'down';
      repCount++;
      if (onRepCb) onRepCb(repCount, setCount);
    }

    return { phase };
  }

  // ── Form Rules Evaluation ──────────────────────────────────
  function evaluateForm(angles) {
    if (!exercise.formRules) return [];
    const feedbacks = [];

    exercise.formRules.forEach(rule => {
      try {
        const triggered = rule.check(angles);
        if (triggered) {
          feedbacks.push({ message: rule.message, type: rule.type, id: rule.id, penalty: rule.penalty || 0 });
        }
      } catch(e) {}
    });

    return feedbacks;
  }

  // ── Form Score ─────────────────────────────────────────────
  let lastFeedbackTime = {};

  function updateFormScore(feedbacks) {
    const now = Date.now();
    let penaltyThisFrame = 0;

    feedbacks.forEach(fb => {
      // Only penalize once per 2 seconds per rule
      if (fb.type === 'error' || fb.type === 'warn') {
        const last = lastFeedbackTime[fb.id] || 0;
        if (now - last > 2000) {
          penaltyThisFrame += fb.penalty || 10;
          lastFeedbackTime[fb.id] = now;
          formEvents.push(fb);
          if (onFeedbackCb) onFeedbackCb(fb);
        }
      } else if (fb.type === 'good') {
        // Good feedback shown but no score change
        const last = lastFeedbackTime[fb.id + '_good'] || 0;
        if (now - last > 3000) {
          lastFeedbackTime[fb.id + '_good'] = now;
          if (onFeedbackCb) onFeedbackCb(fb);
        }
      }
    });

    formPenalty += penaltyThisFrame;
    formScore = Math.max(0, 100 - formPenalty);
    if (onFormScoreCb) onFormScoreCb(formScore);
  }

  // ── Calorie Calculation ────────────────────────────────────
  function calcCalories(durationSeconds, weightKg = 70) {
    if (!exercise) return 0;
    // MET formula: kcal = MET × weight(kg) × time(hours)
    const hours = durationSeconds / 3600;
    return Math.round(exercise.metFactor * weightKg * hours * 10) / 10;
  }

  // ── AI-Based Summary Generation ───────────────────────────
  function generateSummary() {
    const score = formScore;
    let rating, tips = [];

    if (score >= 85) {
      rating = '⭐ Excellent Form!';
      tips = ['Your posture is clean and controlled.', 'Great range of motion.', 'Keep it up!'];
    } else if (score >= 65) {
      rating = '👍 Good Form';
      tips = ['Minor form issues detected. Review feedback below.', 'Focus on slower, controlled reps.'];
    } else if (score >= 40) {
      rating = '⚠️ Needs Improvement';
      tips = ['Multiple form errors detected.', 'Reduce weight/reps and focus on technique.', 'Consider watching a tutorial for this exercise.'];
    } else {
      rating = '🔴 Poor Form — Be Careful';
      tips = ['High risk of injury detected.', 'Stop and rest, then restart with lighter load.', 'Prioritize form over rep count.'];
    }

    // Add exercise-specific tips
    const errorTypes = new Set(formEvents.filter(f => f.type === 'error').map(f => f.id));
    if (errorTypes.has('knee_cave'))   tips.push('💡 Tip: Knee cave — push knees outward, try goblet squats to reinforce.');
    if (errorTypes.has('elbow_lock'))  tips.push('💡 Tip: Fully extend elbows for maximum bicep activation.');
    if (errorTypes.has('body_straight')) tips.push('💡 Tip: Engage your core — brace your abs throughout the movement.');

    return { rating, tips, score, totalReps: repCount, totalSets: setCount - 1 };
  }

  // ── Event Callbacks ────────────────────────────────────────
  function onRep(cb)       { onRepCb = cb; }
  function onFeedback(cb)  { onFeedbackCb = cb; }
  function onFormScore(cb) { onFormScoreCb = cb; }

  function nextSet() {
    if (setCount < setGoal) {
      setCount++;
      resetSet();
      return true;
    }
    return false;
  }

  function getState() {
    return { repCount, setCount, formScore, phase, formEvents };
  }

  return {
    loadExercise, reset, resetSet, analyze,
    nextSet, getState, calcCalories, generateSummary,
    onRep, onFeedback, onFormScore,
    get repGoal() { return repGoal; },
    get setGoal()  { return setGoal; },
  };
})();
