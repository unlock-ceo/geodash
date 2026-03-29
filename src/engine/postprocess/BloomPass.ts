// ---------------------------------------------------------------------------
// BloomPass — multi-pass bloom effect
// ---------------------------------------------------------------------------
// Pipeline: threshold → downsample → Gaussian blur → composite with original
// All GLSL shaders inlined as string constants (self-contained deep module).
// ---------------------------------------------------------------------------

import type { RenderContext } from '../types';
import type { PostProcessPass } from './types';
import { FullscreenQuad, createProgram } from './types';

// ---------------------------------------------------------------------------
// GLSL Shaders
// ---------------------------------------------------------------------------

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUV;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const THRESHOLD_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform float uThreshold;
void main() {
  vec4 color = texture(uTexture, vUV);
  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  fragColor = brightness > uThreshold ? color : vec4(0.0);
}`;

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uResolution;
const float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec3 result = texture(uTexture, vUV).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * texelSize * float(i);
    result += texture(uTexture, vUV + offset).rgb * weights[i];
    result += texture(uTexture, vUV - offset).rgb * weights[i];
  }
  fragColor = vec4(result, 1.0);
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uIntensity;
void main() {
  vec4 scene = texture(uScene, vUV);
  vec4 bloom = texture(uBloom, vUV);
  fragColor = scene + bloom * uIntensity;
}`;

// ---------------------------------------------------------------------------
// BloomPass implementation
// ---------------------------------------------------------------------------

export class BloomPass implements PostProcessPass {
  private gl: WebGL2RenderingContext | null = null;
  private quad = new FullscreenQuad();
  private thresholdProgram: WebGLProgram | null = null;
  private blurProgram: WebGLProgram | null = null;
  private compositeProgram: WebGLProgram | null = null;

  // Internal FBOs for ping-pong blur
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;

  private width = 0;
  private height = 0;

  /** Brightness threshold for bloom extraction. */
  threshold = 0.6;
  /** Bloom intensity (0 = no bloom, 1 = full). */
  intensity = 0.4;
  /** Number of blur passes (more = softer bloom). */
  blurPasses = 3;

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.quad.init(gl);

    this.thresholdProgram = createProgram(gl, VERTEX_SHADER, THRESHOLD_FRAG);
    this.blurProgram = createProgram(gl, VERTEX_SHADER, BLUR_FRAG);
    this.compositeProgram = createProgram(gl, VERTEX_SHADER, COMPOSITE_FRAG);
  }

  render(_ctx: RenderContext): void {
    // No-op — use renderPass() for post-processing chain
  }

  renderPass(
    _ctx: RenderContext,
    sourceTexture: WebGLTexture,
    destFramebuffer: WebGLFramebuffer | null,
  ): void {
    const gl = this.gl;
    if (!gl || !this.thresholdProgram || !this.blurProgram || !this.compositeProgram) return;
    if (!this.fboA || !this.fboB || !this.texA || !this.texB) return;

    // Step 1: Threshold — extract bright areas
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
    gl.viewport(0, 0, this.width / 2, this.height / 2);
    gl.useProgram(this.thresholdProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.thresholdProgram, 'uTexture'), 0);
    gl.uniform1f(gl.getUniformLocation(this.thresholdProgram, 'uThreshold'), this.threshold);
    this.quad.draw(gl);

    // Step 2: Ping-pong Gaussian blur
    let readFBO = this.fboA;
    let writeFBO = this.fboB;
    let readTex = this.texA;
    let writeTex = this.texB;

    gl.useProgram(this.blurProgram);
    gl.uniform2f(
      gl.getUniformLocation(this.blurProgram, 'uResolution'),
      this.width / 2,
      this.height / 2,
    );
    gl.uniform1i(gl.getUniformLocation(this.blurProgram, 'uTexture'), 0);

    for (let i = 0; i < this.blurPasses; i++) {
      // Horizontal pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      gl.uniform2f(gl.getUniformLocation(this.blurProgram, 'uDirection'), 1.0, 0.0);
      this.quad.draw(gl);

      // Swap
      [readFBO, writeFBO] = [writeFBO, readFBO];
      [readTex, writeTex] = [writeTex, readTex];

      // Vertical pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      gl.uniform2f(gl.getUniformLocation(this.blurProgram, 'uDirection'), 0.0, 1.0);
      this.quad.draw(gl);

      // Swap
      [readFBO, writeFBO] = [writeFBO, readFBO];
      [readTex, writeTex] = [writeTex, readTex];
    }

    // Step 3: Composite — blend bloom with original scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, destFramebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.compositeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'uScene'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'uBloom'), 1);

    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'uIntensity'), this.intensity);
    this.quad.draw(gl);

    // Clean up texture bindings
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const gl = this.gl;
    if (!gl) return;

    // Recreate half-res FBOs
    this.destroyFBOs(gl);
    this.createFBOs(gl, width / 2, height / 2);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;

    this.destroyFBOs(gl);
    this.quad.dispose(gl);

    if (this.thresholdProgram) gl.deleteProgram(this.thresholdProgram);
    if (this.blurProgram) gl.deleteProgram(this.blurProgram);
    if (this.compositeProgram) gl.deleteProgram(this.compositeProgram);
    this.gl = null;
  }

  // -----------------------------------------------------------------------
  // Internal FBO management
  // -----------------------------------------------------------------------

  private createFBOs(gl: WebGL2RenderingContext, w: number, h: number): void {
    [this.fboA, this.texA] = this.createFBO(gl, w, h);
    [this.fboB, this.texB] = this.createFBO(gl, w, h);
  }

  private createFBO(gl: WebGL2RenderingContext, w: number, h: number): [WebGLFramebuffer, WebGLTexture] {
    const fbo = gl.createFramebuffer()!;
    const tex = gl.createTexture()!;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return [fbo, tex];
  }

  private destroyFBOs(gl: WebGL2RenderingContext): void {
    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    this.fboA = this.fboB = null;
    this.texA = this.texB = null;
  }
}
