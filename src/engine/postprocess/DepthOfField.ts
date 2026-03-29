// ---------------------------------------------------------------------------
// DepthOfField — Circle-of-Confusion based blur
// ---------------------------------------------------------------------------
// Simplified DoF that uses a depth-based blur factor. Since we don't have
// a real depth buffer from the particle rendering, we approximate DoF with
// a radial distance from the screen center (simulating focal plane).
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

const DOF_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uFocalPoint;   // 0-1 vertical position of focal plane
uniform float uAperture;     // blur strength
uniform vec2 uFocusCenter;   // screen-space focal center (0.5, 0.5 default)

void main() {
  vec2 texelSize = 1.0 / uResolution;

  // Circle of confusion based on distance from focal center
  float dist = distance(vUV, uFocusCenter);
  float coc = smoothstep(uFocalPoint * 0.5, uFocalPoint, dist) * uAperture;

  if (coc < 0.001) {
    fragColor = texture(uTexture, vUV);
    return;
  }

  // Simple disc blur
  vec4 color = vec4(0.0);
  float totalWeight = 0.0;
  const int SAMPLES = 8;
  const float PI2 = 6.28318530718;

  for (int i = 0; i < SAMPLES; i++) {
    float angle = PI2 * float(i) / float(SAMPLES);
    vec2 offset = vec2(cos(angle), sin(angle)) * texelSize * coc * 4.0;
    color += texture(uTexture, vUV + offset);
    totalWeight += 1.0;
  }

  // Blend between sharp and blurred
  vec4 sharp = texture(uTexture, vUV);
  vec4 blurred = color / totalWeight;
  fragColor = mix(sharp, blurred, smoothstep(0.0, 1.0, coc));
}`;

// ---------------------------------------------------------------------------
// DepthOfField implementation
// ---------------------------------------------------------------------------

export class DepthOfField implements PostProcessPass {
  private gl: WebGL2RenderingContext | null = null;
  private quad = new FullscreenQuad();
  private program: WebGLProgram | null = null;
  private width = 0;
  private height = 0;

  /** Focal distance as fraction of screen (0-1). */
  focalPoint = 0.4;
  /** Aperture — higher = stronger blur. */
  aperture = 3.0;
  /** Focal center in screen space. */
  focusCenter: [number, number] = [0.5, 0.5];

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.quad.init(gl);
    this.program = createProgram(gl, VERTEX_SHADER, DOF_FRAG);
  }

  render(_ctx: RenderContext): void {
    // No-op — use renderPass()
  }

  renderPass(
    _ctx: RenderContext,
    sourceTexture: WebGLTexture,
    destFramebuffer: WebGLFramebuffer | null,
  ): void {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, destFramebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uResolution'), this.width, this.height);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uFocalPoint'), this.focalPoint);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uAperture'), this.aperture);
    gl.uniform2f(
      gl.getUniformLocation(this.program, 'uFocusCenter'),
      this.focusCenter[0],
      this.focusCenter[1],
    );

    this.quad.draw(gl);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    this.quad.dispose(gl);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
  }
}
