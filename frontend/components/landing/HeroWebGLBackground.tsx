"use client";

import { useEffect, useRef, useState } from "react";
import createREGL, { type Regl } from "regl";

const PHOTO_URL = "/back-1.jpg";
const LIGHT_IMAGE_UV: [number, number] = [0.5, 0.3];
/** Push image down on screen — more open sky above the horizon. */
const IMAGE_SHIFT_DOWN = 0.10;

const VERT_SHADER = `
  precision highp float;
  attribute vec2 position;
  varying vec2 vUv;
  void main(){
    vUv = position*0.5+0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uUVScale;
  uniform vec2 uUVOffset;
  uniform vec2 uLightUV;
  uniform float uTime;
  uniform float uReduceMotion;
  uniform vec2 uParallax;

  vec2 toImageUV(vec2 uvTopDown){
    vec2 imageUV = uvTopDown*uUVScale + uUVOffset;
    return vec2(imageUV.x, 1.0 - imageUV.y);
  }

  float luminance(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

  float hash(vec2 p){
    return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main(){
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

    vec2 uvBg = uv + uParallax*0.012;
    vec3 base = texture2D(uTexture, toImageUV(uvBg)).rgb;

    vec2 uvFg = uv + uParallax*0.028;
    vec2 lightUV = uLightUV + uParallax*0.048;

    float t = uTime * (1.0 - 0.85*uReduceMotion);
    const int SAMPLES = 64;

    float density = 0.78 + 0.38*sin(t*0.22) + 0.20*sin(t*0.51 + 1.7);
    float decay = 0.952 + 0.024*sin(t*0.14 + 0.4);
    float exposure = 0.62 + 0.14*sin(t*0.29) + 0.08*sin(t*0.73 + 2.1);
    float weight = 1.0;

    vec2 toPixel = uvFg - lightUV;
    float ang = 0.085*sin(t*0.33 + uv.x*5.0) + 0.038*sin(t*0.61 + uv.y*3.0);
    float ca = cos(ang), sa = sin(ang);
    vec2 dir = mat2(ca, -sa, sa, ca) * toPixel;

    vec2 deltaUV = dir * density / float(SAMPLES);
    vec2 sampleUV = uvFg;
    float illum = 0.0;
    float curDecay = 1.0;

    for(int i=0;i<SAMPLES;i++){
      sampleUV -= deltaUV;
      vec3 sc = texture2D(uTexture, toImageUV(sampleUV)).rgb;
      float lum = luminance(sc);
      float bright = smoothstep(0.46, 0.96, lum);
      illum += bright*curDecay*weight;
      curDecay *= decay;
    }
    illum /= float(SAMPLES);

    float shimmer = hash(uv*vec2(500.0,500.0) + t*1.9);
    illum *= 0.88 + 0.42*shimmer;

    float angle = atan(toPixel.y, toPixel.x);
    float spokesA = pow(abs(sin(angle*9.0 + sin(t*0.08)*0.6)), 2.1);
    float spokesB = pow(abs(sin(angle*5.0 - t*0.05)), 4.5);
    float spokes = clamp(spokesA*0.82 + spokesB*0.92, 0.0, 1.8);
    illum *= mix(1.0, spokes, 0.88);
    illum = pow(illum, 1.02);

    float distToLight = length(uvFg - lightUV);
    float coreGlow = exp(-distToLight*3.6) * (0.78 + 0.32*sin(t*0.6));

    vec3 rayColor = mix(vec3(1.0,0.72,0.44), vec3(1.0,0.93,0.82), coreGlow);
    vec3 rays = rayColor * illum * exposure * 1.18;
    vec3 core = vec3(1.0,0.92,0.78) * coreGlow * 0.68;

    vec3 color = base + rays + core;

    float vig = smoothstep(1.15, 0.35, length(uv-vec2(0.5,0.42)));
    color *= mix(0.88, 1.0, vig);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const PARTICLE_VERT = `
  precision highp float;
  attribute float aSeedX, aSeedY, aSpeed, aSize, aPhase, aSpread;
  uniform vec2 uLightUV;
  uniform float uTime;
  uniform vec2 uParallax;
  varying float vAlpha;

  void main(){
    float life = fract(aSeedY + uTime*aSpeed);
    float travel = life;
    float easeOut = 1.0 - (1.0-travel)*(1.0-travel);

    vec2 lightUV = uLightUV + uParallax*0.07;

    // Fan outward from the light — wider launch angle, brighter rise
    float fanAngle = aSeedX * 1.35;
    float radius = aSpread * easeOut * 1.05;
    vec2 fanOffset = vec2(sin(fanAngle) * radius, -abs(cos(fanAngle)) * radius * 0.42);
    vec2 posTopDown = lightUV + fanOffset + vec2(0.0, -travel * 0.82);

    vec2 clip = vec2(posTopDown.x, 1.0 - posTopDown.y) * 2.0 - 1.0;
    gl_Position = vec4(clip, 0.0, 1.0);

    gl_PointSize = aSize * (1.0 - travel*0.42) * 3.1;

    float fadeIn = smoothstep(0.0, 0.10, life);
    float fadeOut = smoothstep(1.0, 0.68, life);
    float twinkle = 0.72 + 0.28*sin(uTime*3.2 + aPhase);
    vAlpha = fadeIn*fadeOut*twinkle * 1.35;
  }
