/**
 * SUDOKU APPLICATION CONTROLLER & VIEW (MVC)
 * Tích hợp: Hiệu ứng rung khi điền nháp xung đột, kiểm tra xung đột nháp & khóa nút
 */

const STORAGE_KEY = 'sudoku_pwa_saved_game_state_v1';

const triggerHaptic = (pattern) => {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
};

const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

const DIFFICULTY_CONFIG = {
  easy: { size: 9, min: 36, max: 45, label: 'Easy' },
  medium: { size: 9, min: 32, max: 35, label: 'Medium' },
  hard: { size: 9, min: 27, max: 31, label: 'Hard' },
  expert: { size: 9, min: 22, max: 26, label: 'Expert' },
  extreme: { size: 9, min: 17, max: 20, label: 'Extreme' },
  sixteen: { size: 16, min: 96, max: 111, label: '16×16' }
};

/* ================= 1. VIEW LAYER ================= */
class SudokuView {
  constructor() {
    this.domBoard = document.getElementById('sudoku-board');
    this.domKeypad = document.getElementById('keypad-container');
    this.domControls = document.querySelector('.game-controls');
    this.domLoadingOverlay = document.getElementById('board-loading-overlay');
    this.domLoadingElapsed = document.getElementById('loading-time-elapsed');
    this.domBtnRestart = document.getElementById('btn-restart');
    this.domBtnBackMenu = document.getElementById('btn-back-menu');
    this.domPencilToggle = document.getElementById('btn-toggle-pencil');
    this.domPencilLabel = document.getElementById('lbl-pencil-state');
    this.domFastPencil = document.getElementById('btn-fast-pencil');
    this.domTimer = document.getElementById('display-timer');
    this.domMistakes = document.getElementById('display-mistakes');
    this.domDifficulty = document.getElementById('display-difficulty');
    this.domContinueBtn = document.getElementById('btn-continue');
    this.domModalDiff = document.getElementById('modal-difficulty');
    this.domVictoryScreen = document.getElementById('victory-screen');
    this.domSharePreview = document.getElementById('puzzle-share-preview');
    this.domToastCopy = document.getElementById('toast-copy');
    this.domDifficultyGrid = document.querySelector('.difficulty-grid');

    this.cellElements = [];
    this.buildDifficultyOptions();
  }

  buildDifficultyOptions() {
    Object.entries(DIFFICULTY_CONFIG).forEach(([key, config]) => {
      const button = document.createElement('button');
      button.className = `btn-diff${key === 'sixteen' ? ' diff-special' : ''}`;
      button.dataset.diff = key;
      button.innerHTML = `<span class="diff-name">${config.label}</span>`;
      this.domDifficultyGrid.appendChild(button);
    });
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  toggleDiffModal(show) {
    this.domModalDiff.classList.toggle('hidden', !show);
  }

  toggleVictoryScreen(show, stats = null) {
    if (show && stats) {
      document.getElementById('victory-time').textContent = stats.time;
      document.getElementById('victory-mistakes').textContent = stats.mistakes;
      document.getElementById('victory-diff').textContent = stats.difficulty;
      this.domSharePreview.textContent = stats.shareText;
      this.domToastCopy.classList.add('hidden');
    }
    this.domVictoryScreen.classList.toggle('hidden', !show);
  }

  setContinueVisible(visible) {
    this.domContinueBtn.classList.toggle('hidden', !visible);
  }

  setLoadingState(isLoading) {
    this.domBoard.classList.toggle('board-dimmed', isLoading);
    this.domLoadingOverlay.classList.toggle('hidden', !isLoading);
    this.domControls.classList.toggle('controls-disabled', isLoading);

    this.domBtnRestart.disabled = isLoading;
    this.domBtnRestart.classList.toggle('btn-disabled', isLoading);
    this.domBtnBackMenu.disabled = false;
  }

  setLoadingElapsedTime(timeStr) {
    if (this.domLoadingElapsed) {
      this.domLoadingElapsed.textContent = timeStr;
    }
  }

  buildBlankBoardDOM(size, symbols) {
    this.domBoard.innerHTML = '';
    this.domBoard.setAttribute('data-size', size);
    this.domBoard.parentElement.classList.toggle('board-container-16', size === 16);
    this.domBoard.closest('.board-wrapper').classList.toggle('board-wrapper-16', size === 16);
    this.cellElements = [];

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < size * size; i++) {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      cellDiv.dataset.index = i;

      const valSpan = document.createElement('span');
      valSpan.className = 'cell-value';
      cellDiv.appendChild(valSpan);

      const pencilGrid = document.createElement('div');
      pencilGrid.className = 'pencil-grid';

      for (let s = 1; s <= size; s++) {
        const slot = document.createElement('span');
        slot.className = 'pencil-slot';
        slot.dataset.val = s;
        slot.textContent = symbols[s - 1];
        pencilGrid.appendChild(slot);
      }

      cellDiv.appendChild(pencilGrid);
      fragment.appendChild(cellDiv);
      this.cellElements.push(cellDiv);
    }

    this.domBoard.appendChild(fragment);
    this.buildKeypadDOM(size, symbols);
  }

