const SURGICAL_FIELD = { width: 900, height: 600 };
const GRID_COLS = 3;
const GRID_ROWS = 3;

const VISUAL_SIGNAL_TYPES = {
  POINT: 'point_to',
  INSTRUMENT: 'select_instrument',
  GESTURE: 'gesture'
};

const GESTURES = [
  { id: 'cut_here', label: '✂️ Cortar aquí', icon: 'scissors' },
  { id: 'clamp', label: '🔧 Pinzar', icon: 'clamp' },
  { id: 'careful', label: '⚠️ Cuidado', icon: 'warning' },
  { id: 'stop', label: '🛑 Detente', icon: 'stop' },
  { id: 'good', label: '✅ Bien', icon: 'check' },
  { id: 'no', label: '❌ No', icon: 'x' },
  { id: 'look_here', label: '👀 Mira aquí', icon: 'eye' },
  { id: 'move_left', label: '⬅️ Izquierda', icon: 'arrow_left' },
  { id: 'move_right', label: '➡️ Derecha', icon: 'arrow_right' },
  { id: 'move_up', label: '⬆️ Arriba', icon: 'arrow_up' },
  { id: 'move_down', label: '⬇️ Abajo', icon: 'arrow_down' }
];

const INSTRUMENTS = [
  { id: 'scalpel', label: 'Bisturí' },
  { id: 'clamp', label: 'Pinza hemostática' },
  { id: 'cauterizer', label: 'Cauterizador' },
  { id: 'needle', label: 'Aguja y sutura' },
  { id: 'forceps', label: 'Fórceps' }
];

const SCENARIOS = {
  appendectomy: {
    id: 'appendectomy',
    name: 'Apendicectomía de Emergencia',
    difficulty: 'media',
    description: 'Paciente con apendicitis aguda. Deben extirpar el apéndice antes de que se rompa. El equipo quirúrgico debe coordinarse: el Mudo ve y señala, el Sordo traduce visual→verbal, el Ciego opera sin ver.',
    timeLimit: 300,
    maxErrors: 8,
    organs: [
      { id: 'appendix', name: 'Apéndice inflamado', x: 600, y: 400, size: 40, color: '#e74c3c' },
      { id: 'cecum', name: 'Ciego (intestino)', x: 580, y: 420, size: 80, color: '#c8a882' },
      { id: 'artery', name: 'Arteria apendicular', x: 580, y: 380, size: 15, color: '#e74c3c' },
      { id: 'liver', name: 'Hígado', x: 300, y: 200, size: 120, color: '#8b4513' },
      { id: 'stomach', name: 'Estómago', x: 350, y: 300, size: 90, color: '#d4a574' },
      { id: 'small_intestine', name: 'Intestino delgado', x: 450, y: 450, size: 150, color: '#c8a882' }
    ],
    steps: [
      {
        id: 'identify',
        name: 'Identificar el apéndice',
        instruction: 'El Mudo debe señalar el apéndice inflamado. El Ciego debe hacer clic en la zona indicada.',
        description: 'Localicen el apéndice inflamado en el cuadrante inferior derecho.',
        instrument: null,
        targetZone: 5,
        hintForSordo: 'Dile al Ciego que haga clic en la ZONA 6 (inferior derecha).'
      },
      {
        id: 'incision',
        name: 'Realizar la incisión',
        instruction: 'El Mudo selecciona BISTURÍ y señala dónde cortar. El Ciego hace clic.',
        description: 'Usen el bisturí para hacer una incisión sobre el apéndice.',
        instrument: 'scalpel',
        targetZone: 5,
        hintForSordo: 'Dile al Ciego que seleccione BISTURÍ y haga clic en ZONA 6.'
      },
      {
        id: 'clamp',
        name: 'Pinzar la arteria',
        instruction: 'El Mudo selecciona PINZA y señala la arteria. El Ciego pinza.',
        description: 'Pinzen la arteria apendicular para evitar hemorragia.',
        instrument: 'clamp',
        targetZone: 4,
        hintForSordo: 'Dile al Ciego que seleccione PINZA y haga clic en ZONA 5 (centro).'
      },
      {
        id: 'cut_appendix',
        name: 'Cortar el apéndice',
        instruction: 'El Mudo selecciona BISTURÍ y señala la base. El Ciego corta.',
        description: 'Corten el apéndice por la base, debajo de la pinza.',
        instrument: 'scalpel',
        targetZone: 5,
        hintForSordo: 'Dile al Ciego que seleccione BISTURÍ y haga clic en ZONA 6.'
      },
      {
        id: 'cauterize',
        name: 'Cauterizar',
        instruction: 'El Mudo selecciona CAUTERIZADOR y señala el área. El Ciego cauteriza.',
        description: 'Cautericen el muñón para prevenir infección y detener sangrado.',
        instrument: 'cauterizer',
        targetZone: 5,
        hintForSordo: 'Dile al Ciego que seleccione CAUTERIZADOR y haga clic en ZONA 6.'
      },
      {
        id: 'suture',
        name: 'Cerrar la incisión',
        instruction: 'El Mudo selecciona AGUJA y señala la herida. El Ciego sutura.',
        description: 'Suturen la incisión para cerrar al paciente.',
        instrument: 'needle',
        targetZone: 5,
        hintForSordo: 'Dile al Ciego que seleccione AGUJA y haga clic en ZONA 6.'
      }
    ]
  }
};

