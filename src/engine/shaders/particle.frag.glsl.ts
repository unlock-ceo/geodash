/** Fragment shader for particle rendering (GLSL 300 es). */
export const particleFragmentShader = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_age;
in float v_lifetime;

out vec4 fragColor;

void main() {
  // Circular particle with soft edge
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float distSq = dot(coord, coord);

  // Hard discard outside unit circle
  if (distSq > 1.0) {
    discard;
  }

  // Soft edge falloff
  float softEdge = 1.0 - smoothstep(0.4, 1.0, distSq);

  // Final alpha incorporating soft edge and vertex color alpha
  float alpha = v_color.a * softEdge;

  // Premultiplied alpha output (additive-blend friendly)
  fragColor = vec4(v_color.rgb * alpha, alpha);
}
`;
