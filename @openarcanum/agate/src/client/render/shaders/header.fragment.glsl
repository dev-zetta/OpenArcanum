#version 300 es

precision mediump float;
uniform float     iTime;
uniform vec2      iResolution;
uniform sampler2D uSampler;
in vec2 vTextureCoord;
uniform vec4 inputSize;
uniform vec4 outputFrame;
layout(location = 0) out vec4 outFragColor;

