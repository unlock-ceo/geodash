/** Internal engine types for the render pipeline and particle system. */

export interface RenderContext {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  projectionMatrix: Float32Array; // 4x4
  viewMatrix: Float32Array; // 4x4
  time: number;
  deltaTime: number;
}

export interface RenderStage {
  init(gl: WebGL2RenderingContext): void;
  render(ctx: RenderContext): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface ParticleData {
  // SoA (Structure of Arrays) layout for GPU performance
  positions: Float32Array; // x,y,z interleaved -- 3 floats per particle
  velocities: Float32Array; // vx,vy,vz interleaved
  colors: Float32Array; // r,g,b,a interleaved -- 4 floats per particle
  sizes: Float32Array; // 1 float per particle
  lifetimes: Float32Array; // 1 float per particle (max lifetime)
  ages: Float32Array; // 1 float per particle (current age)
  masses: Float32Array; // 1 float per particle
  count: number;
  maxCount: number;
}

export interface EmitterConfig {
  rate: number; // particles per second
  position: [number, number, number];
  positionSpread: [number, number, number];
  velocity: [number, number, number];
  velocitySpread: [number, number, number];
  color: [number, number, number, number];
  colorSpread: [number, number, number, number];
  size: number;
  sizeSpread: number;
  lifetime: number;
  lifetimeSpread: number;
  mass: number;
  massSpread: number;
}

export interface FlowField {
  sample(
    x: number,
    y: number,
    z: number,
    time: number,
  ): [number, number, number];
}
