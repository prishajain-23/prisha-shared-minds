// week1.js — Web of Bubbles (vanilla JS)
// Click to add a bubble with the next thought from the array.
// Bubbles connect with lines if they are close, forming a web.

(() => {
  // ====== Config ======
  // Edit this list to change button labels, files, and colors
  const soundButtons = [
    { label: 'life is beautiful',     file: 'good-days.mp3',     color: '#6acdffff' },
    { label: 'bad b*tch (feminine)', file: 'nissan-altima.mp3', color: '#ff49e1ff' },
    { label: 'bad b*tch (masculine)',        file: 'commas.mp3',        color: '#642a2aff' },
    { label: 'spiritual',  file: 'organ-chord.mp3',  color: '#7cac80ff' },
    { label: 'sad',     file: 'seigfried.mp3',     color: '#EDEDED' },
    { label: 'sadder',           file: 'ivy.mp3',           color: '#3f3945ff' },
    { label: 'lalalala',  file: 'weird-fishes.mp3',  color: '#ffd467ff' },
  ];
  const thoughts = [
    "what's happening",
    "what was i just saying",
    "fix your posture",
    "i'm hungry",
    "my stomach hurts",
    "my parents sacrificed so much for me",
    "what does it mean to love",
    "how can i bring down the regime",
    "there are no ethical billionaires",
    "should i smoke weed right now",
     "i have so much love in my life",
     "the real miracle is just being alive",
    "i can't deal with this shit"
  ];
  const maxRadius = 60; // px
  const minRadius = 28; // px
// not necessary anymore:
//   const linkDist = 180; // px — distance threshold to draw a line
  const lineWidth = 1.2; // px
  const bgColor = "#ffffff"; // start blank/white
  const lineColor = "rgba(0,0,0,0.25)";
  const bubbleFill = "#fff";
  const bubbleStroke = "#111";
  const fontFamily = "-apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

  // ====== Canvas bootstrap ======
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.body.style.margin = "0";
  document.body.style.background = bgColor; // blank start
  document.body.appendChild(canvas);

  // ====== UI: left-side sound buttons ======
  const soundDock = document.createElement('div');
  Object.assign(soundDock.style, {
    position: 'fixed',
    top: '16px',
    left: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: '20'
  });

  // Preload audio and create buttons
  let currentAudio = null;
  soundButtons.forEach((item) => {
    const audio = new Audio(`sounds/${item.file}`);
    item._audio = audio; // store reference for later

    const btn = document.createElement('button');
    btn.textContent = item.label;
    Object.assign(btn.style, {
      border: '1px solid #111',
      background: '#fff',
      color: '#111',
      padding: '8px 12px',
      borderRadius: '9999px',
      cursor: 'pointer',
      fontSize: '13px',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 6px rgba(0,0,0,0.08)'
    });

    btn.addEventListener('click', () => {
      // Change background color
      document.body.style.background = item.color;

      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      currentAudio = item._audio;

      // Play selected audio
      // NOTE: Browser requires a user gesture (the click) to start audio, so this is allowed.
      currentAudio.play().catch(() => { /* ignore play() promise errors */ });
    });

    soundDock.appendChild(btn);
  });
  document.body.appendChild(soundDock);

  // ====== UI: input + send + random ======
  const bar = document.createElement('div');
  const input = document.createElement('input');
  const sendBtn = document.createElement('button');
  const randomBtn = document.createElement('button');

  Object.assign(bar.style, {
    position: 'fixed',
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ddd',
    borderRadius: '9999px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    zIndex: '10'
  });

  Object.assign(input, {
    placeholder: 'Add a thought…',
    type: 'text'
  });
  Object.assign(input.style, {
    width: '260px',
    border: 'none',
    outline: 'none',
    padding: '10px 14px',
    borderRadius: '9999px',
    fontSize: '14px',
    background: 'transparent'
  });

  sendBtn.textContent = 'Send';
  Object.assign(sendBtn.style, {
    border: '1px solid #111',
    background: '#111',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: '9999px',
    cursor: 'pointer'
  });

  randomBtn.textContent = 'Random';
  Object.assign(randomBtn.style, {
    border: '1px solid #111',
    background: '#fff',
    color: '#111',
    padding: '8px 14px',
    borderRadius: '9999px',
    cursor: 'pointer'
  });

  bar.appendChild(input);
  bar.appendChild(sendBtn);
  bar.appendChild(randomBtn);
  document.body.appendChild(bar);

  const dpi = () => (window.devicePixelRatio || 1);
  function resize() {
    const { innerWidth: w, innerHeight: h } = window;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * dpi());
    canvas.height = Math.floor(h * dpi());
    ctx.setTransform(dpi(), 0, 0, dpi(), 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ====== State ======
  const bubbles = []; // {x,y,r,text,vx,vy}
  let thoughtIndex = 0;

  // ====== Helpers ======
  function rand(min, max) { return Math.random() * (max - min) + min; }

  function addBubble(x, y, customText) {
    const r = rand(minRadius, maxRadius);
    const text = customText != null ? customText : thoughts[thoughtIndex % thoughts.length];
    if (customText == null) thoughtIndex++;
    const speed = 0.35; // gentle drift
    const angle = rand(0, Math.PI * 2);
    bubbles.push({
      x, y, r, text,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    });
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? " " : "") + words[n];
      const { width } = ctx.measureText(testLine);
      if (width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const totalHeight = lines.length * lineHeight;
    let yy = y - totalHeight / 2 + lineHeight * 0.8; // vertically center text
    lines.forEach((ln) => {
      ctx.fillText(ln, x, yy);
      yy += lineHeight;
    });
  }

  // ====== UI events ======
  function canvasCenter() {
    return { x: (canvas.width / dpi()) / 2, y: (canvas.height / dpi()) / 2 };
  }

  sendBtn.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) return;
    // add to thoughts list
    thoughts.push(value);
    // drop a bubble in the center with that text
    const { x, y } = canvasCenter();
    addBubble(x, y, value);
    input.value = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });

  randomBtn.addEventListener('click', () => {
    if (thoughts.length === 0) return;
    const randomText = thoughts[Math.floor(Math.random() * thoughts.length)];
    const x = rand(60, canvas.width / dpi() - 60);
    const y = rand(60, canvas.height / dpi() - 60);
    addBubble(x, y, randomText);
  });

  // ====== Interaction ======
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addBubble(x, y);
  });

  // ====== Animation loop ======
  function tick() {
    // clear (blank canvas each frame)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // update & bounds
    for (const b of bubbles) {
      b.x += b.vx;
      b.y += b.vy;
      // soft bounce off edges
      if (b.x - b.r < 0 && b.vx < 0) b.vx *= -1;
      if (b.x + b.r > canvas.width / dpi() && b.vx > 0) b.vx *= -1;
      if (b.y - b.r < 0 && b.vy < 0) b.vy *= -1;
      if (b.y + b.r > canvas.height / dpi() && b.vy > 0) b.vy *= -1;
    }

    // draw links (chain each bubble to the one before it)
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    for (let i = 1; i < bubbles.length; i++) {
      const a = bubbles[i - 1], b = bubbles[i];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // draw bubbles
    for (const b of bubbles) {
      // bubble circle
      ctx.fillStyle = bubbleFill;
      ctx.strokeStyle = bubbleStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // text inside
      ctx.fillStyle = "#111";
      ctx.font = `400 ${Math.max(12, Math.min(18, b.r * 0.45))}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const padding = 10;
      const maxTextWidth = b.r * 2 - padding * 2;
      wrapText(b.text, b.x, b.y, maxTextWidth, Math.max(14, b.r * 0.5 * 0.6));
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ====== Optional: keyboard helpers ======
  // Press 'r' to remove last bubble; 'c' to clear all.
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') bubbles.pop();
    if (e.key.toLowerCase() === 'c') bubbles.length = 0;
  });
})();