  buildKeypadDOM(size, symbols) {
    this.domKeypad.innerHTML = '';
    this.domKeypad.setAttribute('data-size', size);

    symbols.forEach((sym, idx) => {
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      btn.dataset.val = idx + 1;

      const symSpan = document.createElement('span');
      symSpan.className = 'key-sym';
      symSpan.textContent = sym;

      const countSpan = document.createElement('span');
      countSpan.className = 'key-count';
      countSpan.textContent = size;

      btn.appendChild(symSpan);
      btn.appendChild(countSpan);
      this.domKeypad.appendChild(btn);
    });
  }

  updateKeypadCounts(engine) {
    const size = engine.size;
    for (let val = 1; val <= size; val++) {
      const btn = this.domKeypad.querySelector(`.key-btn[data-val="${val}"]`);
      if (!btn) continue;

      const remaining = engine.getRemainingCount(val);
      const countSpan = btn.querySelector('.key-count');
      if (countSpan) {
        countSpan.textContent = remaining;
      }

      const isCompleted = remaining === 0;
      btn.disabled = isCompleted;
      btn.classList.toggle('btn-completed', isCompleted);
    }
  }

  renderAll(model) {
    const size = model.size;
    for (let i = 0; i < size * size; i++) {
      this.renderCell(i, model.cells[i], model);
    }
  }

  renderCell(index, cellData, model) {
    const el = this.cellElements[index];
    if (!el) return;

    const isSelected = el.classList.contains('selected-cell');
    const valSpan = el.querySelector('.cell-value');
    const pencilGrid = el.querySelector('.pencil-grid');

    el.className = 'cell';
    el.classList.toggle('selected-cell', isSelected);
    if (cellData.isClue) {
      el.classList.add('clue');
    } else if (cellData.val > 0) {
      el.classList.add('user-filled');
    }

    el.classList.toggle('cell-error', !!cellData.isError);

    if (cellData.val > 0) {
      valSpan.textContent = model.getSymbol(cellData.val);
      pencilGrid.style.display = 'none';
    } else {
      valSpan.textContent = '';
      pencilGrid.style.display = 'grid';

      const slots = pencilGrid.children;
      for (let s = 1; s <= model.size; s++) {
        const slot = slots[s - 1];
        const isNotePresent = (cellData.notes & (1 << (s - 1))) !== 0;
        slot.classList.toggle('visible', isNotePresent);
      }
    }
  }

  /**
   * Kích hoạt hiệu ứng rung trên một ô cờ cụ thể
   */
  shakeCell(index) {
    const el = this.cellElements[index];
    if (!el) return;
    el.classList.remove('cell-shake');
    void el.offsetWidth;
    el.classList.add('cell-shake');
    el.addEventListener('animationend', () => {
      el.classList.remove('cell-shake');
    }, { once: true });
  }

