class CallTimer {
  constructor() {
      this.timerElement = document.getElementById('timer');
      this.interval = null;
      this.startTime = null;
  }

  start() {
      this.startTime = Date.now();
      this.update();
      this.interval = setInterval(() => this.update(), 1000);
  }

  stop() {
      if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
      }
      this.startTime = null;
      if (this.timerElement) {
          this.timerElement.textContent = '00:00:00';
      }
  }

  update() {
      if (!this.startTime || !this.timerElement) return;

      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      this.timerElement.textContent = 
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

export default CallTimer;