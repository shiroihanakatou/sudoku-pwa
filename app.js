/**
 * SUDOKU APPLICATION CONTROLLER & VIEW (MVC)
 * Tích hợp: Hiệu ứng rung khi điền nháp xung đột, kiểm tra xung đột nháp & khóa nút
 */

const STORAGE_KEY = 'sudoku_pwa_saved_game_state_v1';
const MIN_BOARD_ZOOM = 1;
const MAX_BOARD_ZOOM = 2;

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
    const boxSize = size === 16 ? 4 : 3;
    const boxCount = size / boxSize;

    for (let boxRow = 0; boxRow < boxCount; boxRow++) {
      for (let boxCol = 0; boxCol < boxCount; boxCol++) {
        const boxDiv = document.createElement('div');
        boxDiv.className = 'board-box';

        for (let rowOffset = 0; rowOffset < boxSize; rowOffset++) {
          for (let colOffset = 0; colOffset < boxSize; colOffset++) {
            const row = boxRow * boxSize + rowOffset;
            const col = boxCol * boxSize + colOffset;
            const index = row * size + col;
            const cellDiv = document.createElement('div');
            cellDiv.className = 'cell';
            cellDiv.dataset.index = index;

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
            boxDiv.appendChild(cellDiv);
            this.cellElements[index] = cellDiv;
          }
        }

        fragment.appendChild(boxDiv);
      }
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
    this.boardNavigation = {
      pointers: new Map(),
      zoom: 1,
      panX: 0,
      panY: 0,
      lastDistance: 0,
      lastCenter: null,
      moved: false
    };

    this.initEventListeners();
    this.initBoardNavigation();
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

    this.view.domBtnBackMenu.addEventListener('click', () => {
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

    this.view.domBtnRestart.addEventListener('click', () => {
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

    window.addEventListener('resize', () => {
      this.syncBoardViewport();
      this.applyBoardNavigation();
    });
  }

  initBoardNavigation() {
    const wrapper = document.querySelector('.board-viewport');

    wrapper.addEventListener('pointerdown', (event) => {
      if (this.engine.size !== 16 || this.isGenerating) return;

      this.boardNavigation.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        wrapper.setPointerCapture(event.pointerId);
      } catch {
      }
      this.boardNavigation.moved = false;

      if (this.boardNavigation.pointers.size === 2) {
        this.boardNavigation.lastDistance = this.getPointerDistance();
        this.boardNavigation.lastCenter = this.getPointerCenter();
      }
    });

    wrapper.addEventListener('pointermove', (event) => {
      if (this.engine.size !== 16 || !this.boardNavigation.pointers.has(event.pointerId)) return;

      this.boardNavigation.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.boardNavigation.pointers.size === 1) {
        const previousPointer = this.boardNavigation.lastCenter;
        const deltaX = previousPointer ? event.clientX - previousPointer.x : 0;
        const deltaY = previousPointer ? event.clientY - previousPointer.y : 0;
        this.boardNavigation.panX += deltaX;
        this.boardNavigation.panY += deltaY;
        this.boardNavigation.lastCenter = { x: event.clientX, y: event.clientY };
        this.boardNavigation.moved = this.boardNavigation.moved || Math.hypot(deltaX, deltaY) > 4;
      } else if (this.boardNavigation.pointers.size === 2) {
        const distance = this.getPointerDistance();
        const center = this.getPointerCenter();
        const zoomFactor = this.boardNavigation.lastDistance ? distance / this.boardNavigation.lastDistance : 1;
        const wrapperRect = wrapper.getBoundingClientRect();

        this.zoomBoard(zoomFactor, center.x - wrapperRect.left, center.y - wrapperRect.top);
        this.boardNavigation.panX += center.x - this.boardNavigation.lastCenter.x;
        this.boardNavigation.panY += center.y - this.boardNavigation.lastCenter.y;
        this.boardNavigation.lastDistance = distance;
        this.boardNavigation.lastCenter = center;
        this.boardNavigation.moved = true;
      }

      this.clampBoardPan();
      this.applyBoardNavigation();
    });

    const endPointer = (event) => {
      if (!this.boardNavigation.pointers.has(event.pointerId)) return;

      this.boardNavigation.pointers.delete(event.pointerId);

      if (this.boardNavigation.pointers.size < 2) {
        this.boardNavigation.lastDistance = 0;
        this.boardNavigation.lastCenter = null;
      }
    };

    wrapper.addEventListener('pointerup', endPointer);
    wrapper.addEventListener('pointercancel', endPointer);
    wrapper.addEventListener('wheel', (event) => {
      if (this.engine.size !== 16 || this.isGenerating) return;

      event.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      this.zoomBoard(zoomFactor, event.clientX - rect.left, event.clientY - rect.top);
      this.applyBoardNavigation();
    }, { passive: false });
  }

  getPointerDistance() {
    const [first, second] = [...this.boardNavigation.pointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  getPointerCenter() {
    const points = [...this.boardNavigation.pointers.values()];
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
  }

  zoomBoard(factor, originX, originY) {
    const previousZoom = this.boardNavigation.zoom;
    const nextZoom = Math.min(MAX_BOARD_ZOOM, Math.max(MIN_BOARD_ZOOM, previousZoom * factor));
    const actualFactor = nextZoom / previousZoom;

    this.boardNavigation.panX = originX - (originX - this.boardNavigation.panX) * actualFactor;
    this.boardNavigation.panY = originY - (originY - this.boardNavigation.panY) * actualFactor;
    this.boardNavigation.zoom = nextZoom;
    this.clampBoardPan();
  }

  clampBoardPan() {
    if (this.view.domBoard.dataset.size !== '16') return;

    const wrapper = document.querySelector('.board-viewport');
    const container = this.view.domBoard.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const currentTransform = container.style.transform;
    container.style.transform = 'none';
    const baseRect = container.getBoundingClientRect();
    container.style.transform = currentTransform;
    const scaledWidth = container.offsetWidth * this.boardNavigation.zoom;
    const scaledHeight = container.offsetHeight * this.boardNavigation.zoom;
    const viewportLeft = wrapperRect.left;
    const viewportRight = wrapperRect.right;
    const viewportTop = wrapperRect.top;
    const viewportBottom = wrapperRect.bottom;

    if (this.boardNavigation.zoom <= MIN_BOARD_ZOOM) {
      this.boardNavigation.panX = (viewportLeft + viewportRight) / 2 - baseRect.left - scaledWidth / 2;
      this.boardNavigation.panY = (viewportTop + viewportBottom) / 2 - baseRect.top - scaledHeight / 2;
      return;
    }

    const horizontalEdgeA = viewportRight - baseRect.left - scaledWidth;
    const horizontalEdgeB = viewportLeft - baseRect.left;
    const minPanX = Math.min(horizontalEdgeA, horizontalEdgeB);
    const maxPanX = Math.max(horizontalEdgeA, horizontalEdgeB);
    this.boardNavigation.panX = Math.min(maxPanX, Math.max(minPanX, this.boardNavigation.panX));

    const verticalEdgeA = viewportBottom - baseRect.top - scaledHeight;
    const verticalEdgeB = viewportTop - baseRect.top;
    const minPanY = Math.min(verticalEdgeA, verticalEdgeB);
    const maxPanY = Math.max(verticalEdgeA, verticalEdgeB);
    this.boardNavigation.panY = Math.min(maxPanY, Math.max(minPanY, this.boardNavigation.panY));
  }

  applyBoardNavigation() {
    const container = this.view.domBoard.parentElement;
    if (this.view.domBoard.dataset.size !== '16') {
      container.style.transform = '';
      return;
    }

    this.clampBoardPan();
    container.style.transform = `translate3d(${this.boardNavigation.panX}px, ${this.boardNavigation.panY}px, 0) scale(${this.boardNavigation.zoom})`;
  }

  syncBoardViewport() {
    const viewport = document.querySelector('.board-viewport');
    const container = this.view.domBoard.parentElement;
    if (!viewport || this.view.domBoard.dataset.size !== '16') {
      viewport?.style.removeProperty('width');
      viewport?.style.removeProperty('height');
      viewport?.style.removeProperty('flex');
      return;
    }

    viewport.style.width = `${container.offsetWidth}px`;
    viewport.style.height = `${container.offsetHeight}px`;
    viewport.style.flex = '0 0 auto';
  }

  resetBoardNavigation() {
    this.boardNavigation.pointers.clear();
    this.boardNavigation.zoom = 1;
    this.boardNavigation.panX = 0;
    this.boardNavigation.panY = 0;
    this.boardNavigation.lastDistance = 0;
    this.boardNavigation.lastCenter = null;
    this.boardNavigation.moved = false;
    this.applyBoardNavigation();
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
    this.resetBoardNavigation();
    this.view.updatePencilModeUI(false);
    this.view.clearHighlight();

    this.view.setLoadingState(true);
    this.startLoadingTimer();
    this.view.showScreen('game-screen');
    this.syncBoardViewport();
    this.resetBoardNavigation();

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
      this.resetBoardNavigation();
      this.view.setLoadingState(false);
      this.renderBoard();
      this.view.updatePencilModeUI(false);
      this.view.clearHighlight();

      this.view.showScreen('game-screen');
      this.syncBoardViewport();
      this.resetBoardNavigation();
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
    if (!('serviceWorker' in navigator)) return;

    // 1. Hàm đọc trực tiếp từ CacheStorage và hiển thị NGUYÊN VẸN toàn bộ CACHE_NAME
    const syncVersionFromCache = async () => {
      if (!('caches' in window)) return;
      try {
        const keys = await caches.keys();
        // Lấy danh sách các cache thuộc về app và chọn cache mới nhất
        const matchingKeys = keys.filter(k => k.startsWith('sudoku-pwa-'));
        const targetCacheKey = matchingKeys.length > 0 ? matchingKeys[matchingKeys.length - 1] : keys[0];

        if (targetCacheKey) {
          const versionEl = document.getElementById('app-version');
          if (versionEl) {
            // Gán trực tiếp toàn bộ chuỗi CACHE_NAME (không replace bất kỳ ký tự nào)
            versionEl.textContent = targetCacheKey.replace(/^sudoku-pwa-/, '');
          }
        }
      } catch (e) {
        console.warn('Không thể đọc CacheStorage:', e);
      }
    };

    // Đọc và hiển thị ngay lập tức khi khởi tạo
    syncVersionFromCache();

    window.addEventListener('load', () => {
      // 2. Kênh nhận tin nhắn từ Service Worker: ĐÃ THÊM REPLACE ĐỂ CẮT TIỀN TỐ
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'VERSION_INFO') {
          const versionEl = document.getElementById('app-version');
          if (versionEl && event.data.version) {
            versionEl.textContent = event.data.version.replace(/^sudoku-pwa-/, '');
          }
        }
      });

      const queryAppVersion = () => {
        syncVersionFromCache();
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ action: 'GET_VERSION' });
        } else {
          navigator.serviceWorker.ready.then((reg) => {
            if (reg.active) {
              reg.active.postMessage({ action: 'GET_VERSION' });
            }
          });
        }
      };

      navigator.serviceWorker.register('./sw.js').then((registration) => {
        let waitingWorker = null;

        const toast = document.getElementById('update-toast');
        const btnApply = document.getElementById('btn-update-now');
        const btnDismiss = document.getElementById('btn-update-dismiss');

        const promptUserForUpdate = (worker) => {
          waitingWorker = worker;
          if (toast) toast.classList.remove('hidden');
        };

        if (btnDismiss) {
          btnDismiss.addEventListener('click', () => {
            if (toast) toast.classList.add('hidden');
          });
        }

        if (btnApply) {
          btnApply.addEventListener('click', () => {
            if (waitingWorker) {
              waitingWorker.postMessage({ action: 'SKIP_WAITING' });
            }
            if (toast) toast.classList.add('hidden');
          });
        }

        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUserForUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptUserForUpdate(installingWorker);
            }
          });
        });

        queryAppVersion();

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
            queryAppVersion();

            if (registration.waiting && navigator.serviceWorker.controller) {
              promptUserForUpdate(registration.waiting);
            }
          }
        });
      }).catch((err) => {
        console.warn('Lỗi đăng ký Service Worker:', err);
      });

      let isRefreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) {
          isRefreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new SudokuController();
});