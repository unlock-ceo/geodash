export interface PhysicsConfig {
  gravity: number;
  friction: number;
  turbulence: number;
  flowFieldStrength: number;
}

export interface ParticleConfig {
  maxCount: number;
  baseSize: number;
  baseColor: [number, number, number, number]; // RGBA 0-1
  trailLength: number;
  lifetime: number; // seconds
  physics: PhysicsConfig;
}

export interface Particle {
  position: [number, number, number]; // lng, lat, alt
  velocity: [number, number, number];
  color: [number, number, number, number];
  size: number;
  lifetime: number;
  age: number;
  mass: number;
}