  applyHighlight(activeValue) {
    this.clearHighlight();
    if (!activeValue) return;

    const keyBtn = this.domKeypad.querySelector(`.key-btn[data-val="${activeValue}"]`);
    if (keyBtn) keyBtn.classList.add('active-key');

    this.cellElements.forEach(cellEl => {
      if (cellEl.dataset.currentVal === String(activeValue)) {
        cellEl.classList.add('highlight-val');
      }

      const targetSlot = cellEl.querySelector(`.pencil-slot[data-val="${activeValue}"]`);
      if (targetSlot && targetSlot.classList.contains('visible')) {
        targetSlot.classList.add('highlighted');
      }
    });
  }

  clearHighlight() {
    this.domKeypad.querySelectorAll('.key-btn').forEach(btn => btn.classList.remove('active-key'));
    this.cellElements.forEach(cellEl => {
      cellEl.classList.remove('highlight-val');
      const highlightedSlot = cellEl.querySelector('.pencil-slot.highlighted');
      if (highlightedSlot) highlightedSlot.classList.remove('highlighted');
    });
  }

  updatePencilModeUI(isActive) {
    this.domPencilToggle.classList.toggle('active-mode', isActive);
    this.domPencilLabel.textContent = isActive ? 'ON' : 'OFF';
    this.domKeypad.classList.toggle('pencil-active', isActive);
  }

  updateHeaderInfo(difficultyLabel, formattedTime, mistakes) {
    this.domDifficulty.textContent = difficultyLabel;
    this.domTimer.textContent = formattedTime;
    this.domMistakes.textContent = mistakes;
  }
}

/* ================= 2. CONTROLLER LAYER ================= */
class SudokuController {
  constructor() {
    this.engine = new SudokuEngine(9);
    this.view = new SudokuView();

    this.activeNumber = null;
    this.pencilMode = false;
    this.currentDifficultyKey = 'medium';
    this.timerSeconds = 0;
    this.mistakes = 0;
    this.timerInterval = null;

    this.isGenerating = false;
    this.isGameFinished = false;
    this.loadingStartTime = 0;
    this.loadingTimerInterval = null;

    this.initEventListeners();
    this.checkSavedGame();
    this.setupAutoSave();
    this.registerServiceWorker();
  }

