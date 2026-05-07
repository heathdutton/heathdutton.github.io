import makeConfig from "./js/config.js";

const canvas = document.createElement("canvas");
canvas.className = "matrix-bg";
const panelCover = document.querySelector(".panel-cover");
if (panelCover) {
	panelCover.insertBefore(canvas, panelCover.firstChild);
}

// Track mouse position for interactive effects
const mouse = { x: -1, y: -1 };
document.addEventListener("mousemove", (e) => {
	const rect = canvas.getBoundingClientRect();
	mouse.x = (e.clientX - rect.left) / rect.width;
	mouse.y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y for GL
});
document.addEventListener("mouseleave", () => {
	mouse.x = -1;
	mouse.y = -1;
});

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

const startMatrix = async () => {
	const config = makeConfig({ skipIntro: "false" });

	await Promise.all([loadJS("/matrix/lib/regl.min.js"), loadJS("/matrix/lib/gl-matrix.js")]);

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
	};
	window.addEventListener("resize", resize);
	resize();

	const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
	const optionalExtensions = ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"];

	const regl = createREGL({ canvas, pixelRatio: 1, extensions, optionalExtensions });

	const { makeFullScreenQuad, makePipeline } = await import("./js/regl/utils.js");
	const { default: makeRain } = await import("./js/regl/rainPass.js");
	const { default: makeBloomPass } = await import("./js/regl/bloomPass.js");
	const { default: makePalettePass } = await import("./js/regl/palettePass.js");
	const { default: makeQuiltPass } = await import("./js/regl/quiltPass.js");

	const cameraCanvas = document.createElement("canvas");
	cameraCanvas.width = 1;
	cameraCanvas.height = 1;
	const cameraTex = regl.texture(cameraCanvas);
	const cameraAspectRatio = () => 1;
	const lkg = { enabled: false, tileX: 1, tileY: 1 };

	const fullScreenQuad = makeFullScreenQuad(regl);
	const context = { regl, config, lkg, cameraTex, cameraAspectRatio, mouse };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, makePalettePass, makeQuiltPass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));

	const dimensions = { width: 1, height: 1 };
	const targetFrameTimeMilliseconds = 1000 / config.fps;
	let last = NaN;

	regl.frame(({ viewportWidth, viewportHeight }) => {
		const now = regl.now() * 1000;
		if (isNaN(last)) {
			last = now;
		}

		const shouldRender = config.fps >= 60 || now - last >= targetFrameTimeMilliseconds;
		if (shouldRender) {
			while (now - targetFrameTimeMilliseconds > last) {
				last += targetFrameTimeMilliseconds;
			}
		}

		if (dimensions.width !== viewportWidth || dimensions.height !== viewportHeight) {
			dimensions.width = viewportWidth;
			dimensions.height = viewportHeight;
			for (const step of pipeline) {
				step.setSize(viewportWidth, viewportHeight);
			}
		}
		fullScreenQuad(() => {
			for (const step of pipeline) {
				step.execute(shouldRender);
			}
			drawToScreen();
		});
	});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", startMatrix);
} else {
	startMatrix();
}
