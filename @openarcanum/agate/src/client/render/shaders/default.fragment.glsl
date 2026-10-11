#version 300 es

uniform sampler2D uTexture;
in vec2 vTextureCoord;
out vec4 outFragColor;

void main(void) {
  outFragColor = texture(uTexture, vTextureCoord);
}
