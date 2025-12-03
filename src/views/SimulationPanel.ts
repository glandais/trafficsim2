import type { SimulationState } from '../services/SimulationEngine';

/**
 * UI panel for simulation controls
 */
export class SimulationPanel {
  private container: HTMLElement;

  private onStartCallback: (() => void) | null = null;
  private onStopCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;
  private onAddVehicleCallback: (() => void) | null = null;
  private onTimeScaleCallback: ((scale: number) => void) | null = null;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id "${containerId}" not found`);
    }
    this.container = element;
    this.render();
  }

  /**
   * Render the panel
   */
  private render(): void {
    this.container.innerHTML = `
      <h3>Simulation</h3>

      <div class="sim-controls">
        <div class="control-row">
          <button id="sim-start" class="btn btn-primary">Start</button>
          <button id="sim-stop" class="btn" disabled>Stop</button>
          <button id="sim-pause" class="btn" disabled>Pause</button>
        </div>

        <div class="control-row">
          <label for="sim-speed">Speed:</label>
          <select id="sim-speed">
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="2">2x</option>
            <option value="5">5x</option>
            <option value="10">10x</option>
          </select>
        </div>

        <div class="control-row">
          <button id="sim-add-vehicle" class="btn btn-secondary">Add Vehicle</button>
        </div>
      </div>

      <div class="sim-status">
        <div class="status-row">
          <span class="label">Status:</span>
          <span id="sim-status-value" class="value">Stopped</span>
        </div>
        <div class="status-row">
          <span class="label">Vehicles:</span>
          <span id="sim-vehicle-count" class="value">0</span>
        </div>
        <div class="status-row">
          <span class="label">Time:</span>
          <span id="sim-time" class="value">0.0s</span>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    this.container.querySelector('#sim-start')?.addEventListener('click', () => {
      this.onStartCallback?.();
    });

    this.container.querySelector('#sim-stop')?.addEventListener('click', () => {
      this.onStopCallback?.();
    });

    this.container.querySelector('#sim-pause')?.addEventListener('click', () => {
      this.onPauseCallback?.();
    });

    this.container.querySelector('#sim-add-vehicle')?.addEventListener('click', () => {
      this.onAddVehicleCallback?.();
    });

    this.container.querySelector('#sim-speed')?.addEventListener('change', (e) => {
      const scale = parseFloat((e.target as HTMLSelectElement).value);
      this.onTimeScaleCallback?.(scale);
    });
  }

  /**
   * Update display with current state
   */
  updateState(state: SimulationState, vehicleCount: number): void {
    const statusEl = this.container.querySelector('#sim-status-value');
    const countEl = this.container.querySelector('#sim-vehicle-count');
    const timeEl = this.container.querySelector('#sim-time');
    const startBtn = this.container.querySelector('#sim-start') as HTMLButtonElement;
    const stopBtn = this.container.querySelector('#sim-stop') as HTMLButtonElement;
    const pauseBtn = this.container.querySelector('#sim-pause') as HTMLButtonElement;

    // Update status text
    if (statusEl) {
      if (state.isPaused) {
        statusEl.textContent = 'Paused';
        statusEl.className = 'value status-paused';
      } else if (state.isRunning) {
        statusEl.textContent = `Running (${state.timeScale}x)`;
        statusEl.className = 'value status-running';
      } else {
        statusEl.textContent = 'Stopped';
        statusEl.className = 'value status-stopped';
      }
    }

    if (countEl) countEl.textContent = vehicleCount.toString();
    if (timeEl) timeEl.textContent = this.formatTime(state.simulationTime);

    // Update button states
    if (startBtn) startBtn.disabled = state.isRunning;
    if (stopBtn) stopBtn.disabled = !state.isRunning;
    if (pauseBtn) {
      pauseBtn.disabled = !state.isRunning;
      pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
    }
  }

  /**
   * Format time as mm:ss.s
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
    }
    return `${secs.toFixed(1)}s`;
  }

  // Event handler setters
  onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onStop(callback: () => void): void {
    this.onStopCallback = callback;
  }

  onPause(callback: () => void): void {
    this.onPauseCallback = callback;
  }

  onAddVehicle(callback: () => void): void {
    this.onAddVehicleCallback = callback;
  }

  onTimeScale(callback: (scale: number) => void): void {
    this.onTimeScaleCallback = callback;
  }
}