  initEventListeners() {
    document.getElementById('btn-open-new-game').addEventListener('click', () => {
      this.view.toggleDiffModal(true);
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
      this.view.toggleDiffModal(false);
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
      if (this.isGenerating) {
        this.engine.terminateWorker();
        this.isGenerating = false;
      }
      this.stopTimer();
      this.stopLoadingTimer();
      this.view.setLoadingState(false);
      this.view.showScreen('start-screen');
      this.checkSavedGame();
    });

    this.view.domContinueBtn.addEventListener('click', () => {
      this.loadState();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      if (this.isGenerating) return;
      if (confirm('Are you sure you want to restart this game? All notes, time, and mistakes will be reset.')) {
        this.restartCurrentGame();
      }
    });

    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const diffKey = e.currentTarget.dataset.diff;
        this.view.toggleDiffModal(false);
        this.view.toggleVictoryScreen(false);
        this.startNewGame(diffKey);
      });
    });

    this.view.domKeypad.addEventListener('click', (e) => {
      if (this.isGenerating) return;
      const keyBtn = e.target.closest('.key-btn');
      if (!keyBtn || keyBtn.disabled) return;

      const clickedVal = parseInt(keyBtn.dataset.val, 10);
      triggerHaptic([30]);
      if (this.activeNumber === clickedVal) {
        this.activeNumber = null;
        this.view.clearHighlight();
      } else {
        this.activeNumber = clickedVal;
        this.refreshHighlights();
      }
    });

    this.view.domBoard.addEventListener('click', (e) => {
      if (this.isGenerating) return;
      const cellEl = e.target.closest('.cell');
      if (!cellEl) return;

      const idx = parseInt(cellEl.dataset.index, 10);
      this.handleCellClick(idx);
    });

    this.view.domPencilToggle.addEventListener('click', () => {
      if (this.isGenerating) return;
      this.pencilMode = !this.pencilMode;
      this.view.updatePencilModeUI(this.pencilMode);
    });

    this.view.domFastPencil.addEventListener('click', () => {
      if (this.isGenerating) return;
      if (this.engine.computeFastPencilMarks()) {
        this.renderBoard();
        this.refreshHighlights();
        this.saveState();
      }
    });

    document.getElementById('btn-copy-puzzle').addEventListener('click', () => {
      const shareText = this.engine.getShareablePuzzleText();
      navigator.clipboard.writeText(shareText).then(() => {
        this.view.domToastCopy.classList.remove('hidden');
        setTimeout(() => {
          this.view.domToastCopy.classList.add('hidden');
        }, 3000);
      });
    });

    document.getElementById('btn-victory-home').addEventListener('click', () => {
      this.view.toggleVictoryScreen(false);
      this.stopTimer();
      this.view.showScreen('start-screen');
      this.checkSavedGame();
    });

    document.getElementById('btn-victory-new-game').addEventListener('click', () => {
      this.view.toggleDiffModal(true);
    });
  }

  startLoadingTimer() {
    this.stopLoadingTimer();
    this.loadingStartTime = performance.now();
    this.view.setLoadingElapsedTime('00:00');

    this.loadingTimerInterval = setInterval(() => {
      const totalSeconds = Math.floor((performance.now() - this.loadingStartTime) / 1000);
      this.view.setLoadingElapsedTime(formatTime(totalSeconds));
    }, 250);
  }

  stopLoadingTimer() {
    if (this.loadingTimerInterval) {
      clearInterval(this.loadingTimerInterval);
      this.loadingTimerInterval = null;
    }
  }

  async startNewGame(diffKey) {
    const config = DIFFICULTY_CONFIG[diffKey];
    this.currentDifficultyKey = diffKey;
    this.activeNumber = null;
    this.pencilMode = false;
    this.timerSeconds = 0;
    this.mistakes = 0;
    this.isGenerating = true;
    this.isGameFinished = false;

    this.stopTimer();
    this.updateHeaderMeta();

    const symbols = config.size === 16 ? SYMBOLS_16 : SYMBOLS_9;
    this.view.buildBlankBoardDOM(config.size, symbols);
    this.view.updatePencilModeUI(false);
    this.view.clearHighlight();

    this.view.setLoadingState(true);
    this.startLoadingTimer();
    this.view.showScreen('game-screen');

    try {
      await this.engine.generatePuzzleInWorker(config.size, config.min, config.max);

      if (!this.isGenerating) return;

      this.isGenerating = false;
      this.stopLoadingTimer();

      this.view.setLoadingState(false);
      this.renderBoard();

      this.startTimer();
      this.saveState();
    } catch (err) {
      console.warn('Error occurred while generating the puzzle:', err);
    }
  }

  restartCurrentGame() {
    this.engine.restartPuzzle();
    this.timerSeconds = 0;
    this.mistakes = 0;
    this.activeNumber = null;
    this.isGameFinished = false;

    this.renderBoard();
    this.view.clearHighlight();
    this.startTimer();
    this.updateHeaderMeta();
    this.saveState();
  }

  handleCellClick(index) {
    if (this.isGameFinished) return;
    if (!this.activeNumber) return;

    const cell = this.engine.cells[index];
    this.view.cellElements.forEach(cellElement => cellElement.classList.remove('selected-cell'));
    this.view.cellElements[index]?.classList.add('selected-cell');
    if (this.engine.size === 16) {
      this.view.cellElements[index]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
    if (cell.isClue) return;
    if (cell.val > 0 && !cell.isError) return;

    if (!this.pencilMode) {
      /* ================= ĐIỀN SỐ CHÍNH THỨC ================= */
      if (cell.val === this.activeNumber) {
        cell.val = 0;
        cell.isError = false;
      } else {
        cell.val = this.activeNumber;
        cell.notes = 0;

        const expectedVal = this.engine.solution[index];
        if (this.activeNumber === expectedVal) {
          cell.isError = false;
          this.engine.eliminatePeerNotes(cell.r, cell.c, this.activeNumber);
        } else {
          cell.isError = true;
          this.mistakes++;
          triggerHaptic([50, 50, 50]);
          this.updateHeaderMeta();
        }
      }

      this.renderBoard();

      if (this.activeNumber && this.engine.getRemainingCount(this.activeNumber) === 0) {
        this.activeNumber = null;
        this.view.clearHighlight();
      }

      if (this.engine.isGameWon()) {
        this.handleGameWon();
      } else {
        this.saveState();
      }
    } else {
      /* ================= ĐIỀN NHÁP (PENCIL MARKS) ================= */
      if (cell.val === 0) {
        const bit = 1 << (this.activeNumber - 1);
        const isNotePresent = (cell.notes & bit) !== 0;

        if (!isNotePresent && this.engine.hasConflict(cell.r, cell.c, this.activeNumber)) {
          this.view.shakeCell(index);
          triggerHaptic([50, 50, 50]);
          return;
        }

        cell.notes ^= bit;
        this.view.renderCell(index, cell, this.engine);
        this.saveState();
      }
    }

    this.refreshHighlights();
  }

  handleGameWon() {
    this.isGameFinished = true;
    this.stopTimer();
    this.clearSavedGame();

    this.view.toggleVictoryScreen(true, {
      time: formatTime(this.timerSeconds),
      mistakes: this.mistakes,
      difficulty: DIFFICULTY_CONFIG[this.currentDifficultyKey].label,
      shareText: this.engine.getShareablePuzzleText()
    });
  }

  clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Error occurred while removing from LocalStorage:', e);
    }
    this.view.setContinueVisible(false);
  }

  renderBoard() {
    this.view.renderAll(this.engine);
    this.view.updateKeypadCounts(this.engine);
  }

  refreshHighlights() {
    this.engine.cells.forEach((c, idx) => {
      this.view.cellElements[idx].dataset.currentVal = c.val;
    });
    this.view.applyHighlight(this.activeNumber);
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateHeaderMeta();
    }, 1000);
    this.updateHeaderMeta();
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateHeaderMeta() {
    this.view.updateHeaderInfo(
      DIFFICULTY_CONFIG[this.currentDifficultyKey].label,
      formatTime(this.timerSeconds),
      this.mistakes
    );
  }

  setupAutoSave() {
    setInterval(() => {
      if (!this.isGenerating && !this.isGameFinished && document.getElementById('game-screen').classList.contains('active')) {
        this.saveState();
      }
    }, 3000);
  }

  saveState() {
    if (this.isGenerating || this.isGameFinished) return;
    const state = {
      engine: this.engine.serialize(),
      difficultyKey: this.currentDifficultyKey,
      timerSeconds: this.timerSeconds,
      mistakes: this.mistakes,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('LocalStorage Save Error:', e);
    }
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);

      this.currentDifficultyKey = state.difficultyKey || 'medium';
      this.timerSeconds = state.timerSeconds || 0;
      this.mistakes = state.mistakes || 0;
      this.activeNumber = null;
      this.pencilMode = false;
      this.isGenerating = false;
      this.isGameFinished = false;

      this.engine.deserialize(state.engine);
      this.view.buildBlankBoardDOM(this.engine.size, this.engine.symbols);
      this.view.setLoadingState(false);
      this.renderBoard();
      this.view.updatePencilModeUI(false);
      this.view.clearHighlight();

      this.view.showScreen('game-screen');
      this.startTimer();
      this.updateHeaderMeta();
    } catch (e) {
      console.error('Error occurred while loading saved game:', e);
      this.clearSavedGame();
    }
  }

  checkSavedGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    this.view.setContinueVisible(!!raw);
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('SW Registered:', reg.scope))
          .catch(err => console.error('SW Failed:', err));
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new SudokuController();
});