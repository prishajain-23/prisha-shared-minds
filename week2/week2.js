// week2.js — vanilla JS mic recorder + playback
// This script builds the UI, handles recording, and renders playback—no libraries.

(function () {
  // --- Basic feature checks -------------------------------------------------
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.body.innerHTML =
      '<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">' +
      '<div><h1>Mic recording not supported</h1><p>Your browser does not support <code>getUserMedia</code>. Try the latest Chrome, Edge, or Safari.</p></div>' +
      '</div>';
    return;
  }

  // --- Inject a tiny stylesheet so the page looks decent --------------------
  const style = document.createElement('style');
  style.textContent = `
    :root { --bg: #111; --fg: #fff; --muted: #aaa; --accent: #ff8866; --accent2: #66d1ff; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
    .panel { max-width: 720px; width: 100%; display: grid; gap: 20px; justify-items: center; }
    .title { font-size: clamp(22px, 3vw, 28px); font-weight: 600; }
    .status { color: var(--muted); font-size: 14px; }
    .btn {
      width: 140px; height: 140px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.2); cursor: pointer; outline: none;
      background: white; color: black; display: flex; align-items: center; justify-content: center;
      box-shadow: none;
      transition: transform .08s ease, filter .2s ease, box-shadow .3s ease; user-select: none;
      padding: 0;
    }
    .btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
    .btn:active { transform: translateY(1px) scale(0.98); }
    .btn.rec { box-shadow: 0 0 20px rgba(0,0,0,0.5); }

    .takes { width: 100%; display: grid; gap: 14px; }
    .take { display: grid; gap: 8px; padding: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; }
    .row { display: flex; align-items: center; gap: 12px; justify-content: space-between; flex-wrap: wrap; }
    audio { width: 100%; height: 38px; }
    .link { color: #9bd1ff; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .badge { padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,0.08); color: var(--muted); font-size: 12px; }

    .row.throbber {
      justify-content: flex-start;
      gap: 10px;
      font-size: 14px;
      color: var(--muted);
      width: 100%;
      padding-left: 10px;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--muted);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .hidden {
      display: none !important;
    }
    .result {
      background: rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      color: var(--fg);
      white-space: pre-wrap;
      margin-top: 6px;
      font-family: monospace, monospace;
    }
  `;
  document.head.appendChild(style);

  // --- Build DOM ------------------------------------------------------------
  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  const panel = document.createElement('div');
  panel.className = 'panel';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = '';

  const status = document.createElement('div');
  status.className = 'status';
  status.textContent = 'Click to start recording';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', 'Record microphone');

  // Insert inline SVG microphone icon inside the button
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zm-5 8a7 7 0 0 0 7-7h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 7 7z"/></svg>`;

  // Transcription throbber row (hidden initially)
  const transcribeRow = document.createElement('div');
  transcribeRow.className = 'row throbber hidden';
  const transcribeSpinner = document.createElement('div');
  transcribeSpinner.className = 'spinner';
  const transcribeLabel = document.createElement('span');
  transcribeLabel.textContent = 'Uploading for transcription…';
  transcribeRow.append(transcribeSpinner, transcribeLabel);

  // Distortion throbber row (hidden initially)
  const distortRow = document.createElement('div');
  distortRow.className = 'row throbber hidden';
  const distortSpinner = document.createElement('div');
  distortSpinner.className = 'spinner';
  const distortLabel = document.createElement('span');
  distortLabel.textContent = 'Distorting text…';
  distortRow.append(distortSpinner, distortLabel);

  const takes = document.createElement('div');
  takes.className = 'takes';

  panel.append(title, btn, status, transcribeRow, distortRow, takes);
  wrap.append(panel);
  document.body.appendChild(wrap);

  // --- Recording state ------------------------------------------------------
  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let takeCount = 0;

  // Decide the best mime type the browser supports
  const pickMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  };

  const preferredMime = pickMimeType();

  async function startRecording() {
    btn.disabled = true;
    status.textContent = 'Requesting microphone access…';
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = preferredMime ? { mimeType: preferredMime } : undefined;
      mediaRecorder = new MediaRecorder(mediaStream, options);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: preferredMime || 'audio/webm' });
        renderTake(blob);
        // Stop the actual hardware tracks to free the mic light
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
        mediaRecorder = null;
        btn.classList.remove('rec');
        btn.setAttribute('aria-pressed', 'false');
        status.textContent = 'Recording saved. Click to record again.';
      };

      mediaRecorder.start();
      btn.classList.add('rec');
      btn.setAttribute('aria-pressed', 'true');
      status.textContent = 'Recording… (click to stop)';
    } catch (err) {
      console.error(err);
      status.textContent = 'Microphone permission denied or unavailable.';
    } finally {
      btn.disabled = false;
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      status.textContent = 'Finishing…';
      mediaRecorder.stop();
    }
  }

  function renderTake(blob) {
    takeCount += 1;
    const url = URL.createObjectURL(blob);

    const take = document.createElement('div');
    take.className = 'take';

    const row = document.createElement('div');
    row.className = 'row';

    const tag = document.createElement('span');
    tag.className = 'badge';
    const now = new Date();
    tag.textContent = `Take ${takeCount} • ${now.toLocaleTimeString()} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

    const dl = document.createElement('a');
    dl.className = 'link';
    const ext = (blob.type.includes('ogg') ? 'ogg' : 'webm');
    dl.href = url;
    dl.download = `recording-take-${takeCount}.${ext}`;
    dl.textContent = 'Download';

    row.append(tag, dl);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;

    take.append(row, audio);
    takes.prepend(take);

    // Auto-play the new take to confirm it worked (requires user gesture on iOS; this click flow satisfies it)
    audio.play().catch(() => {/* ignore autoplay restrictions */});

    // Async transcription and distortion flow
    (async () => {
      try {
        const api = await import('./api.js');

        // Show transcription throbber
        transcribeRow.classList.remove('hidden');
        status.textContent = 'Uploading for transcription…';
        const transcript = await api.transcribeBlob(blob);
        transcribeRow.classList.add('hidden');

        // Show distortion throbber
        distortRow.classList.remove('hidden');
        status.textContent = 'Distorting text…';
        const distorted = await api.distortText(transcript, 'anxious, chopped, reverby');
        distortRow.classList.add('hidden');

        // Append transcript and distorted text results
        const transcriptDiv = document.createElement('div');
        transcriptDiv.className = 'result';
        transcriptDiv.textContent = `Transcript:\n${transcript}`;

        const distortedDiv = document.createElement('div');
        distortedDiv.className = 'result';
        distortedDiv.textContent = `Distorted:\n${distorted}`;

        take.append(transcriptDiv, distortedDiv);

        status.textContent = 'Recording saved. Click to record again.';
      } catch (err) {
        console.error('Error during transcription/distortion:', err);
        transcribeRow.classList.add('hidden');
        distortRow.classList.add('hidden');
        status.textContent = 'Error during transcription or distortion.';
      }
    })();
  }

  // Button behavior: toggle between start/stop
  btn.addEventListener('click', () => {
    if (!mediaRecorder) {
      startRecording();
    } else if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    }
  });

  // Optional: spacebar toggles too
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      btn.click();
    }
  });
})();
