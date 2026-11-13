// from Bruno Simon
import {
  add,
  color,
  float,
  mat2,
  Fn,
  mix,
  mul,
  mx_noise_float,
  mx_worley_noise_float,
  parallaxUV,
  positionLocal,
  positionGeometry,
  modelWorldMatrix,
  vec4,
  sin,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  uvec2,
  ivec2,
  floor,
  fract,
  sub,
  abs,
  cos,
  pow,
  Loop,
  normalize,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

export const hash12 = /*@__PURE__*/ Fn(
  ([p]) => {
    const q = uvec2(ivec2(p)).mul(uvec2(1597334677, 3812015801));
    const n = q.x.bitXor(q.y).mul(1597334677);

    return float(n).mul(1.0 / 4294967295.0);
  },
  { p: "vec2", return: "float" },
);

const noise = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(sub(3.0, mul(2.0, f)));

  return float(-1.0).add(
    mul(
      2.0,
      mix(
        mix(hash12(i.add(vec2(0.0, 0.0))), hash12(i.add(vec2(1.0, 0.0))), u.x),
        mix(hash12(i.add(vec2(0.0, 1.0))), hash12(i.add(vec2(1.0, 1.0))), u.x),
        u.y,
      ),
    ),
  );
});

const sea_octave = Fn(([uv_immutable, choppy]) => {
  const uv = uv_immutable.toVar();
  uv.addAssign(noise(uv));
  const wv = sub(1.0, abs(sin(uv))).toVar();
  const swv = abs(cos(uv));
  wv.assign(mix(wv, swv, wv));

  return pow(sub(1.0, pow(wv.x.mul(wv.y), 0.65)), choppy);
});

const OCTAVE_M = mat2(vec2(1.6, 1.2), vec2(-1.2, 1.6));
const ITER_GEOMETRY = 3;
const ITER_FRAGMENT = 5;

const seaHeight = Fn(({ p, time, waves, iterations }) => {
  const freq = waves.freq.toVar();
  const amp = waves.height.toVar();
  const choppy = waves.choppy.toVar();
  const uv = p.xz.toVar();
  uv.x.mulAssign(0.75);
  const h = float(0.0).toVar();

  Loop(iterations, () => {
    const d = sea_octave(uv.add(time.mul(waves.speed)).mul(freq), choppy).toVar();
    d.addAssign(sea_octave(uv.sub(time.mul(waves.speed)).mul(freq), choppy));
    h.addAssign(d.mul(amp));
    uv.assign(OCTAVE_M.mul(uv));
    freq.mulAssign(1.9);
    amp.mulAssign(0.22);
    choppy.assign(mix(choppy, 1.0, 0.2));
  });

  return h;
});

const map_detailed = (p, time, waves) =>
  p.y.sub(seaHeight({ p, time, waves, iterations: ITER_FRAGMENT }));

export const get_normal_detailed = (p, eps, time, waves) => {
  const y = map_detailed(p, time, waves);
  const x = map_detailed(vec3(p.x.add(eps), p.y, p.z), time, waves).sub(y);
  const z = map_detailed(vec3(p.x, p.y, p.z.add(eps)), time, waves).sub(y);

  return normalize(vec3(x, eps, z));
};

export class OceanMaterial extends MeshBasicNodeMaterial {
  constructor({
    depth = 0.06,
    causticsScale = 22,
    causticsSpeed = 0.1,
    deepColor = 0x1e5f92,
    causticsColor = 0x55b0d8,
    foamScale = 15,
    foamSpeed = 0.03,
    foamWidth = 0.07,
    foamColor = 0xdde8ee,
    foamOpacity = 0.8,
  } = {}) {
    super();

    this.uDepth = uniform(depth);
    this.uCausticsScale = uniform(causticsScale);
    this.uCausticsSpeed = uniform(causticsSpeed);
    this.uDeepColor = uniform(color(deepColor));
    this.uCausticsColor = uniform(color(causticsColor));
    this.uFoamScale = uniform(foamScale);
    this.uFoamSpeed = uniform(foamSpeed);
    this.uFoamWidth = uniform(foamWidth);
    this.uFoamColor = uniform(color(foamColor));
    this.uFoamOpacity = uniform(foamOpacity);

    // waves
    this.uSeaHeight = uniform(1.3);
    this.uSeaChoppy = uniform(4.0);
    this.uSeaSpeed = uniform(1.5);
    this.uSeaFreq = uniform(0.08);

    this.waves = {
      height: this.uSeaHeight,
      choppy: this.uSeaChoppy,
      speed: this.uSeaSpeed,
      freq: this.uSeaFreq,
    };

    const depthUv = parallaxUV(uv(), this.uDepth).xy;
    const causticsUv = vec3(
      depthUv.mul(this.uCausticsScale),
      time.mul(this.uCausticsSpeed),
    );

    // float hash12(vec2 p) {
    //     uvec2 q = uvec2(ivec2(p)) * uvec2(1597334677u, 3812015801u);
    //     uint n = (q.x ^ q.y) * 1597334677u;
    //     return float(n) * (1.0 / 4294967295.0);
    // }

    // const pos = positionLocal;
    // const displacement = sin(add(mul(pos.x, 4.0), time)).mul(2);

    const worldPos = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz;
    const waveHeight = seaHeight({
      p: worldPos,
      time,
      waves: this.waves,
      iterations: ITER_GEOMETRY,
    });

    const causticsNoise = mx_worley_noise_float(causticsUv).pow(3);
    const depthColor = mix(this.uDeepColor, this.uCausticsColor, causticsNoise);

    const foamInput = uv().mul(this.uFoamScale);
    const foamNoise = mx_noise_float(
      vec3(foamInput, time.mul(this.uFoamSpeed)),
    );
    const foamMask = foamNoise.abs().step(this.uFoamWidth).oneMinus();
    const finalFoamFactor = foamMask.mul(this.uFoamOpacity);

    this.colorNode = mix(depthColor, this.uFoamColor, finalFoamFactor);
    this.positionNode = add(positionLocal, vec3(0, 0, waveHeight));
    this.opacityNode = float(1);
  }
}
