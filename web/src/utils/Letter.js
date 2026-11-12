import * as THREE from "three";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "./svgPath.js";
import { easeOutQuad } from "./easings.js";
import { damp, clamp } from "./maths.js";

const DEFAULT_DRAWING_OPTIONS = {
  size: 10,
  thinning: 0.34,
  streamline: 0.16,
  smoothing: 0.35,
  simulatePressure: true,
  easing: easeOutQuad,
};

export const TOOLS = ["text", "draw", "erase", "photo"];

const DEFAULT_ERASING_OPTIONS = {
  size: 32,
  thinning: 0.5,
  streamline: 0.2,
  smoothing: 0.5,
  simulatePressure: true,
  start: { cap: false, taper: 40 },
  end: { cap: false, taper: 60 },
};

export class Letter {
  constructor(options = {}) {
    this.fontSize = options.fontSize || 30;
    this.fontFamily = "'Cursive', cursive";
    this.fontColor = options.fontColor || "#533029";
    this.padding = options.padding ?? 50;
    this.lineHeight = Math.round(this.fontSize * 1.2);
    this.dpr = options.dpr || 1;
    this.imageAddingMode = false;
    this.drawingOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      ...options.drawingOptions,
    };

    this.erasingOptions = {
      ...DEFAULT_ERASING_OPTIONS,
      ...options.erasingOptions,
    };

    this.width = options.size ?? 1448;
    this.height = this.width;
    this.contentRect = { x: 0, y: 0, w: this.width, h: this.height };

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    this.ctx = this.canvas.getContext("2d");

    this.inkCanvas = document.createElement("canvas");
    this.inkCanvas.width = this.canvas.width;
    this.inkCanvas.height = this.canvas.height;
    this.inkCtx = this.inkCanvas.getContext("2d");

    this.secondCanvas = document.createElement("canvas");
    this.secondCanvas.width = this.inkCanvas.width;
    this.secondCanvas.height = this.inkCanvas.height;
    this.secondCtx = this.secondCanvas.getContext("2d");

    this.photoCanvas = document.createElement("canvas");
    this.photoCanvas.width = this.canvas.width;
    this.photoCanvas.height = this.canvas.height;
    this.photoCtx = this.photoCanvas.getContext("2d");

    this.background = null;
    this.paperColor = options.paperColor || "#f4ecdc";

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;

    // Tout ce qui est posé sur la lettre, dans l'ordre : render() le rejoue tel quel.
    //   { tool: "text", content }            bloc de texte (un par passage sur l'outil plume)
    //   { tool: "draw", path, color }        trait de pinceau
    //   { tool: "erase", path }              coup de gomme (n'efface que ce qui est avant lui)
    //   { tool: "photo", img, x, y, w, h }   image (dessinée sur photoCanvas, jamais gommée)
    this.history = [];
    this.activeText = null; // bloc de texte en cours, ajouté à history au 1er caractère
    this.textarea = null; // textarea cachée du bloc en cours
    this.textContainer = null; // élément DOM où créer la textarea (fourni par l'overlay)
    this.points = [];
    this.tool = "text";
    this.toolBeforePhoto = "text";
    this.onToolChange = null;
    this.drawingMode = false;
    this.erasingMode = false;

    this.img = null;
    this.tapeImage = new Image();
    this.tapeImage.src = "/images/tape.webp";

    this.ghostTarget = null;
    this.ghostPos = null;
    this.ghostRotationTarget = null;
    this.ghostRotation = null;
    this.ghostSize = null;
    this.dampingFactor = 0.25;
    this.imageMargin = 100;

    this.inLetterMode = false;

