// ---------------------------------------------------------------------------
// DemoOrchestrator — event-driven demo sequencer
// ---------------------------------------------------------------------------
// Owns the act catalogue and drives them sequentially through the SceneRunner.
// Each act gets its own lifecycle; the orchestrator coordinates handoffs,
// cancellation, and store updates.
//
// Usage:
//   const orchestrator = new DemoOrchestrator();
//   orchestrator.start();   // kicks off Act 1 → Act 2 → ... → complete
//   orchestrator.stop();    // abort at any time
//   orchestrator.skipToAct(2); // jump directly to Act 2
// ---------------------------------------------------------------------------

import { SceneRunner } from './SceneRunner';
import type { ActDefinition } from './types';
import { getAct1 } from './acts/Act1Globe';
import { getAct2 } from './acts/Act2NYC';
import { getAct3 } from './acts/Act3Environment';
import { getAct4 } from './acts/Act4Live';
import { getAct5 } from './acts/Act5Interactive';
import { useDemoStore } from '../store/demoStore';
import { getMapInstance, getParticleLayer } from '../components/Map/GlobeMap';

export class DemoOrchestrator {
  private runner: SceneRunner;
  private acts: ActDefinition[];
  private abortController: AbortController | null = null;
  private running = false;
  private currentActIdx = 0;

  constructor() {
    this.runner = new SceneRunner();
    this.acts = [getAct1(), getAct2(), getAct3(), getAct4(), getAct5()];
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Start the demo from Act 1.  Resolves when all acts complete or are
   * aborted via `stop()`.
   */
  async start(): Promise<void> {
    if (this.running) return;
    await this.runFrom(0);
  }

  /**
   * Abort the running demo immediately.  Teardown callbacks for the
   * current scene will still fire.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.runner.stop();
    this.running = false;
    useDemoStore.getState().setPhase('idle');
    useDemoStore.getState().reset();
  }

  /**
   * Skip to a specific act (1-indexed).  Stops the current playback,
   * then resumes from the requested act.
   */
  async skipToAct(actNumber: number): Promise<void> {
    const idx = actNumber - 1;
    if (idx < 0 || idx >= this.acts.length) return;

    // Stop current execution
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.runner.stop();
    this.running = false;

    // Restart from the requested act
    await this.runFrom(idx);
  }

  /**
   * Skip to the next act. If currently on the last act, does nothing.
   */
  async skipNext(): Promise<void> {
    const nextIdx = this.currentActIdx + 1;
    if (nextIdx >= this.acts.length) return;
    await this.skipToAct(nextIdx + 1); // skipToAct is 1-indexed
  }

  /** True if the demo is currently playing. */
  isRunning(): boolean {
    return this.running;
  }

  /** Returns the number of registered acts. */
  getActCount(): number {
    return this.acts.length;
  }

  /** Returns current act index (0-based). */
  getCurrentActIdx(): number {
    return this.currentActIdx;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Core sequencing loop.  Runs acts from `startIdx` through the end,
   * checking for abort between every scene.
   */
  private async runFrom(startIdx: number): Promise<void> {
    this.running = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    useDemoStore.getState().setPhase('playing');

    // Acquire map + particle system
    const map = getMapInstance();
    const layer = getParticleLayer();

    if (!map || !layer) {
      console.warn('[DemoOrchestrator] Map or ParticleLayer not available — aborting.');
      this.running = false;
      useDemoStore.getState().setPhase('idle');
      return;
    }

    const particleSystem = layer.getParticleSystem();
    const ctx = { map, particleSystem };

    // Sequential act execution
    for (let actIdx = startIdx; actIdx < this.acts.length; actIdx++) {
      if (signal.aborted) break;

      this.currentActIdx = actIdx;
      const act = this.acts[actIdx]!;
      useDemoStore.getState().setCurrentAct(actIdx + 1);
      useDemoStore.getState().setActProgress(0);

      // Run each scene in the act sequentially
      for (const scene of act.scenes) {
        if (signal.aborted) break;
        await this.runner.runScene(scene, ctx);
      }
    }

    // Finished (or aborted)
    if (!signal.aborted) {
      useDemoStore.getState().setPhase('complete');
    }
    this.running = false;
  }
}
