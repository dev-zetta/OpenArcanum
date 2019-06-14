#version 300 es

precision mediump float;
uniform float     iTime;
uniform vec2      uResolution;
uniform sampler2D uMainSampler;
in vec2 outTexCoord;
layout(location = 0) out vec4 outFragColor;
