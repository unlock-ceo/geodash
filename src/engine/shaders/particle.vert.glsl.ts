/** Vertex shader for instanced particle rendering (GLSL 300 es). */
export const particleVertexShader = `#version 300 es
precision highp float;

// Per-instance attributes
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in float a_size;
layout(location = 3) in float a_age;
layout(location = 4) in float a_lifetime;

// Uniforms
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform float u_pixelRatio;

// Outputs to fragment shader
out vec4 v_color;
out float v_age;
out float v_lifetime;

void main() {
  // Skip dead particles by collapsing them to zero size
  float alive = step(0.001, a_lifetime) * step(a_age, a_lifetime);

  gl_Position = u_projection * u_view * vec4(a_position, 1.0);

  // Perspective-correct point size: gl_Position.w increases with distance from camera.
  // MapLibre's projMatrix encodes the full view+projection transform, so w is reliable.
  float distAtten = 1.0 / max(gl_Position.w, 0.001);

  // Age-based fade: full size at birth, shrink slightly near death
  float lifeRatio = a_age / max(a_lifetime, 0.001);
  float ageFade = 1.0 - lifeRatio * lifeRatio * 0.3;

  gl_PointSize = a_size * distAtten * u_pixelRatio * ageFade * alive;

  // Age-based alpha fade: ramp up quickly, hold, then fade out
  float alphaRamp = smoothstep(0.0, 0.05, lifeRatio) * (1.0 - smoothstep(0.7, 1.0, lifeRatio));
  v_color = vec4(a_color.rgb, a_color.a * alphaRamp * alive);
  v_age = a_age;
  v_lifetime = a_lifetime;
}
`;
