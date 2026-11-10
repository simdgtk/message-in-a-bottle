import * as THREE from "three";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "./svgPath.js";
import { easeOutQuad } from "./easings.js";

const DEFAULT_DRAWING_OPTIONS = {
  size: 10,
  thinning: 0.34,
  streamline: 0.16,
  smoothing: 0.35,
  simulatePressure: true,
  easing: easeOutQuad,
};

const DEFAULT_ERASING_OPTIONS = {
  size: 32,
  thinning: 0.1,
  streamline: 0.2,
  smoothing: 0.5,
  simulatePressure: false,
};

export class Letter {
  constructor(options = {}) {
    this.inputRef = options.inputRef || null;
    this.fontSize = options.fontSize || 30;
    this.fontFamily = "'Cursive', cursive";
    this.fontColor = options.fontColor || "#533029";
    this.padding = options.padding ?? 50;
    this.lineHeight = Math.round(this.fontSize * 1.2);
    this.dpr = options.dpr || 1;
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

    this.background = null;
    this.paperColor = options.paperColor || "#f4ecdc";

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;

    this.text = "";
    this.paths = [];
    this.points = [];
    this.drawingMode = false;
    this.erasingMode = false;

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        this.render();
      });
    }
  }

  getCanvas() {
    return this.canvas;
  }

  resize(width = this.width, height = this.height) {
    this.width = width;
    this.height = height;

    if (this.canvas) {
      this.canvas.width = this.inkCanvas.width = Math.floor(width * this.dpr);
      this.canvas.height = this.inkCanvas.height = Math.floor(
        height * this.dpr,
      );
    }

    this.render();
  }

  setBackground(image) {
    this.background = image ?? null;
    this.render();
  }

  setContentUV({ uMin, uMax, vMin, vMax }) {
    this.contentRect = {
      x: uMin * this.width,
      y: (1 - vMax) * this.height,
      w: (uMax - uMin) * this.width,
      h: (vMax - vMin) * this.height,
    };
    this.render();
  }

  setText(text) {
    this.text = text ?? "";
    this.render();
  }

  setDrawingMode(enabled) {
    this.drawingMode = Boolean(enabled);
    if (!this.drawingMode) {
      this.focusInput();
    }
    return this.drawingMode;
  }

  toggleDrawingMode() {
    return this.setDrawingMode(!this.drawingMode);
  }

  setErasingMode(enabled) {
    this.erasingMode = Boolean(enabled);
    return this.erasingMode;
  }

  toggleErasingMode() {
    return this.setErasingMode(!this.erasingMode);
  }

  focusInput() {
    if (this.drawingMode) return;
    const input = this.inputRef?.value ?? this.inputRef;
    input?.focus();
  }

  onWindowKeyDown() {
    if (this.drawingMode) return;
    const input = this.inputRef?.value ?? this.inputRef;
    if (input && document.activeElement !== input) {
      input.focus();
    }
  }

  back() {
    this.paths.pop();
    this.render();
  }

  clear() {
    this.text = "";
    this.paths = [];
    this.points = [];
    this.render();
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
    if (!this.drawingMode) return;
    const coords = this.getPointerCoords(e);
    if (!coords) return;
    if (e.target?.setPointerCapture && e.pointerId !== undefined) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
    }
    this.points = [[coords.x, coords.y, coords.pressure]];
    this.render();
  }

  handlePointerMove(e) {
    if (!this.drawingMode || e.buttons !== 1) return;
    const coords = this.getPointerCoords(e);
    if (!coords) return;
    this.points.push([coords.x, coords.y, coords.pressure]);
    this.render();
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
        this.paths.push({
          path,
          isEraser: this.erasingMode,
          color: this.erasingMode ? null : this.fontColor,
        });
      }
      this.points = [];
      this.render();
    }
  }

  getLines(ctx, rawText, maxWidth) {
    const paragraphs = (rawText ?? "").split("\n");
    const lines = [];

    for (const paragraph of paragraphs) {
      if (paragraph === "") {
        lines.push("");
        continue;
      }
      const words = paragraph.split(" ");
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.inkCtx;
    const width = this.width;
    const height = this.height;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, width, height);

    if (this.text) {
      ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      ctx.fillStyle = this.fontColor;
      ctx.textBaseline = "top";

      const area = this.contentRect;
      const maxWidth = Math.max(100, area.w - this.padding * 2);
      const lines = this.getLines(ctx, this.text, maxWidth);
      let y = area.y + this.padding;

      for (const line of lines) {
        ctx.fillText(line, area.x + this.padding, y);
        y += this.lineHeight;
      }
    }

    for (const stroke of this.paths) {
      const pathData = new Path2D(stroke.path);
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill(pathData);
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.fillStyle = stroke.color || this.fontColor;
        ctx.fill(pathData);
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
          ctx.globalCompositeOperation = "destination-out";
          ctx.fill(pathData);
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.fillStyle = this.fontColor;
          ctx.fill(pathData);
        }
      }
    }

    ctx.restore();

    const out = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.background) {
      out.drawImage(this.background, 0, 0, w, h);
    } else {
      out.fillStyle = this.paperColor;
      out.fillRect(0, 0, w, h);
    }
    // Ink is authored upright; flip it to match the V-up UVs of the sheet.
    out.save();
    out.translate(0, h);
    out.scale(1, -1);
    out.drawImage(this.inkCanvas, 0, 0);
    out.restore();

    this.texture.needsUpdate = true;
  }

  toDataURL(type = "image/png") {
    return this.canvas?.toDataURL(type);
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.inkCanvas = null;
    this.inkCtx = null;
    this.background = null;
  }
}
