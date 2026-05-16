// pose.js — MediaPipe Pose integration, landmark drawing, angle computation

const PoseEngine = (() => {
  let pose = null;
  let camera = null;
  let isRunning = false;
  let onResultsCb = null;

  // MediaPipe landmark indices
  const LM = {
    NOSE: 0,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,    RIGHT_WRIST: 16,
    LEFT_HIP: 23,      RIGHT_HIP: 24,
    LEFT_KNEE: 25,     RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,     RIGHT_HEEL: 30,
    LEFT_FOOT: 31,     RIGHT_FOOT: 32,
  };

  // ── Angle Calculation ──────────────────────────────────────
  function calcAngle(A, B, C) {
    // Angle at vertex B between points A-B-C
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs(radians * 180 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return Math.round(angle);
  }

  // ── Extract all important angles from landmarks ────────────
  function extractAngles(lm) {
    if (!lm || lm.length < 33) return null;
    const get = (i) => lm[i];

    const angles = {
      leftElbow:    calcAngle(get(LM.LEFT_SHOULDER),  get(LM.LEFT_ELBOW),  get(LM.LEFT_WRIST)),
      rightElbow:   calcAngle(get(LM.RIGHT_SHOULDER), get(LM.RIGHT_ELBOW), get(LM.RIGHT_WRIST)),
      leftKnee:     calcAngle(get(LM.LEFT_HIP),       get(LM.LEFT_KNEE),   get(LM.LEFT_ANKLE)),
      rightKnee:    calcAngle(get(LM.RIGHT_HIP),      get(LM.RIGHT_KNEE),  get(LM.RIGHT_ANKLE)),
      leftHip:      calcAngle(get(LM.LEFT_SHOULDER),  get(LM.LEFT_HIP),    get(LM.LEFT_KNEE)),
      rightHip:     calcAngle(get(LM.RIGHT_SHOULDER), get(LM.RIGHT_HIP),   get(LM.RIGHT_KNEE)),
      leftShoulder: calcAngle(get(LM.LEFT_ELBOW),     get(LM.LEFT_SHOULDER),  get(LM.LEFT_HIP)),
      rightShoulder:calcAngle(get(LM.RIGHT_ELBOW),    get(LM.RIGHT_SHOULDER), get(LM.RIGHT_HIP)),
    };
    return angles;
  }

  // ── Pose Quality Score (visibility-based) ─────────────────
  function getPoseQuality(lm) {
    if (!lm) return 0;
    const keyPoints = [
      LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
      LM.LEFT_ELBOW,    LM.RIGHT_ELBOW,
      LM.LEFT_HIP,      LM.RIGHT_HIP,
      LM.LEFT_KNEE,     LM.RIGHT_KNEE,
    ];
    const avg = keyPoints.reduce((s, i) => s + (lm[i]?.visibility || 0), 0) / keyPoints.length;
    return Math.round(avg * 100);
  }

  // ── Draw Skeleton ──────────────────────────────────────────
  function drawSkeleton(canvas, lm, formScore) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm || lm.length < 33) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const W = canvas.width;
    const H = canvas.height;

    const toPixel = (pt) => ({ x: pt.x * W, y: pt.y * H });

    // Color based on form score
    const jointColor = formScore > 75 ? '#00e676' : formScore > 50 ? '#ffa726' : '#ff3b5c';
    const boneColor  = formScore > 75 ? 'rgba(0,230,118,0.7)' : formScore > 50 ? 'rgba(255,167,38,0.7)' : 'rgba(255,59,92,0.7)';

    // Skeleton connections
    const connections = [
      [LM.LEFT_SHOULDER,  LM.RIGHT_SHOULDER],
      [LM.LEFT_SHOULDER,  LM.LEFT_ELBOW],
      [LM.LEFT_ELBOW,     LM.LEFT_WRIST],
      [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
      [LM.RIGHT_ELBOW,    LM.RIGHT_WRIST],
      [LM.LEFT_SHOULDER,  LM.LEFT_HIP],
      [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
      [LM.LEFT_HIP,       LM.RIGHT_HIP],
      [LM.LEFT_HIP,       LM.LEFT_KNEE],
      [LM.LEFT_KNEE,      LM.LEFT_ANKLE],
      [LM.RIGHT_HIP,      LM.RIGHT_KNEE],
      [LM.RIGHT_KNEE,     LM.RIGHT_ANKLE],
      [LM.LEFT_ANKLE,     LM.LEFT_HEEL],
      [LM.RIGHT_ANKLE,    LM.RIGHT_HEEL],
    ];

    // Draw connections (bones)
    ctx.lineWidth = 3;
    ctx.strokeStyle = boneColor;
    ctx.lineCap = 'round';
    connections.forEach(([a, b]) => {
      const pa = lm[a], pb = lm[b];
      if (!pa || !pb || pa.visibility < 0.4 || pb.visibility < 0.4) return;
      const pA = toPixel(pa), pB = toPixel(pb);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    });

    // Draw joints
    const keyJoints = Object.values(LM);
    keyJoints.forEach(i => {
      const pt = lm[i];
      if (!pt || pt.visibility < 0.4) return;
      const p = toPixel(pt);

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // Joint dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = jointColor;
      ctx.fill();
    });

    // Draw angle labels at key joints
    const angleLabels = [
      { joint: LM.LEFT_ELBOW,  label: 'L.Elbow' },
      { joint: LM.RIGHT_ELBOW, label: 'R.Elbow' },
      { joint: LM.LEFT_KNEE,   label: 'L.Knee' },
      { joint: LM.RIGHT_KNEE,  label: 'R.Knee' },
    ];
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8ff00';
    ctx.textAlign = 'center';
  }

  // ── Initialize MediaPipe Pose ──────────────────────────────
  function init(videoEl, canvasEl, onResults) {
    onResultsCb = onResults;

    pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    pose.onResults((results) => {
      const lm = results.poseLandmarks;
      const angles = extractAngles(lm);
      const quality = getPoseQuality(lm);
      if (onResultsCb) onResultsCb({ lm, angles, quality, results });
      drawSkeleton(canvasEl, lm, quality);
    });

    // Use MediaPipe Camera utility
    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (pose && isRunning) {
          await pose.send({ image: videoEl });
        }
      },
      width: 1280,
      height: 720,
    });

    return camera;
  }

  function start() {
    if (camera) {
      isRunning = true;
      camera.start();
    }
  }

  function stop() {
    isRunning = false;
    if (camera) camera.stop();
  }

  return { init, start, stop, LM, extractAngles, calcAngle, getPoseQuality };
})();