function getZoneCenter(zoneIndex) {
  const cellWidth = SURGICAL_FIELD.width / GRID_COLS;
  const cellHeight = SURGICAL_FIELD.height / GRID_ROWS;
  const col = zoneIndex % GRID_COLS;
  const row = Math.floor(zoneIndex / GRID_COLS);
  return {
    x: col * cellWidth + cellWidth / 2,
    y: row * cellHeight + cellHeight / 2
  };
}

function getZoneForPoint(px, py) {
  const cellWidth = SURGICAL_FIELD.width / GRID_COLS;
  const cellHeight = SURGICAL_FIELD.height / GRID_ROWS;
  const col = Math.min(Math.floor(px / cellWidth), GRID_COLS - 1);
  const row = Math.min(Math.floor(py / cellHeight), GRID_ROWS - 1);
  return row * GRID_COLS + col;
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function createGame(roomCode, scenarioId = 'appendectomy') {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return null;

  const gameState = {
    scenarioId: scenario.id,
    scenario: JSON.parse(JSON.stringify(scenario)),
    currentStepIndex: 0,
    phase: 'playing',
    patientHealth: 100,
    score: 0,
    errors: 0,
    maxErrors: scenario.maxErrors,
    startTime: Date.now(),
    elapsedTime: 0,
    completedSteps: [],
    visualSignalHistory: [],
    clickHistory: [],
    lastVisualSignal: null,
    lastClickResult: null,
    gameOver: false,
    won: false
  };

  gameState.scenario.steps = gameState.scenario.steps.map(step => ({
    ...step,
    targetCenter: getZoneCenter(step.targetZone)
  }));

  return gameState;
}

function getCurrentStep(gameState) {
  const steps = gameState.scenario.steps;
  if (gameState.currentStepIndex >= steps.length) return null;
  return steps[gameState.currentStepIndex];
}

function handleVisualSignal(gameState, playerId, signal, playerRole) {
  if (gameState.gameOver) return { error: 'La partida terminó.' };
  if (playerRole !== 'mudo') return { error: 'Solo el Mudo puede enviar señales visuales.' };

  const entry = {
    playerId,
    role: 'mudo',
    signal,
    timestamp: Date.now()
  };

  gameState.visualSignalHistory.push(entry);
  gameState.lastVisualSignal = entry;

  return { success: true, signal: entry };
}

function handleSurgeonClick(gameState, playerId, zoneIndex, playerRole) {
  if (gameState.gameOver) return { error: 'La partida terminó.' };
  if (playerRole !== 'ciego') return { error: 'Solo el Ciego puede realizar clics quirúrgicos.' };

  if (zoneIndex < 0 || zoneIndex > 8) return { error: 'Zona inválida (0-8).' };

  const currentStep = getCurrentStep(gameState);
  if (!currentStep) return { error: 'No hay más pasos.' };

  const isCorrectZone = zoneIndex === currentStep.targetZone;
  const clickedCenter = getZoneCenter(zoneIndex);

  let result;
  if (isCorrectZone) {
    result = {
      success: true,
      stepId: currentStep.id,
      message: '¡Acierto! El paso se ha completado.'
    };

    gameState.completedSteps.push({
      stepId: currentStep.id,
      zoneIndex,
      timestamp: Date.now()
    });

    gameState.score += 100;

    if (gameState.currentStepIndex >= gameState.scenario.steps.length - 1) {
      gameState.phase = 'finished';
      gameState.gameOver = true;
      gameState.won = true;
      gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
      result.gameOver = true;
      result.won = true;
      result.finalScore = gameState.score;
    } else {
      gameState.currentStepIndex++;
    }
  } else {
    gameState.errors++;
    gameState.patientHealth = Math.max(0, 100 - (gameState.errors * 12));
    gameState.lastClickResult = {
      success: false,
      zoneIndex,
      correctZone: currentStep.targetZone,
      message: '¡Fallaste! Esa no es la zona correcta.'
    };

    result = {
      success: false,
      message: 'Zona incorrecta. ¡Intenten de nuevo!',
      errors: gameState.errors,
      maxErrors: gameState.maxErrors
    };

    if (gameState.errors >= gameState.maxErrors) {
      gameState.phase = 'finished';
      gameState.gameOver = true;
      gameState.won = false;
      gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
      result.gameOver = true;
      result.won = false;
      result.message = '¡Demasiados errores! El paciente no sobrevivió.';
    }
  }

  const clickEntry = {
    playerId,
    zoneIndex,
    clickedCenter,
    correctZone: currentStep.targetZone,
    wasCorrect: isCorrectZone,
    timestamp: Date.now()
  };
  gameState.clickHistory.push(clickEntry);

  return result;
}

function getGameState(gameState) {
  if (!gameState) return null;

  const currentStep = getCurrentStep(gameState);

  return {
    phase: gameState.phase,
    currentStepIndex: gameState.currentStepIndex,
    totalSteps: gameState.scenario.steps.length,
    currentStep: currentStep ? {
      id: currentStep.id,
      name: currentStep.name,
      instruction: currentStep.instruction,
      description: currentStep.description,
      instrument: currentStep.instrument
    } : null,
    patientHealth: gameState.patientHealth,
    score: gameState.score,
    errors: gameState.errors,
    maxErrors: gameState.maxErrors,
    elapsedTime: Math.floor((Date.now() - gameState.startTime) / 1000),
    completedSteps: gameState.completedSteps,
    lastVisualSignal: gameState.lastVisualSignal,
    lastClickResult: gameState.lastClickResult,
    gameOver: gameState.gameOver,
    won: gameState.won,
    organs: gameState.scenario.organs
  };
}

function getBlindGameState(gameState) {
  const full = getGameState(gameState);
  if (!full) return null;
  return {
    phase: full.phase,
    currentStepName: full.currentStep?.name || null,
    patientHealth: full.patientHealth,
    score: full.score,
    errors: full.errors,
    maxErrors: full.maxErrors,
    elapsedTime: full.elapsedTime,
    gameOver: full.gameOver,
    won: full.won,
    lastClickResult: full.lastClickResult,
    zoneGrid: generateZoneGrid()
  };
}

function generateZoneGrid() {
  const zones = [];
  for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
    const center = getZoneCenter(i);
    zones.push({
      index: i,
      label: `Zona ${i + 1}`,
      center
    });
  }
  return zones;
}

function getAvailableSignals() {
  return {
    signalTypes: VISUAL_SIGNAL_TYPES,
    gestures: GESTURES,
    instruments: INSTRUMENTS
  };
}

module.exports = {
  SURGICAL_FIELD,
  GRID_COLS,
  GRID_ROWS,
  VISUAL_SIGNAL_TYPES,
  GESTURES,
  INSTRUMENTS,
  SCENARIOS,
  createGame,
  getCurrentStep,
  handleVisualSignal,
  handleSurgeonClick,
  getGameState,
  getBlindGameState,
  getZoneCenter,
  getZoneForPoint,
  getAvailableSignals,
  generateZoneGrid
};
