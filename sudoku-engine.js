/**
 * SUDOKU ENGINE & WEB WORKER GENERATOR
 * Tích hợp kiến trúc Đa luồng (Web Worker) và Thuật toán Bitmask MRV Heuristic
 */

const SYMBOLS_9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SYMBOLS_16 = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G'
];

/**
 * Mã nguồn của Web Worker chạy trên Background Thread
 * Giải phóng hoàn toàn luồng chính (Main Thread) để UI và Timer không bao giờ bị đứng hình.
 */
const WORKER_SCRIPT = `
self.onmessage = function(e) {
  const { size, minClues, maxClues } = e.data;
  if (size === 9) {
    const result = generate9x9(minClues, maxClues);
    self.postMessage({ status: 'success', size: 9, ...result });
  } else {
    const result = generate16x16(minClues, maxClues);
    self.postMessage({ status: 'success', size: 16, ...result });
  }
};

function countBits(n) {
  let count = 0;
  while (n > 0) {
    n &= (n - 1);
    count++;
  }
  return count;
}

function findBestCell(grid, rowMask, colMask, boxMask) {
  let minCandidates = 10;
  let bestR = -1, bestC = -1, bestMask = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const candidates = 511 & ~(rowMask[r] | colMask[c] | boxMask[b]);
      const count = countBits(candidates);
      if (count === 0) return null;
      if (count < minCandidates) {
        minCandidates = count;
        bestR = r;
        bestC = c;
        bestMask = candidates;
        if (count === 1) break;
      }
    }
    if (minCandidates === 1) break;
  }

  return { r: bestR, c: bestC, mask: bestMask };
}

// Giải bàn cờ hoàn chỉnh bằng MRV + Bitmask Backtracking
function solveMRV(grid, rowMask, colMask, boxMask) {
  const best = findBestCell(grid, rowMask, colMask, boxMask);
  if (!best) return false;
  if (best.r === -1) return true;

  const b = Math.floor(best.r / 3) * 3 + Math.floor(best.c / 3);
  let cMask = best.mask;
  while (cMask > 0) {
    const bit = cMask & (-cMask);
    cMask ^= bit;
    const num = Math.round(Math.log2(bit)) + 1;

    grid[best.r][best.c] = num;
    rowMask[best.r] |= bit;
    colMask[best.c] |= bit;
    boxMask[b] |= bit;

    if (solveMRV(grid, rowMask, colMask, boxMask)) return true;

    grid[best.r][best.c] = 0;
    rowMask[best.r] &= ~bit;
    colMask[best.c] &= ~bit;
    boxMask[b] &= ~bit;
  }

  return false;
}

// Đếm số nghiệm với cơ chế Early Exit khi số nghiệm >= 2
function countSolutionsMRV(grid, rowMask, colMask, boxMask, counter) {
  const best = findBestCell(grid, rowMask, colMask, boxMask);
  if (!best) return counter.val;
  if (best.r === -1) {
    counter.val++;
    return counter.val;
  }

  const b = Math.floor(best.r / 3) * 3 + Math.floor(best.c / 3);
  let cMask = best.mask;
  while (cMask > 0) {
    const bit = cMask & (-cMask);
    cMask ^= bit;
    const num = Math.round(Math.log2(bit)) + 1;

    grid[best.r][best.c] = num;
    rowMask[best.r] |= bit;
    colMask[best.c] |= bit;
    boxMask[b] |= bit;

    countSolutionsMRV(grid, rowMask, colMask, boxMask, counter);

    grid[best.r][best.c] = 0;
    rowMask[best.r] &= ~bit;
    colMask[best.c] &= ~bit;
    boxMask[b] &= ~bit;

    if (counter.val >= 2) return 2;
  }

  return counter.val;
}

function generate9x9(minClues, maxClues) {
  while (true) {
    const grid = Array.from({ length: 9 }, () => new Array(9).fill(0));
    const rowMask = new Array(9).fill(0);
    const colMask = new Array(9).fill(0);
    const boxMask = new Array(9).fill(0);

    // 1. Điền ngẫu nhiên 3 khối chéo chính độc lập
    for (let b = 0; b < 9; b += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      let idx = 0;
      const boxIdx = Math.floor(b / 3) * 3 + Math.floor(b / 3);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const num = nums[idx++];
          const bit = 1 << (num - 1);
          grid[b + r][b + c] = num;
          rowMask[b + r] |= bit;
          colMask[b + c] |= bit;
          boxMask[boxIdx] |= bit;
        }
      }
    }

    // 2. Điền 6 khối còn lại với MRV Bitmask
    if (!solveMRV(grid, rowMask, colMask, boxMask)) continue;

    const solution = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        solution.push(grid[r][c]);
      }
    }

    // 3. Đục lỗ kiểm tra nghiệm duy nhất
    const coords = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        coords.push({ r, c });
      }
    }
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }

    let cluesRemaining = 81;
    for (let i = 0; i < coords.length; i++) {
      if (cluesRemaining <= minClues) break;
      const { r, c } = coords[i];
      const val = grid[r][c];
      const bit = 1 << (val - 1);
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);

      grid[r][c] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;

      const cloneGrid = grid.map(row => [...row]);
      const cloneRow = [...rowMask];
      const cloneCol = [...colMask];
      const cloneBox = [...boxMask];
      const counter = { val: 0 };

      countSolutionsMRV(cloneGrid, cloneRow, cloneCol, cloneBox, counter);

      if (counter.val === 1) {
        cluesRemaining--;
        if (cluesRemaining <= maxClues && Math.random() < 0.25) {
          break;
        }
      } else {
        grid[r][c] = val;
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[b] |= bit;
      }
    }

    if (cluesRemaining <= maxClues) {
      const initialPuzzle = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          initialPuzzle.push(grid[r][c]);
        }
      }
      return { solution, initialPuzzle };
    }
  }
}

function generate16x16(minClues, maxClues) {
  const size = 16;
  const box = 4;
  const grid = new Array(256);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      grid[r * size + c] = ((r * box + Math.floor(r / box) + c) % size) + 1;
    }
  }

  const map = Array.from({ length: 17 }, (_, i) => i);
  const shuffledNums = Array.from({ length: 16 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  for (let i = 1; i <= 16; i++) map[i] = shuffledNums[i - 1];
  for (let i = 0; i < 256; i++) grid[i] = map[grid[i]];

  for (let b = 0; b < box; b++) {
    for (let i = 0; i < 6; i++) {
      const r1 = b * box + Math.floor(Math.random() * box);
      const r2 = b * box + Math.floor(Math.random() * box);
      if (r1 !== r2) {
        for (let c = 0; c < size; c++) {
          const t = grid[r1 * size + c];
          grid[r1 * size + c] = grid[r2 * size + c];
          grid[r2 * size + c] = t;
        }
      }
    }
  }

  const solution = [...grid];
  const targetClues = Math.floor(Math.random() * (maxClues - minClues + 1)) + minClues;
  const coords = Array.from({ length: 256 }, (_, i) => i).sort(() => Math.random() - 0.5);
  let toRemove = 256 - targetClues;

  for (const idx of coords) {
    if (toRemove <= 0) break;
    grid[idx] = 0;
    toRemove--;
  }

  return { solution, initialPuzzle: grid };
}
`;

