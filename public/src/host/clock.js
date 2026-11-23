// A pausable clock for the big screen. Everything timed on the host (camera
// moves, holds, auto-advance) reads this clock, so Pause freezes the show.
export const clock = {
  pausedAt: null,
  offset: 0,
  get paused() { return this.pausedAt != null; },
  now() { return (this.pausedAt ?? performance.now()) - this.offset; },
  pause() { if (!this.paused) this.pausedAt = performance.now(); },
  resume() { if (this.paused) { this.offset += performance.now() - this.pausedAt; this.pausedAt = null; } },
  // Resolves after `ms` of unpaused time.
  sleep(ms) {
    return new Promise((res) => {
      const end = this.now() + ms;
      const tick = () => {
        const left = end - this.now();
        if (left <= 0 && !this.paused) res();
        else setTimeout(tick, this.paused ? 100 : Math.min(Math.max(left, 0), 100));
      };
      tick();
    });
  },
  // A cancellable timeout on this clock.
  after(ms, fn) {
    let done = false;
    this.sleep(ms).then(() => { if (!done) fn(); });
    return () => { done = true; };
  },
};
