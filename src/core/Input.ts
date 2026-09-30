export class Input {
  readonly keys = new Set<string>();
  readonly pointer = { x: 0, y: 0 };
  locked = false;
  dragging = false;
  onLook: (dx: number, dy: number) => void = () => {};
  onZoom: (delta: number) => void = () => {};
  onRecenter: () => void = () => {};
  onPrimary: () => void = () => {};
  onSecondary: (active: boolean) => void = () => {};
  onCut: () => void = () => {};
  onInteract: () => void = () => {};
  onPause: () => void = () => {};
  onJump: () => void = () => {};
  private press?: { x: number; y: number; button: number };

  constructor(private canvas: HTMLCanvasElement) {
    canvas.tabIndex = 0;
    document.addEventListener('keydown', e => {
      if ((e.target as HTMLElement)?.matches?.('input, select, button') && e.code !== 'Escape') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') this.onJump();
      if (e.code === 'KeyR') this.onCut();
      if (e.code === 'KeyE') this.onInteract();
      if (e.code === 'KeyQ') this.onRecenter();
      if (e.code === 'Escape') this.onPause();
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      this.clear();
      if (wasLocked && !this.locked) this.onPause();
    });
    document.addEventListener('mousemove', e => {
      if (this.locked) this.onLook(e.movementX, e.movementY);
      else if (this.press) {
        if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 5) this.dragging = true;
        if (this.dragging) this.onLook(e.movementX, e.movementY);
      }
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - rect.left) / rect.width * 2 - 1;
      this.pointer.y = -(e.clientY - rect.top) / rect.height * 2 + 1;
    });
    canvas.addEventListener('mousedown', e => {
      canvas.focus({ preventScroll: true });
      if (e.button === 0 && this.locked) this.onPrimary();
      if (!this.locked && (e.button === 0 || e.button === 2)) {
        this.press = { x: e.clientX, y: e.clientY, button: e.button };
        this.dragging = false;
      }
      if (e.button === 2) this.onSecondary(true);
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0 && this.press?.button === 0 && !this.dragging) this.onPrimary();
      this.press = undefined;
      this.dragging = false;
      if (e.button === 2) this.onSecondary(false);
    });
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.onZoom(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  clear() { this.keys.clear(); this.press = undefined; this.dragging = false; this.onSecondary(false); }
  pressed(...codes: string[]) { return codes.some(c => this.keys.has(c)); }
  async lock() {
    this.canvas.focus({ preventScroll: true });
    try { await this.canvas.requestPointerLock(); } catch { /* Drag orbit is fully playable without pointer lock. */ }
    return document.pointerLockElement === this.canvas;
  }
  unlock() { this.clear(); if (this.locked) document.exitPointerLock(); }
}
