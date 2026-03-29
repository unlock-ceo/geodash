/**
 * Unified render pipeline that owns the WebGL2 context.
 *
 * ParticleSystem and (future) post-processing stages are internal
 * stages managed by this pipeline. MapLibre's custom-layer render
 * callback delegates to `render()` each frame.
 */

import type { RenderContext, RenderStage } from './types';
import { ParticleSystem } from './ParticleSystem';

export class RenderPipeline {
  private gl: WebGL2RenderingContext | null = null;
  private particleSystem: ParticleSystem;
  private postProcessPasses: RenderStage[] = [];
  private width = 0;
  private height = 0;
  private lastTime = 0;

  // Framebuffer for future post-processing chain
  private frameBuffer: WebGLFramebuffer | null = null;
  private colorTexture: WebGLTexture | null = null;

  constructor(maxParticles: number = 150_000) {
    this.particleSystem = new ParticleSystem(maxParticles);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.width = gl.drawingBufferWidth;
    this.height = gl.drawingBufferHeight;
    this.lastTime = performance.now() / 1000;

    // Initialise internal stages
    this.particleSystem.init(gl);

    // Create framebuffer for post-processing (stub -- not wired yet)
    this.createFramebuffer(gl);
  }

  /**
   * Called each frame by MapLibre custom layer (or any render loop).
   * Receives the current projection and view matrices.
   */
  render(projectionMatrix: Float32Array, viewMatrix: Float32Array): void {
    const gl = this.gl;
    if (!gl) return;

    const now = performance.now() / 1000;
    const deltaTime = Math.max(0, now - this.lastTime);
    this.lastTime = now;

    const ctx: RenderContext = {
      gl,
      width: this.width,
      height: this.height,
      projectionMatrix,
      viewMatrix,
      time: now,
      deltaTime,
    };

    // If post-processing passes exist we would render to FBO here.
    // For now, render directly to the default framebuffer.

    this.particleSystem.render(ctx);

    // Future: run post-process chain
    for (const pass of this.postProcessPasses) {
      pass.render(ctx);
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.particleSystem.resize(width, height);
    for (const pass of this.postProcessPasses) {
      pass.resize(width, height);
    }

    // Recreate FBO attachments at new size
    if (this.gl) {
      this.destroyFramebuffer(this.gl);
      this.createFramebuffer(this.gl);
    }
  }

  dispose(): void {
    if (this.gl) {
      this.destroyFramebuffer(this.gl);
    }
    this.particleSystem.dispose();
    for (const pass of this.postProcessPasses) {
      pass.dispose();
    }
    this.postProcessPasses.length = 0;
    this.gl = null;
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  // -----------------------------------------------------------------------
  // Post-process management (stubs for Step 11)
  // -----------------------------------------------------------------------

  addPostProcess(pass: RenderStage): void {
    this.postProcessPasses.push(pass);
    if (this.gl) {
      pass.init(this.gl);
      pass.resize(this.width, this.height);
    }
  }

  removePostProcess(pass: RenderStage): void {
    const idx = this.postProcessPasses.indexOf(pass);
    if (idx >= 0) {
      this.postProcessPasses.splice(idx, 1);
      pass.dispose();
    }
  }

  // -----------------------------------------------------------------------
  // Internal -- framebuffer management
  // -----------------------------------------------------------------------

  private createFramebuffer(gl: WebGL2RenderingContext): void {
    if (this.width === 0 || this.height === 0) return;

    this.frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);

    // Color attachment
    this.colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.colorTexture,
      0,
    );

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private destroyFramebuffer(gl: WebGL2RenderingContext): void {
    if (this.frameBuffer) {
      gl.deleteFramebuffer(this.frameBuffer);
      this.frameBuffer = null;
    }
    if (this.colorTexture) {
      gl.deleteTexture(this.colorTexture);
      this.colorTexture = null;
    }
  }
}
