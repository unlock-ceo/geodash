// ---------------------------------------------------------------------------
// SceneRunner — interprets SceneDescriptors and drives animation
// ---------------------------------------------------------------------------
// The runner owns the animation loop for a single scene, applying camera
// shots via map.jumpTo() each frame and forwarding progress to the scene's
// update callback.  Each scene gets its own AbortController so cancellation
// is clean and immediate.
// ---------------------------------------------------------------------------

import { CinematicCamera } from '../camera/CinematicCamera';
import { useCameraStore } from '../store/cameraStore';
import type { SceneContext, SceneDescriptor } from './types';

export class SceneRunner {
  private currentScene: SceneDescriptor | null = null;
  private abortController: AbortController | null = null;
  private animationFrame = 0;
  private startTime = 0;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run a single scene.  Returns a promise that resolves when the scene
   * completes (progress reaches 1) or is aborted via `stop()`.
   *
   * The caller provides map + particleSystem; the runner attaches the
   * AbortSignal to form the full SceneContext.
   */
  async runScene(
    scene: SceneDescriptor,
    ctx: Omit<SceneContext, 'signal'>,
  ): Promise<void> {
    // Cancel any scene that is currently running
    this.stop();

    this.abortController = new AbortController();
    const fullCtx: SceneContext = {
      ...ctx,
      signal: this.abortController.signal,
    };
    this.currentScene = scene;

    // --- Setup phase (may be async) ---
    await scene.setup(fullCtx);

    // If aborted during async setup, bail immediately
    if (this.abortController.signal.aborted) {
      scene.teardown?.(fullCtx);
      this.currentScene = null;
      return;
    }

    // --- Animation loop ---
    return new Promise<void>((resolve) => {
      this.startTime = performance.now();

      const tick = () => {
        // Check for abort
        if (this.abortController?.signal.aborted) {
          scene.teardown?.(fullCtx);
          this.currentScene = null;
          resolve();
          return;
        }

        const elapsed = performance.now() - this.startTime;
        const progress = Math.min(elapsed / scene.duration, 1);

        // Evaluate and apply camera shot if one is defined.
        // Skip jumpTo when user is interacting — prevents jitter from
        // competing with user input while allowing particles to continue.
        if (scene.camera && !useCameraStore.getState().userInteracting) {
          const cam = CinematicCamera.evaluate(scene.camera, progress);
          try {
            ctx.map.jumpTo({
              center: cam.center,
              zoom: cam.zoom,
              pitch: cam.pitch,
              bearing: cam.bearing,
            });
          } catch {
            // Map may have been disposed — swallow and continue
          }
        }

        // Per-frame update callback
        scene.update?.(fullCtx, progress);

        // Scene complete
        if (progress >= 1) {
          scene.teardown?.(fullCtx);
          this.currentScene = null;
          resolve();
          return;
        }

        this.animationFrame = requestAnimationFrame(tick);
      };

      this.animationFrame = requestAnimationFrame(tick);
    });
  }

  /**
   * Immediately abort the current scene.  The running promise will resolve
   * after teardown executes.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.currentScene = null;
  }

  /** True if a scene is currently animating. */
  isActive(): boolean {
    return this.currentScene !== null;
  }
}