    // if (typeof document !== "undefined" && document.fonts?.ready) {
    //   document.fonts.ready.then(() => {
    //     this.render();
    //   });
    // }
  }

  getCanvas() {
    return this.canvas;
  }

  prepareImage(src) {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 300 / Math.max(img.width, img.height));
      this.ghostSize = { w: img.width * scale, h: img.height * scale };
      this.img = img;
      this.setTool("photo");
      this.imageAddingMode = true;
    };
    img.onerror = () => console.warn("Img pas chargée");
    img.src = src;
  }

  cancelImage() {
    this.img = null;
    this.ghostSize = null;
    this.ghostPos = null;
    this.ghostRotation = null;
    this.imageAddingMode = false;
    if (this.tool === "photo") this.setTool(this.toolBeforePhoto ?? "text");
  }

  resize(width = this.width, height = this.height) {
    this.width = width;
    this.height = height;

    if (this.canvas && this.secondCanvas) {
      this.canvas.width = this.inkCanvas.width = Math.floor(width * this.dpr);
      this.canvas.height = this.inkCanvas.height = Math.floor(
        height * this.dpr,
      );

      this.secondCanvas.width = this.photoCanvas.width = this.canvas.width;
      this.secondCanvas.height = this.photoCanvas.height = this.canvas.height;
    }

    // this.render();
  }

  setBackground(image) {
    this.background = image ?? null;
    // this.render();
  }

  setContentUV({ uMin, uMax, vMin, vMax }) {
    this.contentRect = {
      x: uMin * this.width,
      y: (1 - vMax) * this.height,
      w: (uMax - uMin) * this.width,
      h: (vMax - vMin) * this.height,
    };
    // this.render();
  }

  // Nouveau bloc de texte : nouvelle textarea vide. Le bloc n'entre dans history
  // qu'au premier caractère, pour ne pas empiler de blocs vides.
  startTextBlock() {
    this.removeTextarea();
    this.activeText = { tool: "text", content: "" };

    const textarea = document.createElement("textarea");
    textarea.className = "letter-input";
    textarea.setAttribute("aria-label", "Texte de la lettre");
    // Invisible : le texte est rendu dans le canvas. Styles en ligne car créée hors du
    // template Vue (le CSS scoped de l'overlay ne s'y applique pas)
    Object.assign(textarea.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
      resize: "none",
    });
    textarea.addEventListener("input", () => this.onTextareaInput());
    // Pas de suppression : on rature à la gomme
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") e.preventDefault();
    });
    textarea.addEventListener("cut", (e) => e.preventDefault());

    (this.textContainer ?? document.body).appendChild(textarea);
    this.textarea = textarea;
  }

  onTextareaInput() {
    const block = this.activeText;
    if (!block) return;
    block.content = this.textarea.value;
    if (!this.history.includes(block)) this.history.push(block);
  }

  removeTextarea() {
    this.textarea?.remove();
    this.textarea = null;
  }

  setTool(tool) {
    if (!TOOLS.includes(tool)) return this.tool;
    if (tool === this.tool) {
      // Re-clic sur la plume : nouveau bloc, sauf si le bloc en cours est encore vide
      if (tool === "text" && this.activeText?.content) {
        this.startTextBlock();
        this.focusInput();
      }
      return tool;
    }

    if (this.tool === "photo" && this.imageAddingMode) {
      this.img = null;
      this.ghostSize = null;
      this.ghostPos = null;
      this.ghostRotation = null;
      this.imageAddingMode = false;
    }
    if (tool === "photo") this.toolBeforePhoto = this.tool;

    this.tool = tool;
    this.drawingMode = tool === "draw" || tool === "erase";
    this.erasingMode = tool === "erase";
    this.points = [];
    if (tool === "text") {
      this.startTextBlock();
      this.focusInput();
    }

    this.onToolChange?.(tool);
    return tool;
  }

  focusInput() {
    if (this.tool !== "text") return;
    if (!this.textarea) this.startTextBlock();
    if (document.activeElement !== this.textarea) {
      this.textarea.focus({ preventScroll: true });
    }
  }

  // Annule la dernière action (bloc de texte, trait, gomme ou photo)
  back() {
    const last = this.history.pop();
    // Bloc en cours annulé : on vide sa textarea, il reviendra au prochain caractère
    if (last && last === this.activeText) {
      last.content = "";
      if (this.textarea) this.textarea.value = "";
    }
  }

  clear() {
    this.history = [];
    this.points = [];
    if (this.tool === "text") this.startTextBlock();
  }

  getPointerCoords(e) {
    const uv = this.pointerMapper?.(e.clientX, e.clientY);
    if (!uv) return null;
    return {
      x: uv.x * this.width,
      y: (1 - uv.y) * this.height,
      pressure: e.pressure || 0.5,
    };

    // const rect = e.currentTarget.getBoundingClientRect();
    // return {
    //   x: ((e.clientX - rect.left) / rect.width) * this.width,
    //   y: ((e.clientY - rect.top) / rect.height) * this.height,
    //   pressure: e.pressure || 0.5,
    // };
  }

  handlePointerDown(e) {
    if (!this.drawingMode && !this.imageAddingMode) return;
    const coords = this.getPointerCoords(e);
    if (!coords) return;
    if (this.imageAddingMode) {
      e.preventDefault();
      const { x, y } = this.ghostPos ?? coords;
      this.history.push({ tool: "photo", img: this.img, x, y, ...this.ghostSize });
      this.cancelImage();
      return;
    }

    if (e.target?.setPointerCapture && e.pointerId !== undefined) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
    }
    this.points = [[coords.x, coords.y, coords.pressure]];
    // this.render();
  }

  clampToLetter(coords) {
    const { x, y, w, h } = this.contentRect;
    const halfWidth = this.ghostSize.w / 2 + this.imageMargin;
    const halfHeigth = this.ghostSize.h / 2 + this.imageMargin;
    return {
      ...coords,
      x: clamp(coords.x, x + halfWidth, x + w - halfWidth),
      y: clamp(coords.y, y + halfHeigth, y + h - halfHeigth),
    };
  }

  handlePointerMove(e) {
    if (this.imageAddingMode) {
      this.ghostTarget = this.clampToLetter(this.getPointerCoords(e));
      if (this.ghostTarget && !this.ghostPos)
        this.ghostPos = { ...this.ghostTarget };
      return;
    }
    if (!this.drawingMode || e.buttons !== 1) return;
    const coords = this.getPointerCoords(e);
    if (!coords) return;
    this.points.push([coords.x, coords.y, coords.pressure]);
    // this.render();
  }

  handlePointerUp() {
    if (!this.drawingMode) return;
    if (this.points.length > 0) {
      const options = this.erasingMode
        ? this.erasingOptions
        : this.drawingOptions;
      const stroke = getStroke(this.points, options);
      const path = getSvgPathFromStroke(stroke);

      if (path) {
        this.history.push(
          this.erasingMode
            ? { tool: "erase", path }
            : { tool: "draw", path, color: this.fontColor },
        );
      }
      this.points = [];
      // this.render();
    }
  }

  getLines(ctx, rawText, maxWidth) {
    const lines = [];
    let offset = 0;

    for (const paragraph of (rawText ?? "").split("\n")) {
      const words = paragraph.split(" ");
      let current = "";
      let start = offset;

      words.forEach((word, i) => {
        const testLine = i === 0 ? word : `${current} ${word}`;
        if (i > 0 && current && ctx.measureText(testLine).width > maxWidth) {
          lines.push({ text: current, start });
          start += current.length + 1;
          current = word;
        } else {
          current = testLine;
        }
      });

      lines.push({ text: current, start });
      offset += paragraph.length + 1;
    }

    return lines;
  }

  // Met en page le texte de tous les blocs mis bout à bout.
  // ranges : Map(bloc -> [début, fin[) dans ce texte complet
  layoutText(ctx) {
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.textBaseline = "top";

    const ranges = new Map();
    let full = "";
    for (const entry of this.history) {
      if (entry.tool !== "text") continue;
      ranges.set(entry, [full.length, full.length + entry.content.length]);
      full += entry.content;
    }

    const area = this.contentRect;
    const maxWidth = Math.max(100, area.w - this.padding * 2);
    return {
      ranges,
      lines: this.getLines(ctx, full, maxWidth),
      x0: area.x + this.padding,
      y0: area.y + this.padding,
    };
  }

  // Dessine uniquement les caractères du bloc, à leur place dans la mise en page complète
  drawTextRange(ctx, { ranges, lines, x0, y0 }, entry) {
    const range = ranges.get(entry);
    if (!range) return;
    const [from, to] = range;

    ctx.fillStyle = this.fontColor;
    lines.forEach(({ text: line, start }, i) => {
      const a = Math.max(from, start) - start;
      const b = Math.min(to, start + line.length) - start;
      if (a >= b) return;
      const x = x0 + ctx.measureText(line.slice(0, a)).width;
      ctx.fillText(line.slice(a, b), x, y0 + i * this.lineHeight);
    });
  }

  update(deltaMs) {
    if (!this.inLetterMode) return;

    if (this.imageAddingMode && this.ghostPos && this.ghostTarget) {
      this.ghostPos.x = damp(
        this.ghostPos.x,
        this.ghostTarget.x,
        this.dampingFactor,
        deltaMs,
      );
      this.ghostPos.y = damp(
        this.ghostPos.y,
        this.ghostTarget.y,
        this.dampingFactor,
        deltaMs,
      );
    }

    this.render();
  }

  drawPhoto(ctx, img, x, y, w, h) {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    const tapeRatio = this.tapeImage.height / this.tapeImage.width;
    this.drawTape(ctx, x + w / 2, y - h / 2, 38, 400 * tapeRatio);
    this.drawTape(ctx, x - w / 2, y + h / 2, 34, 400 * tapeRatio);
  }

  drawTape(ctx, cx, cy, angleDeg, length) {
    const tape = this.tapeImage;
    if (!tape?.complete || !tape.naturalWidth) return;
    const height = length * (tape.naturalHeight / tape.naturalWidth);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(tape, -length / 2, -height / 2, length, height);
    ctx.restore();
  }

  eraseStroke(ctx, path) {
    this.secondCtx.clearRect(
      0,
      0,
      this.secondCanvas.width,
      this.secondCanvas.height,
    );

    this.secondCtx.drawImage(this.inkCanvas, 0, 0);

    ctx.save();
    ctx.clip(path);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 0.15;
    ctx.filter = "url(#erase)";
    ctx.drawImage(this.secondCanvas, -4, 1, this.width, this.height);
    ctx.drawImage(this.secondCanvas, 4, 1, this.width, this.height);
    ctx.restore();
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.inkCtx;
    const width = this.width;
    const height = this.height;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, width, height);

    const textLayout = this.layoutText(ctx);

    for (const entry of this.history) {
      if (entry.tool === "text") {
        this.drawTextRange(ctx, textLayout, entry);
      } else if (entry.tool === "draw") {
        ctx.fillStyle = entry.color || this.fontColor;
        ctx.fill(new Path2D(entry.path));
      } else if (entry.tool === "erase") {
        this.eraseStroke(ctx, new Path2D(entry.path));
      }
    }

    if (this.points.length > 0) {
      const options = this.erasingMode
        ? this.erasingOptions
        : this.drawingOptions;
      const stroke = getStroke(this.points, options);
      const pathString = getSvgPathFromStroke(stroke);
      if (pathString) {
        const pathData = new Path2D(pathString);
        if (this.erasingMode) {
          this.eraseStroke(ctx, pathData);
        } else {
          ctx.fillStyle = this.fontColor;
          ctx.fill(pathData);
        }
      }
    }

    ctx.restore();

    const photoCtx = this.photoCtx;
    photoCtx.save();
    photoCtx.scale(this.dpr, this.dpr);
    photoCtx.clearRect(0, 0, width, height);

    for (const entry of this.history) {
      if (entry.tool !== "photo") continue;
      const { img, x, y, w, h } = entry;
      this.drawPhoto(photoCtx, img, x, y, w, h);
    }

    if (this.imageAddingMode && this.img && this.ghostPos && this.ghostTarget) {
      photoCtx.globalAlpha = 0.5;
      this.drawPhoto(
        photoCtx,
        this.img,
        this.ghostPos.x,
        this.ghostPos.y,
        this.ghostSize.w,
        this.ghostSize.h,
      );
    }
    photoCtx.restore();

    const out = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.background) {
      out.drawImage(this.background, 0, 0, w, h);
    } else {
      out.fillStyle = this.paperColor;
      out.fillRect(0, 0, w, h);
    }
    out.save();
    out.translate(0, h);
    out.scale(1, -1);
    out.drawImage(this.inkCanvas, 0, 0);
    out.drawImage(this.photoCanvas, 0, 0);
    out.restore();

    this.texture.needsUpdate = true;
  }

  toDataURL(type = "image/png") {
    return this.canvas?.toDataURL(type);
  }

  toBase64(type = "image/png", quality) {
    const dataURL = this.canvas?.toDataURL(type, quality);
    return dataURL ? dataURL.split(",")[1] : null;
  }

  destroy() {
    this.removeTextarea();
    this.canvas = null;
    this.ctx = null;
    this.inkCanvas = null;
    this.inkCtx = null;
    this.secondCanvas = null;
    this.secondCtx = null;
    this.photoCanvas = null;
    this.photoCtx = null;
    this.background = null;
  }
}
