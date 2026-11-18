// Neon line-art icons for the reels. Each glyph is drawn once into a text-atlas
// texture (red = glowing line, green = dim fill) and shown with the label shader,
// so it "decodes" in like the card text and blooms like the rest of the scene.
import { C, makeLabel, SANS } from './kit.js';

const HEAD_FONT_FAMILY = SANS;

const R = '#ff0000';
const G = '#00ff00';

function prep(ctx, w) {
  ctx.lineWidth = Math.max(2.2, w * 0.045);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = R;
  ctx.fillStyle = G;
}
const both = (ctx) => {
  ctx.fill();
  ctx.stroke();
};
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function personPath(ctx, cx, top, s) {
  ctx.beginPath();
  ctx.arc(cx, top + s * 0.25, s * 0.17, 0, Math.PI * 2);
  both(ctx);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.36, top + s * 0.95);
  ctx.bezierCurveTo(cx - s * 0.36, top + s * 0.5, cx + s * 0.36, top + s * 0.5, cx + s * 0.36, top + s * 0.95);
  ctx.closePath();
  both(ctx);
}
function bolt(ctx, cx, cy, s) {
  ctx.beginPath();
  [[0.1, -0.5], [-0.25, 0.08], [0.02, 0.08], [-0.1, 0.5], [0.28, -0.1], [0.02, -0.1], [0.12, -0.5]].forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
  ctx.closePath();
}