class SudokuEngine {
  constructor(size = 9) {
    this.init(size);
    this.currentWorker = null;
  }

  init(size) {
    this.size = size;
    this.boxSize = size === 16 ? 4 : 3;
    this.symbols = size === 16 ? SYMBOLS_16 : SYMBOLS_9;
    this.totalCells = size * size;

    this.solution = new Array(this.totalCells).fill(0);
    this.initialPuzzle = new Array(this.totalCells).fill(0);

    this.cells = Array.from({ length: this.totalCells }, (_, idx) => ({
      r: Math.floor(idx / size),
      c: idx % size,
      val: 0,
      isClue: false,
      isError: false,
      notes: 0
    }));
  }

  getIndex(r, c) {
    return r * this.size + c;
  }

  getSymbol(val) {
    if (val <= 0 || val > this.size) return '';
    return this.symbols[val - 1];
  }

  resetCell(cell, val) {
    cell.val = val;
    cell.isClue = val !== 0;
    cell.isError = false;
    cell.notes = 0;
  }

  getPeerIndexes(r, c) {
    const indexes = new Set();
    const startRow = Math.floor(r / this.boxSize) * this.boxSize;
    const startCol = Math.floor(c / this.boxSize) * this.boxSize;

    for (let i = 0; i < this.size; i++) {
      indexes.add(this.getIndex(r, i));
      indexes.add(this.getIndex(i, c));
      indexes.add(this.getIndex(
        startRow + Math.floor(i / this.boxSize),
        startCol + i % this.boxSize
      ));
    }
    return indexes;
  }

