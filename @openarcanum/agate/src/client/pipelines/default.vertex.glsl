#version 300 es

#define SHADER_NAME PHASER_TEXTURE_TINT_VS

precision mediump float;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

in vec2 inPosition;
in vec2 inTexCoord;
in float inTintEffect;
in vec4 inTint;

out vec2 outTexCoord;
out float outTintEffect;
out vec4 outTint;

void main ()
{
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(inPosition, 1.0, 1.0);

  outTexCoord = inTexCoord;
  outTint = inTint;
  outTintEffect = inTintEffect;
}
