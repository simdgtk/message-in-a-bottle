import { Howl } from "howler";

const AMBIENCE_VOLUME = 0.4;
const AMBIENCE_LETTER_VOLUME = 0.15;

const SFX = {
  barrelClick: { file: "barrel-click", volume: 0.7 },
  bottleClick: { file: "bottle-click", volume: 0.7 },
  bottleSend: { file: "bottle-send", volume: 0.8 },
  eraserRub: { file: "eraser-rub", volume: 0.6, loop: true },
};

export class AudioManager {
  constructor() {
    this.ambience = new Howl({
      src: ["/audio/ambience.m4a"],
      loop: true,
      volume: 0,
    });

    this.sfx = {};
    for (const [name, { file, volume, loop = false }] of Object.entries(SFX)) {
      this.sfx[name] = new Howl({ src: [`/audio/${file}.m4a`], volume, loop });
    }

    this.ambienceStarting = false;
    this.ambience.on("play", () => {
      this.ambienceStarting = false;
      this.removeUnlockListeners();
      this.ambience.fade(0, this.ambienceTarget ?? AMBIENCE_VOLUME, 2000);
    });
    this.ambience.on("playerror", () => {
      this.ambienceStarting = false;
    });
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
  }

  unlock = () => this.startAmbience();

  removeUnlockListeners() {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
  }

  startAmbience() {
    if (this.ambience.playing() || this.ambienceStarting) return;
    this.ambienceStarting = true;
    this.ambience.play();
  }
  setLetterMode(inLetter, duration = 800) {
    this.ambienceTarget = inLetter ? AMBIENCE_LETTER_VOLUME : AMBIENCE_VOLUME;
    if (!this.ambience.playing()) return;
    this.ambience.fade(this.ambience.volume(), this.ambienceTarget, duration);
  }

  play(name) {
    this.sfx[name]?.play();
  }

  stop(name) {
    this.sfx[name]?.stop();
  }

  destroy() {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    this.ambience.unload();
    Object.values(this.sfx).forEach((sound) => sound.unload());
    this.sfx = {};
  }
}
