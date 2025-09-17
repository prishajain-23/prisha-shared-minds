// ITP/IMA Replicate Proxy client (no backend needed)
// Docs summary: POST JSON to
//   https://itp-ima-replicate-proxy.web.app/api/create_n_get
// with shape { model, input, fieldToConvertBase64ToURL?, fileFormat? }
// If you include an Authorization: Bearer <token> header (NYU auth token),
// you get larger quotas. Token can be blank.

import { REPLICATE_TOKEN } from "./token.js";

const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
// Use the same variable name as the class example
const url = PROXY_URL;

function extFromMime(mime = "") {
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("m4a")) return ".m4a";
  if (mime.includes("mp3")) return ".mp3";
  return ".webm"; // typical MediaRecorder default in Chrome
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// --- WAV conversion helpers (proxy accepts only png, jpg, wav) --------------
async function blobToArrayBuffer(blob) {
  return await blob.arrayBuffer();
}

function decodeAudioData(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuffer, resolve, reject);
  });
}

function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);       // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);        // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);       // BitsPerSample

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel data with proper rounding/clamping
  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(audioBuffer.getChannelData(ch));
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = channels[ch][i];
      // clamp to [-1, 1]
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      // scale to 16-bit signed int
      const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return buffer;
}

async function convertToWavBlob(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const sourceBuffer = await decodeCtx.decodeAudioData(arrayBuffer);

    // Downmix to mono and resample to 16 kHz (widely accepted for STT)
    const targetRate = 16000;
    const length = Math.ceil(sourceBuffer.duration * targetRate);
    const offline = new OfflineAudioContext(1, length, targetRate);

    const src = offline.createBufferSource();
    src.buffer = sourceBuffer;
    src.connect(offline.destination);
    src.start(0);

    const rendered = await offline.startRendering();
    const wavBuffer = audioBufferToWav(rendered);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    if (decodeCtx.close) { try { await decodeCtx.close(); } catch (_) {} }
  }
}

async function ensureWavDataUrl(blob) {
  if (blob.type && blob.type.includes('wav')) {
    console.log('Blob already WAV; converting to data URL');
    return await blobToDataURL(blob);
  }
  console.log(`Converting ${blob.type || 'unknown'} (${blob.size} bytes) to WAV…`);
  const wavBlob = await convertToWavBlob(blob);
  console.log(`WAV size: ${wavBlob.size} bytes`);
  return await blobToDataURL(wavBlob);
}

async function postToProxy(payload) {
  // Mirror the example: log and use Accept header; no Authorization header here.
  console.log("Making a Fetch Request", payload);
  const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('itp-ima-replicate-proxy-ok') : null;
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  };
  const raw_response = await fetch(url, options);
  if (!raw_response.ok) {
    const text = await raw_response.text().catch(() => "");
    throw new Error(`Proxy request failed: ${raw_response.status} ${text}`);
  }
  const json = await raw_response.json();
  console.log("json_response", json);
  return json;
}

// Helper to ensure data URL has audio/wav MIME prefix
function forceWavMime(dataUrl) {
  if (typeof dataUrl !== 'string') return dataUrl;
  const i = dataUrl.indexOf(',');
  if (i === -1) return dataUrl;
  return 'data:audio/wav;base64,' + dataUrl.slice(i + 1);
}

// Transcribe an audio Blob using a Whisper-like model on Replicate.
// options: { version?: string, audioField?: string }
export async function transcribeBlob(blob, options = {}) {
  const { version = "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c", audioField = "audio" } = options;

  console.log(`Original blob type: ${blob.type}, size: ${blob.size}`);

  const dataUrl = await ensureWavDataUrl(blob);
  const wavDataUrl = forceWavMime(dataUrl);
  console.log('WAV data URL prefix:', wavDataUrl.slice(0, 50), '… sending base64 bytes only');
  const base64Only = wavDataUrl.includes(',') ? wavDataUrl.split(',')[1] : wavDataUrl;
  const fileFormat = 'wav';

  let payload = {
    version,
    fieldToConvertBase64ToURL: audioField,
    fileFormat,
    input: { [audioField]: base64Only },
  };

  try {
    document.body.style.cursor = "progress";
    console.log('Posting to proxy (initial):', { version, field: audioField, fileFormat });
    const prediction = await postToProxy(payload);
    console.log(`Model run completed: ${version}`);
    const out = prediction?.output;
    if (!out) return "";
    if (typeof out === "string") return out;
    if (typeof out?.text === "string") return out.text;
    if (Array.isArray(out)) return out.join("");
    try { return JSON.stringify(out); } catch { return String(out); }
  } catch (err) {
    const msg = String(err && err.message || err);
    if (msg.includes('only works for png, jpg, and wav')) {
      console.warn('Proxy rejected first payload; retrying with audio field name and wav');
      const audioFieldFallback = 'audio';
      payload = {
        version,
        fieldToConvertBase64ToURL: audioFieldFallback,
        fileFormat,
        input: { [audioFieldFallback]: base64Only },
      };
      console.log('Posting to proxy (fallback):', { version, field: 'audio', fileFormat });
      const prediction = await postToProxy(payload);
      console.log(`Model run completed (fallback): ${version}`);
      const out = prediction?.output;
      if (!out) return "";
      if (typeof out === "string") return out;
      if (typeof out?.text === "string") return out.text;
      if (Array.isArray(out)) return out.join("");
      try { return JSON.stringify(out); } catch { return String(out); }
    }
    throw err;
  } finally {
    document.body.style.cursor = "auto";
  }
}

// Distort text with an instruction-tuned LLM.
// options: { model?: string, inputKey?: string }
export async function distortText(text, style = "hostile, mean-spirited, mocking, cruel, like it comes from a bad person", options = {}) {
  const { model = "openai/gpt-5", inputKey = "prompt" } = options;

  const prompt = (
    `You are a distortion engine. Rewrite the TEXT so it comes across as if spoken by a *bad person*—` +
    `mean-spirited, mocking, cruel, and antagonistic. Keep it sharp, cutting, and hostile in tone, while still readable. ` +
    `Do not include threats of violence, gore, or slurs. Output only the rewritten text.\n` +
    `\nSTYLE: ${style}` +
    `\nTEXT:\n${text}`
  );

  const payload = {
    model,
    input: { [inputKey]: prompt },
  };

  document.body.style.cursor = "progress";
  try {
    const prediction = await postToProxy(payload);
    console.log(`Model run completed: ${model}`);
    const out = prediction?.output;
    if (!out) return "";
    if (typeof out === "string") return out.trim();
    if (Array.isArray(out)) return out.join("").trim();
    if (typeof out?.text === "string") return out.text.trim();
    try { return JSON.stringify(out); } catch { return String(out); }
  } finally {
    document.body.style.cursor = "auto";
  }
}