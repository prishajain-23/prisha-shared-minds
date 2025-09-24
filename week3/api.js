// ITP/IMA Replicate Proxy client for Week 3 - Letter to Image Generation
// Based on week2 api.js but adapted for image generation per letter + seed

import { REPLICATE_TOKEN } from "./token.js";

const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const url = PROXY_URL;

async function postToProxy(payload) {
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

// Generate an image for a single letter using its seed
// This is the function that week3.js expects to find
export async function generateImageForLetter(letter, seed, fullWord = '') {
  console.log(`🎯 generateImageForLetter called for letter: "${letter}", seed: ${seed}, fullWord: "${fullWord}"`);

  const model = "anotherjesse/streaming-sdxl:153204130f521e631a916ef067a0c5e09dcb8782bcfd90926b8e73763b161959";
  console.log(`📦 Using model: ${model}`);

  // Create a story-based prompt where each letter tells part of the word's story
  const prompt = fullWord
    ? `The letter "${letter}" telling a visual story about "${fullWord}" - artistic interpretation, symbolic representation, creative typography that captures the essence and meaning of ${fullWord}`
    : `The letter "${letter}" as an artistic, abstract representation, creative typography, modern design`;
  const integerSeed = Math.floor(seed * 4294967295);
  console.log(`✍️  Generated prompt: "${prompt}"`);
  console.log(`🎲 Converted seed ${seed} to integer seed: ${integerSeed}`);

  const payload = {
    version: model,
    input: {
      prompt: prompt,
      seed: integerSeed,
      width: 512,
      height: 512,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }
  };

  console.log(`📤 Payload prepared:`, JSON.stringify(payload, null, 2));

  document.body.style.cursor = "progress";
  try {
    console.log(`🚀 Starting API call to proxy for letter "${letter}"...`);
    const prediction = await postToProxy(payload);
    console.log(`✅ API call completed for "${letter}". Raw response:`, prediction);

    const output = prediction?.output;
    console.log(`🔍 Extracted output:`, output);

    if (!output) {
      console.warn(`❌ No output found for letter "${letter}"`);
      return null;
    }

    // Handle different output formats
    let imageUrl = null;
    if (typeof output === "string") {
      imageUrl = output;
      console.log(`🖼️  Output is string URL: ${imageUrl}`);
    } else if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0];
      console.log(`🖼️  Output is array, using first element: ${imageUrl}`);
    } else if (output.url) {
      imageUrl = output.url;
      console.log(`🖼️  Output has url property: ${imageUrl}`);
    } else if (output[0]) {
      imageUrl = output[0];
      console.log(`🖼️  Output has indexed property [0]: ${imageUrl}`);
    } else {
      console.warn(`❌ Could not extract image URL from output for letter "${letter}":`, output);
      return null;
    }

    console.log(`🎉 Successfully generated image for letter "${letter}": ${imageUrl}`);
    return imageUrl;
  } catch (err) {
    console.error(`💥 Image generation failed for letter "${letter}":`, err);
    console.error(`💥 Error details:`, {
      message: err.message,
      stack: err.stack,
      letter: letter,
      seed: seed,
      integerSeed: integerSeed
    });
    return null;
  } finally {
    document.body.style.cursor = "auto";
    console.log(`🏁 Finished processing letter "${letter}"`);
  }
}

// Make the function globally available for week3.js
window.generateImageForLetter = generateImageForLetter;