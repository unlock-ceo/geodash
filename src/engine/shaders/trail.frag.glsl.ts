/** Fragment shader for particle trail rendering (GLSL 300 es). */
export const trailFragmentShader = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 fragColor;

void main() {
  // Premultiplied alpha for additive blending
  fragColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`;
