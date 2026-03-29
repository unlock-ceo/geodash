// ---------------------------------------------------------------------------
// ColorGrading — LUT-based color grading with presets
// ---------------------------------------------------------------------------
// Applies color adjustments: brightness, contrast, saturation, and color
// tinting. Presets provide named looks (Neon City, Documentary, etc.).
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

const GRADING_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uTint;
uniform float uVignetteStrength;

void main() {
  vec4 color = texture(uTexture, vUV);
  vec3 c = color.rgb;

  // Brightness
  c += uBrightness;

  // Contrast (centered on 0.5 gray)
  c = (c - 0.5) * uContrast + 0.5;

  // Saturation
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, uSaturation);

  // Color tint (multiplicative)
  c *= uTint;

  // Vignette
  vec2 uv = vUV * 2.0 - 1.0;
  float vignette = 1.0 - dot(uv, uv) * uVignetteStrength;
  c *= clamp(vignette, 0.0, 1.0);

  fragColor = vec4(clamp(c, 0.0, 1.0), color.a);
}`;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface GradingPreset {
  name: string;
  brightness: number;
  contrast: number;
  saturation: number;
  tint: [number, number, number];
  vignetteStrength: number;
}

export const PRESETS: Record<string, GradingPreset> = {
  'Neon City': {
    name: 'Neon City',
    brightness: 0.02,
    contrast: 1.25,
    saturation: 1.4,
    tint: [0.9, 0.95, 1.1],
    vignetteStrength: 0.3,
  },
  'Documentary': {
    name: 'Documentary',
    brightness: -0.02,
    contrast: 1.1,
    saturation: 0.8,
    tint: [1.0, 0.98, 0.95],
    vignetteStrength: 0.15,
  },
  'Midnight': {
    name: 'Midnight',
    brightness: -0.05,
    contrast: 1.15,
    saturation: 0.9,
    tint: [0.85, 0.9, 1.15],
    vignetteStrength: 0.4,
  },
  'Warm Glow': {
    name: 'Warm Glow',
    brightness: 0.03,
    contrast: 1.05,
    saturation: 1.1,
    tint: [1.1, 1.0, 0.85],
    vignetteStrength: 0.2,
  },
  'None': {
    name: 'None',
    brightness: 0,
    contrast: 1.0,
    saturation: 1.0,
    tint: [1, 1, 1],
    vignetteStrength: 0,
  },
};

// ---------------------------------------------------------------------------
// ColorGrading implementation
// ---------------------------------------------------------------------------

export class ColorGrading implements PostProcessPass {
  private gl: WebGL2RenderingContext | null = null;
  private quad = new FullscreenQuad();
  private program: WebGLProgram | null = null;
  private width = 0;
  private height = 0;

  /** Current grading preset. */
  private preset: GradingPreset = PRESETS['Neon City']!;

  /** Set preset by name. */
  setPreset(name: string): void {
    const p = PRESETS[name];
    if (p) this.preset = p;
  }

  /** Get current preset name. */
  getPresetName(): string {
    return this.preset.name;
  }

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.quad.init(gl);
    this.program = createProgram(gl, VERTEX_SHADER, GRADING_FRAG);
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

    gl.uniform1f(gl.getUniformLocation(this.program, 'uBrightness'), this.preset.brightness);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uContrast'), this.preset.contrast);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uSaturation'), this.preset.saturation);
    gl.uniform3f(
      gl.getUniformLocation(this.program, 'uTint'),
      this.preset.tint[0],
      this.preset.tint[1],
      this.preset.tint[2],
    );
    gl.uniform1f(gl.getUniformLocation(this.program, 'uVignetteStrength'), this.preset.vignetteStrength);

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
