import { nextTick } from "vue";
import gsap from "gsap";

let fadeElement = null;
let isFading = false;

export function setFadeElement(el) {
  fadeElement = el;
}

export async function fadeThrough(change) {
  if (isFading || !fadeElement) return;
  isFading = true;
  try {
    await gsap.to(fadeElement, { autoAlpha: 1, duration: 0.6, ease: "sine.inOut" });
    await change();
    await nextTick();
  } finally {
    await gsap.to(fadeElement, { autoAlpha: 0, duration: 0.8, ease: "sine.inOut" });
    isFading = false;
  }
}
