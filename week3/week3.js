// week3.js — vanilla JS UI + letter→seed plumbing
// You can drop this file into a bare index.html that just includes <script src="week3.js"></script>
// The actual Replicate calls will live in api.js. This file will call a global
// async function `generateImageForLetter(letter, seed)` if it exists.

(function () {
  // ---------- DOM scaffolding (no HTML required) ----------
  document.addEventListener("DOMContentLoaded", () => {
    const app = el("div", { id: "app" });

    const title = el("h1", { class: "sm-title" }, "Shared Minds – Week 3");
    const sub = el(
      "p",
      { class: "sm-sub" },
      "Type some text. Each letter becomes a noise seed and then an image, telling different parts of the story of the word."
    );

    const authSection = el("div", { class: "sm-auth" });
    const authLabel = el("label", { for: "sm-auth-input" }, "Auth Token (optional - for higher quotas):");
    const authInput = el("input", {
      id: "sm-auth-input",
      type: "password",
      placeholder: "Paste your ITP/IMA proxy token here...",
      autocomplete: "off",
    });
    const authSave = el("button", { type: "button", id: "sm-auth-save" }, "Save");
    authSection.append(authLabel, authInput, authSave);

    const form = el("form", { id: "sm-form" });
    const input = el("input", {
      id: "sm-input",
      type: "text",
      placeholder: "Write anything… (press Enter)",
      autocomplete: "off",
    });
    const submit = el("button", { type: "submit", id: "sm-submit" }, "Render");
    form.append(input, submit);

    const hints = el(
      "div",
      { class: "sm-hints" },
      `Tip: Hold Shift+Enter to add a line break. Seeds are stable per letter + position.`
    );

    const gallery = el("div", { id: "sm-gallery", role: "list" });

    app.append(title, sub, authSection, form, hints, gallery);
    document.body.appendChild(app);

    // Lightweight styles so it looks decent without a CSS file
    function injectStyles(css) {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }

    // Load saved token on page load
    const savedToken = localStorage.getItem('itp-ima-replicate-proxy-ok');
    if (savedToken) {
      authInput.value = savedToken;
    }

    // Save token functionality
    authSave.addEventListener('click', () => {
      const token = authInput.value.trim();
      if (token) {
        localStorage.setItem('itp-ima-replicate-proxy-ok', token);
        console.log('✅ Auth token saved to localStorage');
        authSave.textContent = 'Saved!';
        setTimeout(() => {
          authSave.textContent = 'Save';
        }, 2000);
      } else {
        localStorage.removeItem('itp-ima-replicate-proxy-ok');
        console.log('🗑️ Auth token removed from localStorage');
        authSave.textContent = 'Cleared';
        setTimeout(() => {
          authSave.textContent = 'Save';
        }, 2000);
      }
    });

    injectStyles(`
      :root { --gap: 12px; --fg:#111; --bg:#fff; --muted:#666; }
      * { box-sizing: border-box; }
      body { margin:0; font: 16px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:var(--fg); background:var(--bg); }
      #app { max-width: 960px; margin: 40px auto; padding: 0 16px; }
      .sm-title { margin: 0 0 6px; font-size: 24px; }
      .sm-sub { margin: 0 0 18px; color: var(--muted); }
      .sm-auth { margin: 0 0 18px; padding: 12px; background: #f8f8f8; border-radius: 8px; border: 1px solid #e0e0e0; }
      .sm-auth label { display: block; font-size: 13px; margin-bottom: 6px; color: var(--muted); font-weight: 500; }
      .sm-auth input { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; margin-bottom: 8px; font-family: monospace; }
      .sm-auth button { padding: 6px 12px; font-size: 13px; border: 1px solid #007acc; background: #007acc; color: white; border-radius: 6px; cursor: pointer; }
      .sm-auth button:hover { background: #005a9e; }
      #sm-form { display:flex; gap: var(--gap); margin-bottom: 10px; }
      #sm-input { flex:1; padding: 12px 14px; border: 1px solid #ddd; border-radius: 10px; font-size:16px; }
      #sm-submit { padding: 12px 16px; border-radius:10px; border:1px solid #111; background:#111; color:#fff; cursor:pointer; }
      #sm-submit:hover { filter: brightness(0.95); }
      .sm-hints { font-size: 12px; color: var(--muted); margin-bottom: 18px; }
      #sm-gallery { display:grid; grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); gap: var(--gap); }
      .tile { position:relative; border:1px solid #e6e6e6; border-radius:12px; overflow:hidden; background:#fafafa; min-height: 140px; display:flex; align-items:center; justify-content:center; }
      .tile canvas, .tile img { width:100%; height:100%; object-fit:cover; display:block; }
      .badge { position:absolute; left:8px; top:8px; font-size:11px; background:rgba(255,255,255,0.85); padding:4px 6px; border-radius:6px; border:1px solid #ddd; }
      .caption { position:absolute; right:8px; bottom:8px; font-size:11px; background:rgba(255,255,255,0.85); padding:4px 6px; border-radius:6px; border:1px solid #ddd; }
      .loading { }
      @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
    `); 

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      const items = textToLetterSeeds(value);
      console.log(`🔤 Generated ${items.length} letter items:`, items);
      renderTiles(items, gallery);

      // Attempt image generation if api.js provided it
      console.log(`🔍 Checking if generateImageForLetter function is available:`, typeof window.generateImageForLetter);

      if (typeof window.generateImageForLetter === "function") {
        console.log(`✅ generateImageForLetter found! Starting image generation for ${items.length} letters...`);

        for (const item of items) {
          console.log(`🎯 Processing item:`, item);
          try {
            console.log(`📞 Calling generateImageForLetter for "${item.letter}" with seed ${item.seed}`);
            const url = await window.generateImageForLetter(item.letter, item.seed, value);
            console.log(`📥 Received result for "${item.letter}":`, url);

            if (url) {
              console.log(`🖼️  Replacing tile image for "${item.letter}" (${item.id}) with URL: ${url}`);
              replaceTileImage(item.id, url);
            } else {
              console.warn(`❌ No URL returned for letter "${item.letter}"`);
            }
          } catch (err) {
            console.error(`💥 Image generation failed for letter "${item.letter}":`, err);
            console.error("Item details:", item);
          }
        }
        console.log(`🏁 Completed image generation attempts for all ${items.length} letters`);
      } else {
        console.warn(`❌ generateImageForLetter function not found! Make sure api.js is loaded.`);
      }
    });
  });

  // ---------- Core logic ----------
  function textToLetterSeeds(text) {
    // Split on whitespace to preserve words, then break into letters
    const words = text.split(/\s+/).filter(Boolean);
    /** @type {{ id:string, wordIndex:number, letterIndex:number, letter:string, seed:number }[]} */
    const out = [];
    let globalIdx = 0;
    words.forEach((w, wi) => {
      Array.from(w).forEach((ch, li) => {
        // Seed is deterministic: hash(letter + positions) → 32-bit → [0,1)
        const seed = seededFloat(`${ch}|w${wi}|l${li}`);
        out.push({ id: `tile-${globalIdx++}`, wordIndex: wi, letterIndex: li, letter: ch, seed });
      });
    });
    return out;
  }

  function renderTiles(items, container) {
    // Clear and (re)render
    container.innerHTML = "";
    items.forEach((item) => {
      const tile = el("div", { class: "tile loading", id: item.id });
      const badge = el("span", { class: "badge" }, `“${item.letter}”`);
      const cap = el("span", { class: "caption" }, `seed ${item.seed.toFixed(4)}`);
      tile.append(badge, cap);

      // Draw a deterministic noise placeholder for this seed
      const c = noisePlaceholder(256, 256, item.seed);
      tile.append(c);

      container.appendChild(tile);
    });
  }

  function replaceTileImage(id, url) {
    const tile = document.getElementById(id);
    if (!tile) return;
    const img = new Image();
    img.alt = "generated";
    img.onload = () => {
      // Remove placeholder canvas
      const canv = tile.querySelector("canvas");
      if (canv) canv.remove();
      tile.classList.remove("loading");
    };
    img.src = url;
    tile.appendChild(img);
  }

  // ---------- Utilities ----------
  // Deterministic 0..1 float based on a string key
  function seededFloat(key) {
    const h = cyrb53(key);
    const rnd = mulberry32(h >>> 0);
    return rnd();
  }

  // cyrb53 string hash → 53-bit integer, returns Number (we only need lower 32 bits)
  // https://stackoverflow.com/a/52171480
  function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  // Mulberry32 PRNG: returns a function that yields 0..1
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Simple deterministic grayscale noise canvas for a seed
  function noisePlaceholder(w, h, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);

    const rnd = mulberry32(Math.floor(seed * 2 ** 32) >>> 0);

    // Cheap value-noise-ish pattern: sample a few octaves of grid noise
    function valueNoise(x, y) {
      // grid cell
      const gx = Math.floor(x / 8), gy = Math.floor(y / 8);
      const fx = (x % 8) / 8, fy = (y % 8) / 8;
      const v00 = hash2(gx, gy);
      const v10 = hash2(gx + 1, gy);
      const v01 = hash2(gx, gy + 1);
      const v11 = hash2(gx + 1, gy + 1);
      // bilerp
      const ix0 = lerp(v00, v10, fx);
      const ix1 = lerp(v01, v11, fx);
      return lerp(ix0, ix1, fy);
    }

    function hash2(x, y) {
      // 2D hash using deterministic bit operations instead of RNG
      let h = (x * 374761393) ^ (y * 668265263) ^ (Math.floor(seed * 2**32) >>> 0);
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    function lerp(a, b, t) {
      return a + (b - a) * (t * t * (3 - 2 * t)); // smoothstep
    }

    let p = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // two octaves for a bit of structure
        const n = 0.6 * valueNoise(x, y) + 0.4 * valueNoise(x * 0.5, y * 0.5);
        const v = Math.max(0, Math.min(255, Math.floor(n * 255)));
        img.data[p++] = v;
        img.data[p++] = v;
        img.data[p++] = v;
        img.data[p++] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // Element helper
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (children == null) return node;
    if (Array.isArray(children)) node.append(...children);
    else node.append(children);
    return node;
  }

  // Allow Shift+Enter newlines inside the input (turn input into pseudo-multiline)
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target && target.id === "sm-input" && e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      const pos = target.selectionStart || target.value.length;
      target.value = target.value.slice(0, pos) + "\n" + target.value.slice(pos);
      target.selectionStart = target.selectionEnd = pos + 1;
    }
  });

  // Expose a tiny hook so api.js can push images by id later if desired
  // window.pushImageToTile(id, url) → swaps the placeholder with the image
  window.pushImageToTile = replaceTileImage;
})();
