import * as THREE from "three";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "./svgPath.js";
import { easeOutQuad } from "./easings.js";
import { damp, clamp } from "./maths.js";

const DEFAULT_DRAWING_OPTIONS = {
  size: 15,
  thinning: 0.34,
  streamline: 0.16,
  smoothing: 0.35,
  simulatePressure: true,
  easing: easeOutQuad,
};

export const TOOLS = ["text", "draw", "erase", "photo"];

const DEFAULT_ERASING_OPTIONS = {
  size: 47,
  thinning: 0.5,
  streamline: 0.2,
  smoothing: 0.5,
  simulatePressure: true,
  start: { cap: false, taper: 40 },
  end: { cap: false, taper: 60 },
};

export class Letter {
  constructor(options = {}) {
    this.fontSize = options.fontSize || 47;
    this.fontFamily = "'Cursive', cursive";
    this.fontColor = options.fontColor || "#533029";
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
    this.receivedImage = null;
    this.paperColor = options.paperColor || "#f4ecdc";

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;

    this.history = [];
    this.activeText = null;
    this.textarea = null;
    this.textContainer = null;
    this.points = [];
    this.tool = "text";
    this.toolBeforePhoto = "text";
    this.onToolChange = null;
    this.onSound = null;
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

    this.cursorTarget = null;
    this.cursorPos = null;
    this.imageMargin = 100;

    this.inLetterMode = false;
    this.isDirty = true;

    this.tapeImage.onload = () => {
      this.isDirty = true;
    };

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
      this.isDirty = true;
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
    this.isDirty = true;
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

    this.isDirty = true;
    // this.render();
  }

  setBackground(image) {
    this.background = image ?? null;
    this.isDirty = true;
    // this.render();
  }

