/**
 * MapLibre custom layer that delegates to the RenderPipeline.
 *
 * This is a thin integration layer -- all GL logic lives in RenderPipeline
 * and ParticleSystem.  Positions must be set in Mercator coordinates
 * (use projection.ts helpers before feeding data to the particle system).
 *
 * CRITICAL: MapLibre owns the GL context. We must save and restore all GL
 * state that the particle pipeline touches, otherwise MapLibre's own
 * rendering breaks (labels disappear, tiles render wrong, etc.).
 */

import type maplibregl from 'maplibre-gl';
import { RenderPipeline } from './RenderPipeline';

export class ParticleLayer implements maplibregl.CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom' as const;
  renderingMode: '3d' = '3d' as const;

  private pipeline: RenderPipeline;
  private map: maplibregl.Map | null = null;

  constructor(id: string = 'particle-layer', pipeline?: RenderPipeline) {
    this.id = id;
    this.pipeline = pipeline ?? new RenderPipeline();
  }

  // -----------------------------------------------------------------------
  // CustomLayerInterface
  // -----------------------------------------------------------------------

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    const gl2 = gl as WebGL2RenderingContext;
    this.pipeline.init(gl2);
    this.pipeline.resize(gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (!this.map) return;

    // Access MapLibre's projection matrix via the painter's transform.
    // This maps Mercator [0-1] coordinates to clip space.
    const transform = (this.map as unknown as { painter?: { transform?: { projMatrix?: Float64Array | Float32Array } } }).painter?.transform;
    if (!transform) return;

    const projMatrix = transform.projMatrix;
    if (!projMatrix) return;

    // projMatrix is a Float64Array -- convert to Float32Array for WebGL
    const projFloat32 = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      projFloat32[i] = projMatrix[i]!;
    }

    // MapLibre's projMatrix already incorporates the view transform,
    // so pass identity for the view matrix.
    const viewMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

    const gl2 = gl as WebGL2RenderingContext;

    // --- Save MapLibre's GL state ---
    const savedProgram = gl2.getParameter(gl2.CURRENT_PROGRAM) as WebGLProgram | null;
    const savedVao = gl2.getParameter(gl2.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    const savedArrayBuffer = gl2.getParameter(gl2.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    const savedBlendEnabled = gl2.isEnabled(gl2.BLEND);
    const savedDepthMask = gl2.getParameter(gl2.DEPTH_WRITEMASK) as boolean;
    const savedBlendSrcRGB = gl2.getParameter(gl2.BLEND_SRC_RGB) as number;
    const savedBlendDstRGB = gl2.getParameter(gl2.BLEND_DST_RGB) as number;
    const savedBlendSrcAlpha = gl2.getParameter(gl2.BLEND_SRC_ALPHA) as number;
    const savedBlendDstAlpha = gl2.getParameter(gl2.BLEND_DST_ALPHA) as number;
    const savedActiveTexture = gl2.getParameter(gl2.ACTIVE_TEXTURE) as number;

    // --- Render particles ---
    this.pipeline.render(projFloat32, viewMatrix);

    // --- Restore MapLibre's GL state ---
    gl2.useProgram(savedProgram);
    gl2.bindVertexArray(savedVao);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, savedArrayBuffer);
    gl2.depthMask(savedDepthMask);
    gl2.activeTexture(savedActiveTexture);

    if (savedBlendEnabled) {
      gl2.enable(gl2.BLEND);
    } else {
      gl2.disable(gl2.BLEND);
    }
    gl2.blendFuncSeparate(
      savedBlendSrcRGB,
      savedBlendDstRGB,
      savedBlendSrcAlpha,
      savedBlendDstAlpha,
    );

    // Request continuous repaint for animation
    this.map.triggerRepaint();
  }

  onRemove(): void {
    this.pipeline.dispose();
    this.map = null;
  }

  // -----------------------------------------------------------------------
  // Public accessors
  // -----------------------------------------------------------------------

  getPipeline(): RenderPipeline {
    return this.pipeline;
  }

  getParticleSystem() {
    return this.pipeline.getParticleSystem();
  }
}
