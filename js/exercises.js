// exercises.js — Exercise definitions + pose-based rules for AI form checking

const EXERCISES = {
  bicep_curl: {
    id: 'bicep_curl',
    name: 'Bicep Curl',
    icon: '💪',
    muscle: 'Biceps, Forearms',
    difficulty: 'beginner',
    metFactor: 3.5,  // kcal/min/kg multiplier (rough)
    targetSets: 3,
    targetReps: 12,
    description: 'Track elbow flexion angle to count reps.',
    // The joint to watch for counting
    countJoint: 'elbow', // which joint drives rep count
    // Phase detection: "up" = contracted, "down" = extended
    phases: {
      up:   { leftElbow: [20, 60],   rightElbow: [20, 60] },   // flexed
      down: { leftElbow: [140, 180], rightElbow: [140, 180] },  // extended
    },
    formRules: [
      {
        id: 'elbow_lock',
        message: 'Fully extend arms at the bottom',
        check: (a) => a.leftElbow > 130 || a.rightElbow > 130,
        type: 'good',
      },
      {
        id: 'elbow_squeeze',
        message: 'Squeeze biceps at the top!',
        check: (a) => a.leftElbow < 70 || a.rightElbow < 70,
        type: 'good',
      },
      {
        id: 'shoulder_stable',
        message: 'Keep elbows close to your body',
        check: (a) => Math.abs(a.leftShoulder - a.rightShoulder) < 30,
        type: 'warn',
        penalty: 15,
      },
    ],
  },

  squat: {
    id: 'squat',
    name: 'Squat',
    icon: '🏋️',
    muscle: 'Quads, Glutes, Hamstrings',
    difficulty: 'beginner',
    metFactor: 5.0,
    targetSets: 3,
    targetReps: 15,
    countJoint: 'knee',
    phases: {
      up:   { leftKnee: [160, 180], rightKnee: [160, 180] },  // standing
      down: { leftKnee: [70, 110],  rightKnee: [70, 110] },   // squatted
    },
    formRules: [
      {
        id: 'depth',
        message: 'Great depth! Thighs parallel to floor.',
        check: (a) => a.leftKnee < 100 || a.rightKnee < 100,
        type: 'good',
      },
      {
        id: 'knee_cave',
        message: 'Keep knees aligned over toes — don\'t let them cave in',
        check: (a) => Math.abs(a.leftKnee - a.rightKnee) > 20,
        type: 'error',
        penalty: 20,
      },
      {
        id: 'back_straight',
        message: 'Keep your back straight, chest up!',
        check: (a) => a.leftHip > 40 && a.leftHip < 150,
        type: 'warn',
        penalty: 10,
      },
    ],
  },

  pushup: {
    id: 'pushup',
    name: 'Push-Up',
    icon: '🤸',
    muscle: 'Chest, Triceps, Shoulders',
    difficulty: 'beginner',
    metFactor: 4.5,
    targetSets: 3,
    targetReps: 15,
    countJoint: 'elbow',
    phases: {
      up:   { leftElbow: [150, 180], rightElbow: [150, 180] }, // extended (top)
      down: { leftElbow: [60, 110],  rightElbow: [60, 110] },  // bent (bottom)
    },
    formRules: [
      {
        id: 'full_extension',
        message: 'Fully extend arms at the top',
        check: (a) => a.leftElbow > 140 || a.rightElbow > 140,
        type: 'good',
      },
      {
        id: 'chest_low',
        message: 'Lower your chest closer to the ground',
        check: (a) => a.leftElbow < 100 || a.rightElbow < 100,
        type: 'good',
      },
      {
        id: 'body_straight',
        message: 'Keep your core tight — maintain a straight body line',
        check: (a) => a.leftHip > 150,
        type: 'warn',
        penalty: 15,
      },
    ],
  },

  lunge: {
    id: 'lunge',
    name: 'Lunge',
    icon: '🦵',
    muscle: 'Quads, Glutes, Hamstrings',
    difficulty: 'intermediate',
    metFactor: 4.0,
    targetSets: 3,
    targetReps: 10,
    countJoint: 'knee',
    phases: {
      up:   { leftKnee: [150, 180], rightKnee: [150, 180] },
      down: { leftKnee: [80, 120],  rightKnee: [80, 120] },
    },
    formRules: [
      {
        id: 'knee_angle',
        message: 'Front knee at 90° — good form!',
        check: (a) => (a.leftKnee > 85 && a.leftKnee < 100) || (a.rightKnee > 85 && a.rightKnee < 100),
        type: 'good',
      },
      {
        id: 'knee_over_toe',
        message: 'Don\'t let your front knee go past your toes',
        check: (a) => a.leftKnee < 80 || a.rightKnee < 80,
        type: 'error',
        penalty: 20,
      },
    ],
  },

  shoulder_press: {
    id: 'shoulder_press',
    name: 'Shoulder Press',
    icon: '🏆',
    muscle: 'Shoulders, Triceps',
    difficulty: 'intermediate',
    metFactor: 4.0,
    targetSets: 3,
    targetReps: 10,
    countJoint: 'elbow',
    phases: {
      up:   { leftElbow: [150, 180], rightElbow: [150, 180] }, // extended overhead
      down: { leftElbow: [70, 110],  rightElbow: [70, 110] },  // at shoulder
    },
    formRules: [
      {
        id: 'full_extension',
        message: 'Great — full overhead extension!',
        check: (a) => a.leftElbow > 155 && a.rightElbow > 155,
        type: 'good',
      },
      {
        id: 'core_tight',
        message: 'Don\'t arch your lower back — tighten your core',
        check: (a) => a.leftHip < 160,
        type: 'warn',
        penalty: 15,
      },
    ],
  },

  plank: {
    id: 'plank',
    name: 'Plank Hold',
    icon: '🧘',
    muscle: 'Core, Shoulders, Glutes',
    difficulty: 'beginner',
    metFactor: 3.0,
    targetSets: 3,
    targetReps: 1, // 1 "rep" = 1 hold counted
    countJoint: 'time', // time-based
    phases: {
      up:   { leftElbow: [85, 100], rightElbow: [85, 100] },
      down: { leftElbow: [85, 100], rightElbow: [85, 100] },
    },
    formRules: [
      {
        id: 'body_line',
        message: 'Body straight — perfect plank position!',
        check: (a) => a.leftHip > 155 && a.leftHip < 180,
        type: 'good',
      },
      {
        id: 'hips_up',
        message: 'Don\'t let your hips sag — keep them neutral',
        check: (a) => a.leftHip < 150,
        type: 'error',
        penalty: 25,
      },
      {
        id: 'hips_high',
        message: 'Lower your hips — don\'t pike up too high',
        check: (a) => a.leftHip > 185,
        type: 'warn',
        penalty: 10,
      },
    ],
  },

  jumping_jack: {
    id: 'jumping_jack',
    name: 'Jumping Jack',
    icon: '⭐',
    muscle: 'Full Body, Cardio',
    difficulty: 'beginner',
    metFactor: 7.0,
    targetSets: 3,
    targetReps: 20,
    countJoint: 'shoulder',
    phases: {
      up:   { leftShoulder: [150, 180], rightShoulder: [150, 180] }, // arms up
      down: { leftShoulder: [0, 30],    rightShoulder: [0, 30] },    // arms down
    },
    formRules: [
      {
        id: 'full_raise',
        message: 'Raise arms fully overhead!',
        check: (a) => a.leftShoulder > 155 || a.rightShoulder > 155,
        type: 'good',
      },
    ],
  },
};

// Helper to get exercise by id
function getExercise(id) {
  return EXERCISES[id] || null;
}

// Get all exercises as array
function getAllExercises() {
  return Object.values(EXERCISES);
}
