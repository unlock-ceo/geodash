/**
 * Unified render pipeline that owns the WebGL2 context.
 *
 * ParticleSystem and (future) post-processing stages are internal
 * stages managed by this pipeline. MapLibre's custom-layer render
 * callback delegates to `render()` each frame.
 */

import type { RenderContext } from './types';
import type { PostProcessPass } from './postprocess/types';
import { ParticleSystem } from './ParticleSystem';

export class RenderPipeline {
  private gl: WebGL2RenderingContext | null = null;
  private particleSystem: ParticleSystem;
  private postProcessPasses: PostProcessPass[] = [];
  private depthRenderbuffer: WebGLRenderbuffer | null = null;
  private pingTexture: WebGLTexture | null = null;
  private pingFramebuffer: WebGLFramebuffer | null = null;
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

    if (this.postProcessPasses.length > 0 && this.frameBuffer && this.colorTexture) {
      // Render particles to FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
      gl.viewport(0, 0, this.width, this.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this.particleSystem.render(ctx);

      // Chain post-processing passes
      let sourceTexture = this.colorTexture;

      for (let i = 0; i < this.postProcessPasses.length; i++) {
        const pass = this.postProcessPasses[i]!;
        const isLast = i === this.postProcessPasses.length - 1;

        if (isLast) {
          // Final pass renders to default framebuffer
          pass.renderPass(ctx, sourceTexture, null);
        } else {
          // Intermediate passes render to ping buffer
          if (this.pingFramebuffer && this.pingTexture) {
            pass.renderPass(ctx, sourceTexture, this.pingFramebuffer);
            sourceTexture = this.pingTexture;
          }
        }
      }
    } else {
      // No post-processing — render directly
      this.particleSystem.render(ctx);
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

  addPostProcess(pass: PostProcessPass): void {
    this.postProcessPasses.push(pass);
    if (this.gl) {
      pass.init(this.gl);
      pass.resize(this.width, this.height);
    }
  }

  removePostProcess(pass: PostProcessPass): void {
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

    // Main FBO with color + depth
    this.frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);

    // Color attachment
    this.colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.colorTexture, 0);

    // Depth attachment (for DoF and proper depth testing)
    this.depthRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRenderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.width, this.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthRenderbuffer);

    // Check FBO status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn('[RenderPipeline] FBO incomplete — post-processing disabled. Status:', status);
    }

    // Ping FBO for intermediate post-processing passes
    this.pingFramebuffer = gl.createFramebuffer();
    this.pingTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.pingTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pingTexture, 0);

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  private destroyFramebuffer(gl: WebGL2RenderingContext): void {
    if (this.frameBuffer) { gl.deleteFramebuffer(this.frameBuffer); this.frameBuffer = null; }
    if (this.colorTexture) { gl.deleteTexture(this.colorTexture); this.colorTexture = null; }
    if (this.depthRenderbuffer) { gl.deleteRenderbuffer(this.depthRenderbuffer); this.depthRenderbuffer = null; }
    if (this.pingFramebuffer) { gl.deleteFramebuffer(this.pingFramebuffer); this.pingFramebuffer = null; }
    if (this.pingTexture) { gl.deleteTexture(this.pingTexture); this.pingTexture = null; }
  }
}
