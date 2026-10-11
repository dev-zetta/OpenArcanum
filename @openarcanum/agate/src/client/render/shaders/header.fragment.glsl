#version 300 es

uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D uTexture;
#define uSampler uTexture
in vec2 vTextureCoord;
// Shared with the high-precision vertex shader; precisions must match at link time.
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
#define inputSize uInputSize
#define outputFrame uOutputFrame
uniform vec2 iMouse;
uniform vec2 iWorldPosition;
out vec4 outFragColor;
