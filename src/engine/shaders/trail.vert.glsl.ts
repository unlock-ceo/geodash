/** Vertex shader for particle trail rendering (GLSL 300 es). */
export const trailVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in float a_alpha;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform vec4 u_color;

out vec4 v_color;

void main() {
  gl_Position = u_projection * u_view * vec4(a_position, 1.0);

  // Fade trail along its length
  v_color = vec4(u_color.rgb, u_color.a * a_alpha);
}
`;