`;

const PARTICLE_FRAG = `
  precision highp float;
  varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.52, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.96, 0.82), a * 1.25);
  }
`;

type SceneDrawProps = {
  uUVScale: [number, number];
  uUVOffset: [number, number];
  uLightUV: [number, number];
  uTime: number;
  uParallax: [number, number];
};

type ParticleDrawProps = {
  uLightUV: [number, number];
  uTime: number;
  uParallax: [number, number];
};

function initWebGL(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  reduceMotion: boolean,
  onReady: () => void,
): () => void {
  let regl: Regl;
  try {
    regl = createREGL({
      canvas,
      attributes: { antialias: false, preserveDrawingBuffer: false },
    });
  } catch {
    return () => {};
  }

  const texture = regl.texture({
    data: image,
    flipY: true,
    min: "linear",
    mag: "linear",
  });

  let uvScale: [number, number] = [1, 1];
  let uvOffset: [number, number] = [0, 0];
  let lightCanvasUV: [number, number] = [0.5, 0.3];

  const resize = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const canvasAspect = W / H;
    const imageAspect = image.width / image.height;

    if (canvasAspect > imageAspect) {
      const scaleY = imageAspect / canvasAspect;
      uvScale = [1, scaleY];
      uvOffset = [0, (1 - scaleY) / 2];
    } else {
      const scaleX = canvasAspect / imageAspect;
      uvScale = [scaleX, 1];
      uvOffset = [(1 - scaleX) / 2, 0];
    }

    // Shift image down → horizon sits lower, more open space above
    uvOffset[1] -= IMAGE_SHIFT_DOWN * uvScale[1];

    lightCanvasUV = [
      (LIGHT_IMAGE_UV[0] - uvOffset[0]) / uvScale[0],
      (LIGHT_IMAGE_UV[1] - uvOffset[1]) / uvScale[1],
    ];

    regl.poll();
  };

  window.addEventListener("resize", resize);
  resize();

  const draw = regl({
    vert: VERT_SHADER,
    frag: FRAG_SHADER,
    attributes: { position: [[-1, -1], [3, -1], [-1, 3]] },
    uniforms: {
      uTexture: texture,
      uUVScale: regl.prop<SceneDrawProps, "uUVScale">("uUVScale"),
      uUVOffset: regl.prop<SceneDrawProps, "uUVOffset">("uUVOffset"),
      uLightUV: regl.prop<SceneDrawProps, "uLightUV">("uLightUV"),
      uTime: regl.prop<SceneDrawProps, "uTime">("uTime"),
      uReduceMotion: reduceMotion ? 1.0 : 0.0,
      uParallax: regl.prop<SceneDrawProps, "uParallax">("uParallax"),
    },
    count: 3,
  });

  const PARTICLE_COUNT = reduceMotion ? 0 : 620;
  const pSeedX = new Float32Array(PARTICLE_COUNT);
  const pSeedY = new Float32Array(PARTICLE_COUNT);
  const pSpeed = new Float32Array(PARTICLE_COUNT);
  const pSize = new Float32Array(PARTICLE_COUNT);
  const pPhase = new Float32Array(PARTICLE_COUNT);
  const pSpread = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pSeedX[i] = Math.random() * 2 - 1;
    pSeedY[i] = Math.random();
    pSpeed[i] = 0.018 + Math.random() * 0.06;
    pSize[i] = 0.8 + Math.random() * 3.2;
    pPhase[i] = Math.random() * 6.283;
    pSpread[i] = 0.9 + Math.random() * 2.8;
  }

  const drawParticles = PARTICLE_COUNT
    ? regl({
        vert: PARTICLE_VERT,
        frag: PARTICLE_FRAG,
        attributes: {
          aSeedX: pSeedX,
          aSeedY: pSeedY,
          aSpeed: pSpeed,
          aSize: pSize,
          aPhase: pPhase,
          aSpread: pSpread,
        },
        uniforms: {
          uLightUV: regl.prop<ParticleDrawProps, "uLightUV">("uLightUV"),
          uTime: regl.prop<ParticleDrawProps, "uTime">("uTime"),
          uParallax: regl.prop<ParticleDrawProps, "uParallax">("uParallax"),
        },
        blend: {
          enable: true,
          func: { src: "src alpha", dst: "one" },
        },
        depth: { enable: false },
        primitive: "points",
        count: PARTICLE_COUNT,
      })
    : null;

  const parallaxTarget: [number, number] = [0, 0];
  const parallaxCurrent: [number, number] = [0, 0];

  const onPointerMove = (e: PointerEvent) => {
    parallaxTarget[0] = (e.clientX / window.innerWidth) * 2 - 1;
    parallaxTarget[1] = (e.clientY / window.innerHeight) * 2 - 1;
  };

  if (!reduceMotion) {
    window.addEventListener("pointermove", onPointerMove);
  }

  const start = performance.now();
  const cancelFrame = regl.frame(() => {
    const uTime = (performance.now() - start) / 1000;

    if (!reduceMotion) {
      const idleX = Math.sin(uTime * 0.05) * 0.5;
      const idleY = Math.cos(uTime * 0.037) * 0.5;
      const tx = parallaxTarget[0] + idleX;
      const ty = parallaxTarget[1] + idleY;
      parallaxCurrent[0] += (tx - parallaxCurrent[0]) * 0.025;
      parallaxCurrent[1] += (ty - parallaxCurrent[1]) * 0.025;
    }

    draw({
      uUVScale: uvScale,
      uUVOffset: uvOffset,
      uLightUV: lightCanvasUV,
      uTime,
      uParallax: parallaxCurrent,
    });

    if (drawParticles) {
      drawParticles({
        uLightUV: lightCanvasUV,
        uTime,
        uParallax: parallaxCurrent,
      });
    }
  });

  onReady();

  return () => {
    cancelFrame.cancel();
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    texture.destroy();
    regl.destroy();
  };
}

export function HeroWebGLBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const img = new Image();
    img.crossOrigin = "anonymous";

    let cleanup = () => {};

    img.onload = () => {
      try {
        cleanup = initWebGL(canvas, img, reduceMotion, () => setCanvasReady(true));
      } catch {
        setWebglFailed(true);
      }
    };

    img.onerror = () => setWebglFailed(true);
    img.src = PHOTO_URL;

    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div
        className="absolute inset-0 -z-10 bg-cover bg-[center_22%]"
        style={{ backgroundImage: `url(${PHOTO_URL})` }}
      />

      <canvas
        ref={canvasRef}
        id="gl"
        className={`hero-gl-canvas absolute inset-0 block h-full w-full ${canvasReady ? "ready" : ""}`}
        style={{ opacity: webglFailed ? 0 : undefined }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_32%,rgba(90,35,207,0.12)_0%,rgba(0,0,0,0.45)_55%,rgba(0,0,0,0.72)_100%)] mix-blend-multiply" />
      <div className="absolute inset-x-0 top-0 h-[52vh] bg-gradient-to-b from-black/90 via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[26vh] bg-gradient-to-t from-black/70 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