  generatePuzzleInWorker(size, minClues, maxClues) {
    this.terminateWorker();
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.currentWorker = new Worker(workerUrl);

    return new Promise((resolve, reject) => {
      this.currentWorker.onmessage = (e) => {
        if (e.data.status === 'success') {
          this.loadGeneratedData(e.data.size, e.data.solution, e.data.initialPuzzle);
          this.terminateWorker();
          URL.revokeObjectURL(workerUrl);
          resolve(true);
        }
      };

      this.currentWorker.onerror = (err) => {
        this.terminateWorker();
        URL.revokeObjectURL(workerUrl);
        reject(err);
      };

      this.currentWorker.postMessage({ size, minClues, maxClues });
    });
  }

  terminateWorker() {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.currentWorker = null;
    }
  }

  loadGeneratedData(size, solution, initialPuzzle) {
    this.init(size);
    this.solution = solution;
    this.initialPuzzle = initialPuzzle;

    for (let i = 0; i < this.totalCells; i++) {
      this.resetCell(this.cells[i], initialPuzzle[i]);
    }
  }

  restartPuzzle() {
    for (let i = 0; i < this.totalCells; i++) {
      this.resetCell(this.cells[i], this.initialPuzzle[i]);
    }
  }

  isGameWon() {
    for (let i = 0; i < this.totalCells; i++) {
      if (this.cells[i].val === 0 || this.cells[i].val !== this.solution[i]) {
        return false;
      }
    }
    return true;
  }

  getShareablePuzzleText() {
    let out = `SUDOKU PUZZLE (${this.size}x${this.size})\n`;
    for (let r = 0; r < this.size; r++) {
      let rowStr = '';
      for (let c = 0; c < this.size; c++) {
        const v = this.initialPuzzle[r * this.size + c];
        rowStr += (v === 0 ? '.' : this.getSymbol(v)) + ' ';
      }
      out += rowStr.trim() + '\n';
    }
    return out;
  }

  /**
   * Tính toán bitmask các ứng viên hợp lệ tại ô (r, c)
   * ĐÃ SỬA: Không tính ô điền sai vào logic xóa ứng viên của các ô khác
   */
  getValidCandidatesMask(r, c) {
    const targetIdx = this.getIndex(r, c);
    if (this.cells[targetIdx].val !== 0) return 0;

    let usedMask = 0;
    for (const index of this.getPeerIndexes(r, c)) {
      const cell = this.cells[index];
      if (cell.val > 0 && !cell.isError) usedMask |= 1 << (cell.val - 1);
    }

    const allMask = (1 << this.size) - 1;
    return allMask & (~usedMask);
  }

  /**
   * Điền nháp nhanh:
    * - Xóa nội dung các ô điền sai
   * - Chỉ điền nháp vào ô trống
    * - Xóa nháp ở các ô đang có giá trị
   */
  computeFastPencilMarks() {
    let updated = false;
    for (let i = 0; i < this.totalCells; i++) {
      const cell = this.cells[i];
      if (cell.isError) {
        cell.val = 0;
        cell.isError = false;
        cell.notes = 0;
        updated = true;
      }

      if (cell.val === 0) {
        cell.notes = this.getValidCandidatesMask(cell.r, cell.c);
        updated = true;
      } else {
        cell.notes = 0;
      }
    }
    return updated;
  }

  eliminatePeerNotes(r, c, val) {
    const maskToEliminate = ~(1 << (val - 1));
    this.getPeerIndexes(r, c).forEach(index => {
      this.cells[index].notes &= maskToEliminate;
    });
  }

  serialize() {
    return {
      size: this.size,
      boxSize: this.boxSize,
      solution: this.solution,
      initialPuzzle: this.initialPuzzle,
      cells: this.cells.map(c => ({
        r: c.r,
        c: c.c,
        val: c.val,
        isClue: c.isClue,
        isError: c.isError,
        notes: c.notes
      }))
    };
  }

  deserialize(data) {
    if (!data || !data.size || !data.cells) return false;
    this.init(data.size);
    this.solution = data.solution || [];
    this.initialPuzzle = data.initialPuzzle || [];

    for (let i = 0; i < this.totalCells; i++) {
      this.cells[i].val = data.cells[i].val;
      this.cells[i].isClue = data.cells[i].isClue;
      this.cells[i].isError = !!data.cells[i].isError;
      this.cells[i].notes = data.cells[i].notes;
    }
    return true;
  }

  getRemainingCount(val) {
    let placedCount = 0;
    for (let i = 0; i < this.totalCells; i++) {
      if (this.cells[i].val === val && !this.cells[i].isError) {
        placedCount++;
      }
    }
    return Math.max(0, this.size - placedCount);
  }

  hasConflict(r, c, val) {
    if (!val || val <= 0) return false;
    const targetIndex = this.getIndex(r, c);
    return [...this.getPeerIndexes(r, c)].some(index => (
      index !== targetIndex && this.cells[index].val === val
    ));
  }
}