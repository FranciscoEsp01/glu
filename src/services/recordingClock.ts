/** Tracks active capture time even when the browser delays timer callbacks. */
export class RecordingClock {
  private accumulated = 0;
  private startedAt: number | undefined;
  constructor(private now: () => number = () => performance.now()) {}
  start() {
    this.accumulated = 0;
    this.startedAt = this.now();
  }
  pause() {
    if (this.startedAt !== undefined) {
      this.accumulated += this.now() - this.startedAt;
      this.startedAt = undefined;
    }
  }
  resume() {
    if (this.startedAt === undefined) this.startedAt = this.now();
  }
  seconds() {
    return Math.max(
      0,
      Math.floor(
        (this.accumulated + (this.startedAt === undefined ? 0 : this.now() - this.startedAt)) /
          1000,
      ),
    );
  }
  stop() {
    this.pause();
    return this.seconds();
  }
}
