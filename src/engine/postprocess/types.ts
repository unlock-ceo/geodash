// ---------------------------------------------------------------------------
// Post-Processing Types
// ---------------------------------------------------------------------------

import type { RenderStage, RenderContext } from '../types';

/**
 * Extended render stage for post-processing passes.
 * Each pass reads from a source texture and writes to a destination.
 */
export interface PostProcessPass extends RenderStage {
  /** Render the pass with source and destination textures. */
  renderPass(ctx: RenderContext, sourceTexture: WebGLTexture, destFramebuffer: WebGLFramebuffer | null): void;
}

// ---------------------------------------------------------------------------
// FullscreenQuad — shared utility for all post-process passes
// ---------------------------------------------------------------------------

const QUAD_VERTICES = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
   1,  1,
]);

/**
 * Utility class for rendering a fullscreen quad.
 * Shared by all post-processing passes.
 */
export class FullscreenQuad {
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  init(gl: WebGL2RenderingContext): void {
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  draw(gl: WebGL2RenderingContext): void {
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vbo = null;
    this.vao = null;
  }
}

// ---------------------------------------------------------------------------
// Shader compilation utility
// ---------------------------------------------------------------------------

export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}