  ensureTextarea() {
    if (this.textarea) return this.textarea;

    const textarea = document.createElement("textarea");
    textarea.className = "letter-input";
    textarea.setAttribute("aria-label", "Texte de la lettre");
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
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") e.preventDefault();
      if (e.key === "Escape") this.endTextBlock();
    });
    textarea.addEventListener("cut", (e) => e.preventDefault());

    (this.textContainer ?? document.body).appendChild(textarea);
    this.textarea = textarea;
    return textarea;
  }

  startTextBlock({ x, y }) {
    this.endTextBlock();
    this.activeText = {
      tool: "text",
      content: "",
      x,
      y: y - this.fontSize / 2,
    };
    const textarea = this.ensureTextarea();
    textarea.value = "";
    textarea.focus({ preventScroll: true });
  }

  endTextBlock() {
    this.activeText = null;
    if (this.textarea) {
      this.textarea.value = "";
      this.textarea.blur();
    }
  }

  onTextareaInput() {
    const block = this.activeText;
    if (!block) return;
    block.content = this.textarea.value;
    if (!this.history.includes(block)) this.history.push(block);
    this.isDirty = true;
  }

  removeTextarea() {
    this.activeText = null;
    this.textarea?.remove();
    this.textarea = null;
  }

  setTool(tool) {
    if (!TOOLS.includes(tool)) return this.tool;
    if (tool === this.tool) return tool;

    if (this.tool === "photo" && this.imageAddingMode) {
      this.img = null;
      this.ghostSize = null;
      this.ghostPos = null;
      this.ghostRotation = null;
      this.imageAddingMode = false;
      this.isDirty = true;
    }
    if (tool === "photo") this.toolBeforePhoto = this.tool;

    this.tool = tool;
    this.drawingMode = tool === "draw" || tool === "erase";
    this.erasingMode = tool === "erase";
    if (this.points.length > 0) this.isDirty = true;
    this.points = [];
    this.endTextBlock();
    this.cursorTarget = null;
    this.cursorPos = null;
    this.isDirty = true;

    this.onToolChange?.(tool);
    return tool;
  }

  focusInput() {
    if (this.tool !== "text" || !this.activeText || !this.textarea) return;
    if (document.activeElement !== this.textarea) {
      this.textarea.focus({ preventScroll: true });
    }
  }

  back() {
    const last = this.history.pop();
    if (last && last === this.activeText) this.endTextBlock();
    this.isDirty = true;
  }

  clear() {
    this.history = [];
    this.points = [];
    this.endTextBlock();
    this.isDirty = true;
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
    const isText = this.tool === "text" && !this.imageAddingMode;
    if (!this.drawingMode && !this.imageAddingMode && !isText) return;
    const coords = this.getPointerCoords(e);
    if (!coords) return;
    if (isText) {
      e.preventDefault();
      this.startTextBlock(coords);
      this.isDirty = true;
      return;
    }
    if (this.imageAddingMode) {
      e.preventDefault();
      const { x, y } = this.ghostPos ?? coords;
      this.history.push({ tool: "photo", img: this.img, x, y, ...this.ghostSize });
      this.cancelImage();
      this.isDirty = true;
      return;
    }

    if (e.target?.setPointerCapture && e.pointerId !== undefined) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
    }
    this.points = [[coords.x, coords.y, coords.pressure]];
    this.isDirty = true;
    if (this.erasingMode) this.onSound?.("eraserRub");
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
    if (this.tool === "text" && !this.imageAddingMode) {
      const coords = this.getPointerCoords(e);
      const wasShown = !!this.cursorTarget;
      this.cursorTarget = coords;
      if (!coords) this.cursorPos = null;
      else if (!this.cursorPos) this.cursorPos = { ...coords };
      if (wasShown !== !!coords) this.isDirty = true;
      return;
    }
    if (this.imageAddingMode) {
      const coords = this.getPointerCoords(e);
      if (!coords) return;
      this.ghostTarget = this.clampToLetter(coords);
      if (this.ghostTarget && !this.ghostPos) {
        this.ghostPos = { ...this.ghostTarget };
        this.isDirty = true;
      }
      return;
    }
    if (!this.drawingMode || e.buttons !== 1) return;
    const coords = this.getPointerCoords(e);
    if (!coords) return;
    this.points.push([coords.x, coords.y, coords.pressure]);
    this.isDirty = true;
    // this.render();
  }

  handlePointerUp() {
    if (!this.drawingMode) return;
    if (this.erasingMode) this.onSound?.("eraserRub", "stop");
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
      this.isDirty = true;
      // this.render();
    }
  }

  drawText(ctx, { content, x, y }) {
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = this.fontColor;
    content.split("\n").forEach((line, i) => {
      ctx.fillText(line, x, y + i * this.lineHeight);
    });
  }

  drawCursor(ctx) {
    if (this.tool !== "text" || !this.cursorPos || !this.cursorTarget) return;
    const height = this.fontSize * 1.1;
    ctx.fillStyle = this.fontColor;
    ctx.fillRect(this.cursorPos.x - 1.5, this.cursorPos.y - height / 2, 3, height);
  }

  update(deltaMs) {
    if (!this.inLetterMode) return;

    if (this.tool === "text" && this.cursorPos && this.cursorTarget) {
      const nextX = damp(this.cursorPos.x, this.cursorTarget.x, this.dampingFactor, deltaMs);
      const nextY = damp(this.cursorPos.y, this.cursorTarget.y, this.dampingFactor, deltaMs);
      const moved =
        Math.abs(nextX - this.cursorPos.x) > 0.05 ||
        Math.abs(nextY - this.cursorPos.y) > 0.05;
      this.cursorPos.x = nextX;
      this.cursorPos.y = nextY;
      if (moved) this.isDirty = true;
    }

    if (this.imageAddingMode && this.ghostPos && this.ghostTarget) {
      const nextX = damp(
        this.ghostPos.x,
        this.ghostTarget.x,
        this.dampingFactor,
        deltaMs,
      );
      const nextY = damp(
        this.ghostPos.y,
        this.ghostTarget.y,
        this.dampingFactor,
        deltaMs,
      );
      if (
        Math.abs(nextX - this.ghostPos.x) > 0.05 ||
        Math.abs(nextY - this.ghostPos.y) > 0.05
      ) {
        this.ghostPos.x = nextX;
        this.ghostPos.y = nextY;
        this.isDirty = true;
      }
    }

    if (this.isDirty) {
      this.render();
    }
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

    for (const entry of this.history) {
      if (entry.tool === "text") {
        this.drawText(ctx, entry);
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
    if (this.receivedImage) {
      out.drawImage(this.receivedImage, 0, 0, w, h);
    } else {
      out.drawImage(this.inkCanvas, 0, 0);
      out.drawImage(this.photoCanvas, 0, 0);
      out.scale(this.dpr, this.dpr);
      this.drawCursor(out);
    }
    out.restore();

    this.texture.needsUpdate = true;
    this.isDirty = false;
  }

  toDataURL(type = "image/png") {
    return this.canvas?.toDataURL(type);
  }

  exportImage({ size = 1024, type = "image/webp", quality = 0.8 } = {}) {
    if (!this.inkCanvas || !this.photoCanvas) return null;
    if (this.imageAddingMode) this.cancelImage();
    this.render();

    const out = document.createElement("canvas");
    out.width = size;
    out.height = Math.round(size * (this.height / this.width));

    const ctx = out.getContext("2d");
    ctx.drawImage(this.inkCanvas, 0, 0, out.width, out.height);
    ctx.drawImage(this.photoCanvas, 0, 0, out.width, out.height);

    return out.toDataURL(type, quality);
  }

  async showReceived(src) {
    if (!src) {
      this.receivedImage = null;
      this.isDirty = true;
      return;
    }
    const image = new Image();
    image.src = src;
    await image.decode();
    this.receivedImage = image;
    this.isDirty = true;
  }

  isEmpty() {
    return !this.history.some(
      (entry) => entry.tool !== "text" || entry.content.trim() !== "",
    );
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