export const GLYPHS = {
  code(ctx, w, h) {
    ctx.font = `700 ${h * 0.62}px "JetBrainsMono Nerd Font", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = R;
    ctx.fillText('</>', w / 2, h * 0.54);
  },
  cloud(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.82);
    ctx.arc(w * 0.26, h * 0.62, h * 0.2, Math.PI * 0.5, Math.PI * 1.45);
    ctx.arc(w * 0.47, h * 0.42, h * 0.27, Math.PI * 1.1, Math.PI * 1.85);
    ctx.arc(w * 0.72, h * 0.58, h * 0.24, Math.PI * 1.35, Math.PI * 0.5);
    ctx.closePath();
    both(ctx);
  },
  file(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.08);
    ctx.lineTo(w * 0.6, h * 0.08);
    ctx.lineTo(w * 0.8, h * 0.28);
    ctx.lineTo(w * 0.8, h * 0.92);
    ctx.lineTo(w * 0.22, h * 0.92);
    ctx.closePath();
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.6, h * 0.08);
    ctx.lineTo(w * 0.6, h * 0.28);
    ctx.lineTo(w * 0.8, h * 0.28);
    ctx.stroke();
    // sync arrows
    ctx.beginPath();
    ctx.arc(w * 0.51, h * 0.6, w * 0.15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.51, h * 0.6, w * 0.15, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  },
  share(ctx, w, h) {
    const P = [[0.25, 0.5], [0.75, 0.22], [0.75, 0.78]];
    ctx.beginPath();
    ctx.moveTo(w * P[1][0], h * P[1][1]);
    ctx.lineTo(w * P[0][0], h * P[0][1]);
    ctx.lineTo(w * P[2][0], h * P[2][1]);
    ctx.stroke();
    for (const [x, y] of P) {
      ctx.beginPath();
      ctx.arc(w * x, h * y, w * 0.12, 0, Math.PI * 2);
      both(ctx);
    }
  },
  chat(ctx, w, h) {
    rr(ctx, w * 0.1, h * 0.14, w * 0.8, h * 0.56, h * 0.16);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.7);
    ctx.lineTo(w * 0.24, h * 0.9);
    ctx.lineTo(w * 0.48, h * 0.7);
    ctx.stroke();
    ctx.fillStyle = R;
    for (const x of [0.33, 0.5, 0.67]) {
      ctx.beginPath();
      ctx.arc(w * x, h * 0.42, w * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  video(ctx, w, h) {
    rr(ctx, w * 0.08, h * 0.26, w * 0.58, h * 0.48, h * 0.1);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.68, h * 0.44);
    ctx.lineTo(w * 0.92, h * 0.3);
    ctx.lineTo(w * 0.92, h * 0.7);
    ctx.lineTo(w * 0.68, h * 0.56);
    ctx.closePath();
    both(ctx);
  },
  ai(ctx, w, h) {
    rr(ctx, w * 0.24, h * 0.24, w * 0.52, h * 0.52, w * 0.08);
    both(ctx);
    for (let i = 0; i < 3; i++) {
      const k = 0.36 + i * 0.14;
      for (const [x0, y0, x1, y1] of [[k, 0.08, k, 0.24], [k, 0.76, k, 0.92], [0.08, k, 0.24, k], [0.76, k, 0.92, k]]) {
        ctx.beginPath();
        ctx.moveTo(w * x0, h * y0);
        ctx.lineTo(w * x1, h * y1);
        ctx.stroke();
      }
    }
    ctx.font = `700 ${h * 0.24}px ${HEAD_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = R;
    ctx.fillText('AI', w / 2, h * 0.52);
  },
  plus(ctx, w, h) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.3);
    ctx.lineTo(w * 0.5, h * 0.7);
    ctx.moveTo(w * 0.3, h * 0.5);
    ctx.lineTo(w * 0.7, h * 0.5);
    ctx.stroke();
  },
  browser(ctx, w, h) {
    rr(ctx, w * 0.08, h * 0.16, w * 0.84, h * 0.68, h * 0.08);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.34);
    ctx.lineTo(w * 0.92, h * 0.34);
    ctx.stroke();
  },
  server(ctx, w, h) {
    for (let i = 0; i < 3; i++) {
      rr(ctx, w * 0.14, h * (0.1 + i * 0.28), w * 0.72, h * 0.22, h * 0.05);
      both(ctx);
      ctx.beginPath();
      ctx.moveTo(w * 0.62, h * (0.21 + i * 0.28));
      ctx.lineTo(w * 0.76, h * (0.21 + i * 0.28));
      ctx.stroke();
    }
  },
  db(ctx, w, h) {
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.2, w * 0.32, h * 0.1, 0, 0, Math.PI * 2);
    ctx.moveTo(w * 0.18, h * 0.2);
    ctx.lineTo(w * 0.18, h * 0.8);
    ctx.ellipse(w / 2, h * 0.8, w * 0.32, h * 0.1, 0, Math.PI, 0, true);
    ctx.lineTo(w * 0.82, h * 0.2);
    both(ctx);
    for (const y of [0.4, 0.6]) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h * y, w * 0.32, h * 0.1, 0, 0, Math.PI);
      ctx.stroke();
    }
  },
  cache(ctx, w, h) {
    rr(ctx, w * 0.14, h * 0.14, w * 0.72, h * 0.72, w * 0.12);
    both(ctx);
    bolt(ctx, w / 2, h / 2, h * 0.62);
    ctx.stroke();
  },
  disk(ctx, w, h) {
    rr(ctx, w * 0.12, h * 0.2, w * 0.76, h * 0.6, h * 0.1);
    both(ctx);
    ctx.beginPath();
    ctx.arc(w * 0.38, h * 0.5, h * 0.17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.64, h * 0.62);
    ctx.lineTo(w * 0.78, h * 0.62);
    ctx.stroke();
  },
  key(ctx, w, h) {
    ctx.beginPath();
    ctx.arc(w * 0.32, h * 0.5, h * 0.2, 0, Math.PI * 2);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.5);
    ctx.lineTo(w * 0.9, h * 0.5);
    ctx.moveTo(w * 0.78, h * 0.5);
    ctx.lineTo(w * 0.78, h * 0.66);
    ctx.moveTo(w * 0.68, h * 0.5);
    ctx.lineTo(w * 0.68, h * 0.62);
    ctx.stroke();
  },
  lock(ctx, w, h) {
    rr(ctx, w * 0.2, h * 0.44, w * 0.6, h * 0.46, w * 0.08);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.44);
    ctx.lineTo(w * 0.32, h * 0.32);
    ctx.arc(w * 0.5, h * 0.32, w * 0.18, Math.PI, 0);
    ctx.lineTo(w * 0.68, h * 0.44);
    ctx.stroke();
  },
  shield(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.06);
    ctx.lineTo(w * 0.86, h * 0.18);
    ctx.lineTo(w * 0.82, h * 0.52);
    ctx.quadraticCurveTo(w * 0.76, h * 0.82, w * 0.5, h * 0.95);
    ctx.quadraticCurveTo(w * 0.24, h * 0.82, w * 0.18, h * 0.52);
    ctx.lineTo(w * 0.14, h * 0.18);
    ctx.closePath();
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.5);
    ctx.lineTo(w * 0.46, h * 0.62);
    ctx.lineTo(w * 0.68, h * 0.38);
    ctx.stroke();
  },
  mail(ctx, w, h) {
    rr(ctx, w * 0.1, h * 0.22, w * 0.8, h * 0.56, h * 0.06);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.24);
    ctx.lineTo(w * 0.5, h * 0.54);
    ctx.lineTo(w * 0.9, h * 0.24);
    ctx.stroke();
  },
  note(ctx, w, h) {
    rr(ctx, w * 0.2, h * 0.08, w * 0.6, h * 0.84, w * 0.06);
    both(ctx);
    for (const [y, l] of [[0.3, 0.38], [0.46, 0.3], [0.62, 0.36]]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.31, h * y);
      ctx.lineTo(w * (0.31 + l), h * y);
      ctx.stroke();
    }
  },
  kanban(ctx, w, h) {
    rr(ctx, w * 0.06, h * 0.12, w * 0.88, h * 0.76, h * 0.08);
    both(ctx);
    for (const x of [0.36, 0.64]) {
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.12);
      ctx.lineTo(w * x, h * 0.88);
      ctx.stroke();
    }
    ctx.fillStyle = R;
    for (const [x, y] of [[0.13, 0.22], [0.13, 0.42], [0.41, 0.22], [0.69, 0.22], [0.69, 0.42], [0.69, 0.62]]) ctx.fillRect(w * x, h * y, w * 0.18, h * 0.12);
  },
  person(ctx, w, h) {
    personPath(ctx, w / 2, h * 0.03, h * 0.97);
  },
  can(ctx, w, h) {
    rr(ctx, w * 0.16, h * 0.1, w * 0.68, h * 0.82, w * 0.14);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.2);
    ctx.lineTo(w * 0.78, h * 0.2);
    ctx.stroke();
    bolt(ctx, w / 2, h * 0.56, h * 0.42);
    ctx.stroke();
  },
  box(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.1);
    ctx.lineTo(w * 0.9, h * 0.3);
    ctx.lineTo(w * 0.9, h * 0.72);
    ctx.lineTo(w * 0.5, h * 0.92);
    ctx.lineTo(w * 0.1, h * 0.72);
    ctx.lineTo(w * 0.1, h * 0.3);
    ctx.closePath();
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.3);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.9, h * 0.3);
    ctx.moveTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.92);
    ctx.stroke();
  },
  clock(ctx, w, h) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.24);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.68, h * 0.62);
    ctx.stroke();
  },
  thought(ctx, w, h) {
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.4, w * 0.4, h * 0.34, 0, 0, Math.PI * 2);
    both(ctx);
    for (const [x, y, r] of [[0.18, 0.84, 0.06], [0.08, 0.96, 0.035]]) {
      ctx.beginPath();
      ctx.arc(w * x, h * y, w * r, 0, Math.PI * 2);
      both(ctx);
    }
  },
  truck(ctx, w, h) {
    rr(ctx, w * 0.03, h * 0.12, w * 0.6, h * 0.6, h * 0.04);
    both(ctx);
    ctx.save();
    ctx.lineWidth *= 0.7;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.strokeRect(w * (0.08 + i * 0.18), h * (0.2 + j * 0.25), w * 0.14, h * 0.2);
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(w * 0.66, h * 0.72);
    ctx.lineTo(w * 0.66, h * 0.3);
    ctx.lineTo(w * 0.84, h * 0.3);
    ctx.lineTo(w * 0.96, h * 0.5);
    ctx.lineTo(w * 0.96, h * 0.72);
    ctx.closePath();
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.37);
    ctx.lineTo(w * 0.82, h * 0.37);
    ctx.lineTo(w * 0.9, h * 0.5);
    ctx.lineTo(w * 0.72, h * 0.5);
    ctx.closePath();
    ctx.stroke();
    for (const x of [0.18, 0.46, 0.82]) {
      ctx.beginPath();
      ctx.arc(w * x, h * 0.8, h * 0.11, 0, Math.PI * 2);
      both(ctx);
    }
  },
  warehouse(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.42);
    ctx.lineTo(w * 0.5, h * 0.08);
    ctx.lineTo(w * 0.96, h * 0.42);
    ctx.stroke();
    rr(ctx, w * 0.1, h * 0.38, w * 0.8, h * 0.56, 4);
    both(ctx);
    ctx.strokeRect(w * 0.3, h * 0.56, w * 0.4, h * 0.38);
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * (0.56 + i * 0.076));
      ctx.lineTo(w * 0.7, h * (0.56 + i * 0.076));
      ctx.stroke();
    }
  },
  store(ctx, w, h) {
    rr(ctx, w * 0.06, h * 0.36, w * 0.88, h * 0.58, 4);
    both(ctx);
    rr(ctx, w * 0.22, h * 0.04, w * 0.56, h * 0.22, h * 0.04);
    both(ctx);
    ctx.font = `800 ${h * 0.15}px ${HEAD_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = R;
    ctx.fillText('SHOP', w / 2, h * 0.155);
    // awning
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.36);
    for (let i = 0; i < 8; i++) ctx.arc(w * (0.04 + (i + 0.5) * 0.115), h * 0.36, w * 0.0575, Math.PI, 0, true);
    ctx.stroke();
    ctx.strokeRect(w * 0.42, h * 0.58, w * 0.16, h * 0.36);
    ctx.strokeRect(w * 0.12, h * 0.52, w * 0.24, h * 0.24);
    ctx.strokeRect(w * 0.64, h * 0.52, w * 0.24, h * 0.24);
  },
  register(ctx, w, h) {
    rr(ctx, w * 0.05, h * 0.52, w * 0.9, h * 0.42, h * 0.05);
    both(ctx);
    rr(ctx, w * 0.56, h * 0.06, w * 0.32, h * 0.26, h * 0.04);
    both(ctx);
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.32);
    ctx.lineTo(w * 0.72, h * 0.52);
    ctx.moveTo(w * 0.1, h * 0.62);
    ctx.lineTo(w * 0.48, h * 0.62);
    ctx.stroke();
  },
  shelf(ctx, w, h) {
    ctx.strokeRect(w * 0.02, h * 0.02, w * 0.96, h * 0.96);
    ctx.fillStyle = G;
    ctx.fillRect(w * 0.02, h * 0.02, w * 0.96, h * 0.96);
    ctx.fillStyle = R;
    for (const y of [0.33, 0.64, 0.95]) ctx.fillRect(w * 0.02, h * y - 3, w * 0.96, 6);
  },
};

// A glyph as a label mesh: `line` glows (scaled past 1 so it blooms), `fill` stays dim.
export function makeGlyph(name, w, h, line, fill, glow = 1.35, seed = 0.5) {
  const g = makeLabel(
    w,
    h,
    (ctx) => {
      prep(ctx, Math.min(w, h));
      GLYPHS[name](ctx, w, h);
    },
    line,
    fill,
    seed
  );
  g.mat.uniforms.uColA.value.multiplyScalar(glow);
  return g;
}
