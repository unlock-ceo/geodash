/**
 * Core GPU particle engine implementing the RenderStage interface.
 *
 * Uses SoA (Structure-of-Arrays) layout for cache-friendly physics,
 * instanced point rendering for particles, and ring-buffer line-strip
 * trails.  Target: 100K+ particles at 60 fps on mid-range hardware.
 */

import type {
  RenderStage,
  RenderContext,
  ParticleData,
  EmitterConfig,
  FlowField,
} from './types';
import { particleVertexShader } from './shaders/particle.vert.glsl.ts';
import { particleFragmentShader } from './shaders/particle.frag.glsl.ts';
import { trailVertexShader } from './shaders/trail.vert.glsl.ts';
import { trailFragmentShader } from './shaders/trail.frag.glsl.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cheap pseudo-random hash -- good enough for particle turbulence. */
function hash(n: number): number {
  let x = Math.sin(n) * 43758.5453;
  x = x - Math.floor(x);
  return x;
}

function spread(base: number, range: number): number {
  return base + (Math.random() - 0.5) * 2.0 * range;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAIL_LENGTH = 16; // positions kept per particle
const FLOATS_PER_TRAIL_VERTEX = 4; // x, y, z, alpha

// ---------------------------------------------------------------------------
// ParticleSystem
// ---------------------------------------------------------------------------

export class ParticleSystem implements RenderStage {
  // Particle state (SoA)
  private particles: ParticleData;
  private emitters: (EmitterConfig | null)[] = [];
  private flowFields: FlowField[] = [];

  // GL resources -- particle pass
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private sizeBuffer: WebGLBuffer | null = null;
  private ageBuffer: WebGLBuffer | null = null;
  private lifetimeBuffer: WebGLBuffer | null = null;

  // GL resources -- trail pass
  private trailProgram: WebGLProgram | null = null;
  private trailVao: WebGLVertexArrayObject | null = null;
  private trailBuffer: WebGLBuffer | null = null;

  // Trail ring buffer: each snapshot stores positions of *all* particles
  private trailHistory: Float32Array[];
  private trailHead = 0;

  // Scratch buffer for uploading trail geometry each frame
  private trailVertexData: Float32Array | null = null;

  // Physics tunables
  private gravity = 0.0;
  private friction = 0.02;
  private turbulence = 0.0;

  // Emitter bookkeeping -- fractional particles to emit
  private emitterAccum: number[] = [];

  // Uniform locations -- particles
  private uProjection: WebGLUniformLocation | null = null;
  private uView: WebGLUniformLocation | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private uPixelRatio: WebGLUniformLocation | null = null;

  // Uniform locations -- trails
  private uTrailProjection: WebGLUniformLocation | null = null;
  private uTrailView: WebGLUniformLocation | null = null;
  private uTrailColor: WebGLUniformLocation | null = null;

  constructor(maxCount: number = 150_000) {
    this.particles = {
      positions: new Float32Array(maxCount * 3),
      velocities: new Float32Array(maxCount * 3),
      colors: new Float32Array(maxCount * 4),
      sizes: new Float32Array(maxCount),
      lifetimes: new Float32Array(maxCount),
      ages: new Float32Array(maxCount),
      masses: new Float32Array(maxCount),
      count: 0,
      maxCount,
    };

    // Pre-fill ages above lifetimes so all particles start "dead"
    this.particles.ages.fill(999);
    this.particles.lifetimes.fill(1);

    // Initialise trail ring buffer
    this.trailHistory = [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      this.trailHistory.push(new Float32Array(maxCount * 3));
    }
  }

  // -----------------------------------------------------------------------
  // RenderStage
  // -----------------------------------------------------------------------

  init(gl: WebGL2RenderingContext): void {
    // --- Particle program ---
    this.program = this.createProgram(
      gl,
      particleVertexShader,
      particleFragmentShader,
    );
    this.uProjection = gl.getUniformLocation(this.program, 'u_projection');
    this.uView = gl.getUniformLocation(this.program, 'u_view');
    this.uTime = gl.getUniformLocation(this.program, 'u_time');
    this.uPixelRatio = gl.getUniformLocation(this.program, 'u_pixelRatio');

    // --- Particle VAO & buffers ---
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const max = this.particles.maxCount;

    // location 0 -- position (vec3)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      max * 3 * 4,
      gl.DYNAMIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 1);

    // location 1 -- color (vec4)
    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      max * 4 * 4,
      gl.DYNAMIC_DRAW,
    );
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    // location 2 -- size (float)
    this.sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, max * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);

    // location 3 -- age (float)
    this.ageBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, max * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(3, 1);

    // location 4 -- lifetime (float)
    this.lifetimeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lifetimeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, max * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(4, 1);

    gl.bindVertexArray(null);

    // --- Trail program ---
    this.trailProgram = this.createProgram(
      gl,
      trailVertexShader,
      trailFragmentShader,
    );
    this.uTrailProjection = gl.getUniformLocation(
      this.trailProgram,
      'u_projection',
    );
    this.uTrailView = gl.getUniformLocation(this.trailProgram, 'u_view');
    this.uTrailColor = gl.getUniformLocation(this.trailProgram, 'u_color');

    // --- Trail VAO & buffer ---
    this.trailVao = gl.createVertexArray();
    gl.bindVertexArray(this.trailVao);

    // Upper bound: maxCount particles * TRAIL_LENGTH vertices * 4 floats
    const trailBufSize = max * TRAIL_LENGTH * FLOATS_PER_TRAIL_VERTEX * 4;
    this.trailBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, trailBufSize, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_TRAIL_VERTEX * 4;
    // location 0 -- position (vec3)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    // location 1 -- alpha (float)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 12);

    gl.bindVertexArray(null);

    // Scratch buffer (allocated once, reused)
    this.trailVertexData = new Float32Array(
      max * TRAIL_LENGTH * FLOATS_PER_TRAIL_VERTEX,
    );
  }

  render(ctx: RenderContext): void {
    const { gl } = ctx;
    const dt = Math.min(ctx.deltaTime, 0.05); // cap to avoid spiral of death

    // --- CPU physics & emitter tick ---
    this.emitParticles(dt);
    this.updatePhysics(dt);
    this.recycleDeadParticles();
    this.snapshotTrails();

    const active = this.particles.count;
    if (active === 0) return;

    // --- Upload GPU buffers ---
    this.updateBuffers(gl);

    // --- Draw particles ---
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive
    gl.depthMask(false);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uProjection, false, ctx.projectionMatrix);
    gl.uniformMatrix4fv(this.uView, false, ctx.viewMatrix);
    gl.uniform1f(this.uTime, ctx.time);
    gl.uniform1f(
      this.uPixelRatio,
      typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1,
    );

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.POINTS, 0, 1, active);
    gl.bindVertexArray(null);

    // --- Draw trails ---
    this.renderTrails(ctx);

    // Restore state
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  resize(_width: number, _height: number): void {
    // Particles don't need explicit resize handling -- projection comes
    // from the RenderContext each frame.
  }

  dispose(): void {
    // Programs and buffers will be cleaned up by the GL context teardown,
    // but we null our references to allow GC.
    this.program = null;
    this.trailProgram = null;
    this.vao = null;
    this.trailVao = null;
    this.positionBuffer = null;
    this.colorBuffer = null;
    this.sizeBuffer = null;
    this.ageBuffer = null;
    this.lifetimeBuffer = null;
    this.trailBuffer = null;
    this.trailVertexData = null;
  }

  // -----------------------------------------------------------------------
  // Public API -- emitters
  // -----------------------------------------------------------------------

  addEmitter(config: EmitterConfig): number {
    const idx = this.emitters.length;
    this.emitters.push(config);
    this.emitterAccum.push(0);
    return idx;
  }

  removeEmitter(index: number): void {
    if (index >= 0 && index < this.emitters.length) {
      this.emitters[index] = null;
    }
  }

  clearEmitters(): void {
    this.emitters.length = 0;
    this.emitterAccum.length = 0;
  }

  // -----------------------------------------------------------------------
  // Public API -- flow fields
  // -----------------------------------------------------------------------

  addFlowField(field: FlowField): void {
    this.flowFields.push(field);
  }

  clearFlowFields(): void {
    this.flowFields.length = 0;
  }

  // -----------------------------------------------------------------------
  // Public API -- physics
  // -----------------------------------------------------------------------

  setPhysics(config: {
    gravity?: number;
    friction?: number;
    turbulence?: number;
  }): void {
    if (config.gravity !== undefined) this.gravity = config.gravity;
    if (config.friction !== undefined) this.friction = config.friction;
    if (config.turbulence !== undefined) this.turbulence = config.turbulence;
  }

  // -----------------------------------------------------------------------
  // Public API -- bulk operations
  // -----------------------------------------------------------------------

  /** Replace particle state with externally-provided data. */
  setParticles(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
  ): void {
    const count = Math.min(
      positions.length / 3,
      colors.length / 4,
      sizes.length,
      this.particles.maxCount,
    );
    this.particles.positions.set(positions.subarray(0, count * 3));
    this.particles.colors.set(colors.subarray(0, count * 4));
    this.particles.sizes.set(sizes.subarray(0, count));

    // Reset ages / lifetimes so they are all alive
    for (let i = 0; i < count; i++) {
      this.particles.ages[i] = 0;
      this.particles.lifetimes[i] = 999; // effectively immortal
      this.particles.masses[i] = 1;
      const i3 = i * 3;
      this.particles.velocities[i3] = 0;
      this.particles.velocities[i3 + 1] = 0;
      this.particles.velocities[i3 + 2] = 0;
    }
    this.particles.count = count;
  }

  /** One-shot burst of particles with partial config override. */
  emit(count: number, config: Partial<EmitterConfig>): void {
    const full: EmitterConfig = {
      rate: 0,
      position: config.position ?? [0, 0, 0],
      positionSpread: config.positionSpread ?? [0, 0, 0],
      velocity: config.velocity ?? [0, 0, 0],
      velocitySpread: config.velocitySpread ?? [0, 0, 0],
      color: config.color ?? [1, 1, 1, 1],
      colorSpread: config.colorSpread ?? [0, 0, 0, 0],
      size: config.size ?? 4,
      sizeSpread: config.sizeSpread ?? 0,
      lifetime: config.lifetime ?? 2,
      lifetimeSpread: config.lifetimeSpread ?? 0,
      mass: config.mass ?? 1,
      massSpread: config.massSpread ?? 0,
    };
    this.spawnParticles(count, full);
  }

  // -----------------------------------------------------------------------
  // Public API -- state queries
  // -----------------------------------------------------------------------

  getActiveCount(): number {
    return this.particles.count;
  }

  getMaxCount(): number {
    return this.particles.maxCount;
  }

  // -----------------------------------------------------------------------
  // Internal -- physics
  // -----------------------------------------------------------------------

  private updatePhysics(dt: number): void {
    const p = this.particles;
    const count = p.count;
    const pos = p.positions;
    const vel = p.velocities;
    const ages = p.ages;
    const lifetimes = p.lifetimes;
    const masses = p.masses;
    const grav = this.gravity;
    const fric = 1.0 - this.friction;
    const turb = this.turbulence;

    for (let i = 0; i < count; i++) {
      // Skip dead particles (will be recycled)
      const curAge = ages[i] ?? 0;
      const curLife = lifetimes[i] ?? 0;
      if (curAge >= curLife) continue;

      const newAge = curAge + dt;
      ages[i] = newAge;

      const i3 = i * 3;
      const mass = masses[i] ?? 1;

      let vx0 = vel[i3] ?? 0;
      let vy0 = vel[i3 + 1] ?? 0;
      let vz0 = vel[i3 + 2] ?? 0;

      // Gravity (along -Z)
      vz0 += grav * mass * dt;

      // Turbulence -- cheap hash-based noise
      if (turb > 0) {
        const seed = i * 73.137 + newAge * 17.31;
        vx0 += (hash(seed) - 0.5) * turb * dt;
        vy0 += (hash(seed + 1.0) - 0.5) * turb * dt;
        vz0 += (hash(seed + 2.0) - 0.5) * turb * dt;
      }

      // Flow fields
      const px = pos[i3] ?? 0;
      const py = pos[i3 + 1] ?? 0;
      const pz = pos[i3 + 2] ?? 0;
      for (const field of this.flowFields) {
        const [fvx, fvy, fvz] = field.sample(px, py, pz, newAge);
        vx0 += fvx * dt;
        vy0 += fvy * dt;
        vz0 += fvz * dt;
      }

      // Friction
      vx0 *= fric;
      vy0 *= fric;
      vz0 *= fric;

      // Write back velocities
      vel[i3] = vx0;
      vel[i3 + 1] = vy0;
      vel[i3 + 2] = vz0;

      // Euler integration
      pos[i3] = px + vx0 * dt;
      pos[i3 + 1] = py + vy0 * dt;
      pos[i3 + 2] = pz + vz0 * dt;
    }
  }

  // -----------------------------------------------------------------------
  // Internal -- emission
  // -----------------------------------------------------------------------

  private emitParticles(dt: number): void {
    for (let e = 0; e < this.emitters.length; e++) {
      const cfg = this.emitters[e];
      if (!cfg) continue;

      this.emitterAccum[e] = (this.emitterAccum[e] ?? 0) + cfg.rate * dt;
      const toEmit = Math.floor(this.emitterAccum[e] ?? 0);
      if (toEmit > 0) {
        this.emitterAccum[e] = (this.emitterAccum[e] ?? 0) - toEmit;
        this.spawnParticles(toEmit, cfg);
      }
    }
  }

  private spawnParticles(count: number, cfg: EmitterConfig): void {
    const p = this.particles;
    const max = p.maxCount;
    let idx = p.count;

    for (let n = 0; n < count && idx < max; n++, idx++) {
      const i3 = idx * 3;
      const i4 = idx * 4;

      p.positions[i3] = spread(cfg.position[0], cfg.positionSpread[0]);
      p.positions[i3 + 1] = spread(cfg.position[1], cfg.positionSpread[1]);
      p.positions[i3 + 2] = spread(cfg.position[2], cfg.positionSpread[2]);

      p.velocities[i3] = spread(cfg.velocity[0], cfg.velocitySpread[0]);
      p.velocities[i3 + 1] = spread(cfg.velocity[1], cfg.velocitySpread[1]);
      p.velocities[i3 + 2] = spread(cfg.velocity[2], cfg.velocitySpread[2]);

      p.colors[i4] = spread(cfg.color[0], cfg.colorSpread[0]);
      p.colors[i4 + 1] = spread(cfg.color[1], cfg.colorSpread[1]);
      p.colors[i4 + 2] = spread(cfg.color[2], cfg.colorSpread[2]);
      p.colors[i4 + 3] = spread(cfg.color[3], cfg.colorSpread[3]);

      p.sizes[idx] = spread(cfg.size, cfg.sizeSpread);
      p.lifetimes[idx] = Math.max(0.01, spread(cfg.lifetime, cfg.lifetimeSpread));
      p.ages[idx] = 0;
      p.masses[idx] = spread(cfg.mass, cfg.massSpread);
    }

    p.count = idx;
  }

  // -----------------------------------------------------------------------
  // Internal -- dead particle recycling (swap-and-pop)
  // -----------------------------------------------------------------------

  private recycleDeadParticles(): void {
    const p = this.particles;
    let i = 0;
    while (i < p.count) {
      if ((p.ages[i] ?? 0) >= (p.lifetimes[i] ?? 0)) {
        // Swap with last alive particle
        const last = p.count - 1;
        if (i !== last) {
          this.swapParticles(i, last);
        }
        p.count--;
      } else {
        i++;
      }
    }
  }

  private swapParticles(a: number, b: number): void {
    const p = this.particles;
    const a3 = a * 3;
    const b3 = b * 3;
    const a4 = a * 4;
    const b4 = b * 4;

    // positions
    this.swap3(p.positions, a3, b3);
    // velocities
    this.swap3(p.velocities, a3, b3);
    // colors
    this.swap4(p.colors, a4, b4);
    // scalars
    this.swapScalar(p.sizes, a, b);
    this.swapScalar(p.lifetimes, a, b);
    this.swapScalar(p.ages, a, b);
    this.swapScalar(p.masses, a, b);
  }

  private swap3(arr: Float32Array, a: number, b: number): void {
    let tmp: number;
    tmp = arr[a]!;     arr[a] = arr[b]!;         arr[b] = tmp;
    tmp = arr[a + 1]!; arr[a + 1] = arr[b + 1]!; arr[b + 1] = tmp;
    tmp = arr[a + 2]!; arr[a + 2] = arr[b + 2]!; arr[b + 2] = tmp;
  }

  private swap4(arr: Float32Array, a: number, b: number): void {
    let tmp: number;
    tmp = arr[a]!;     arr[a] = arr[b]!;         arr[b] = tmp;
    tmp = arr[a + 1]!; arr[a + 1] = arr[b + 1]!; arr[b + 1] = tmp;
    tmp = arr[a + 2]!; arr[a + 2] = arr[b + 2]!; arr[b + 2] = tmp;
    tmp = arr[a + 3]!; arr[a + 3] = arr[b + 3]!; arr[b + 3] = tmp;
  }

  private swapScalar(arr: Float32Array, a: number, b: number): void {
    const tmp = arr[a]!;
    arr[a] = arr[b]!;
    arr[b] = tmp;
  }

  // -----------------------------------------------------------------------
  // Internal -- trail snapshots
  // -----------------------------------------------------------------------

  private snapshotTrails(): void {
    const snap = this.trailHistory[this.trailHead];
    if (!snap) return;
    snap.set(
      this.particles.positions.subarray(0, this.particles.count * 3),
    );
    this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
  }

  private renderTrails(ctx: RenderContext): void {
    const { gl } = ctx;
    const active = this.particles.count;
    if (active === 0 || !this.trailVertexData) return;

    // Build trail vertex data: for each particle, emit TRAIL_LENGTH
    // vertices walking backward through the ring buffer.
    let offset = 0;
    for (let p = 0; p < active; p++) {
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        // Walk from newest to oldest
        const histIdx =
          (this.trailHead - 1 - t + TRAIL_LENGTH * 2) % TRAIL_LENGTH;
        const snap = this.trailHistory[histIdx];
        if (!snap) continue;
        const p3 = p * 3;
        this.trailVertexData[offset] = snap[p3] ?? 0;
        this.trailVertexData[offset + 1] = snap[p3 + 1] ?? 0;
        this.trailVertexData[offset + 2] = snap[p3 + 2] ?? 0;
        this.trailVertexData[offset + 3] =
          1.0 - t / (TRAIL_LENGTH - 1); // alpha fades along trail
        offset += FLOATS_PER_TRAIL_VERTEX;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.trailVertexData.subarray(0, offset),
    );

    gl.useProgram(this.trailProgram);
    gl.uniformMatrix4fv(this.uTrailProjection, false, ctx.projectionMatrix);
    gl.uniformMatrix4fv(this.uTrailView, false, ctx.viewMatrix);
    gl.uniform4f(this.uTrailColor, 0.4, 0.7, 1.0, 0.3);

    gl.bindVertexArray(this.trailVao);

    // Draw each particle's trail as a separate line strip
    for (let p = 0; p < active; p++) {
      gl.drawArrays(gl.LINE_STRIP, p * TRAIL_LENGTH, TRAIL_LENGTH);
    }

    gl.bindVertexArray(null);
  }

  // -----------------------------------------------------------------------
  // Internal -- GPU buffer updates
  // -----------------------------------------------------------------------

  private updateBuffers(gl: WebGL2RenderingContext): void {
    const p = this.particles;
    const n = p.count;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.positions.subarray(0, n * 3));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.colors.subarray(0, n * 4));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.sizes.subarray(0, n));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.ages.subarray(0, n));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lifetimeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.lifetimes.subarray(0, n));
  }

  // -----------------------------------------------------------------------
  // Internal -- shader compilation
  // -----------------------------------------------------------------------

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info ?? 'unknown'}`);
    }
    return shader;
  }

  private createProgram(
    gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
  ): WebGLProgram {
    const vert = this.compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog) throw new Error('Failed to create program');
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program link error: ${info ?? 'unknown'}`);
    }
    // Shaders can be detached after linking
    gl.detachShader(prog, vert);
    gl.detachShader(prog, frag);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return prog;
  }
}
