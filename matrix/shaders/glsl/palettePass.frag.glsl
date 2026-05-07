precision mediump float;
#define PI 3.14159265359

uniform sampler2D tex;
uniform sampler2D bloomTex;
uniform sampler2D paletteTex;
uniform float ditherMagnitude;
uniform float time;
uniform vec3 backgroundColor, cursorColor, glintColor;
uniform float cursorIntensity, glintIntensity;
uniform vec2 mousePos;
varying vec2 vUV;

highp float rand( const in vec2 uv, const in float t ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c + t);
}

vec4 getBrightness(vec2 uv) {
	vec4 primary = texture2D(tex, uv);
	vec4 bloom = texture2D(bloomTex, uv);
	return primary + bloom;
}

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
	vec4 brightness = getBrightness(vUV);

	// Dither: subtract a random value from the brightness
	brightness -= rand( gl_FragCoord.xy, time ) * ditherMagnitude / 3.0;

	// Map the brightness to a position in the palette texture
	vec3 baseColor = texture2D( paletteTex, vec2(brightness.r, 0.0)).rgb
		+ min(cursorColor * cursorIntensity * brightness.g, vec3(1.0))
		+ min(glintColor * glintIntensity * brightness.b, vec3(1.0))
		+ backgroundColor;

	// Apply mouse-based hue shift
	if (mousePos.x >= 0.0 && mousePos.y >= 0.0) {
		float dist = distance(vUV, mousePos);
		float radius = 0.25;
		if (dist < radius) {
			float influence = 1.0 - (dist / radius);
			influence = influence * influence; // Ease out
			vec3 hsv = rgb2hsv(baseColor);
			hsv.x = mod(hsv.x - 0.25 * influence, 1.0); // Shift towards blue
			hsv.y = min(hsv.y * (1.0 + 0.3 * influence), 1.0); // Boost saturation
			baseColor = hsv2rgb(hsv);
		}
	}

	gl_FragColor = vec4(baseColor, 1.0);
}
