import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.module.min.js';
import { getEmbeddings } from './api.js';
import { saveThought, loadThoughts } from './firebase.js';

let camera, scene, renderer;
let videoElement;
let scrollTimeout;
let thoughtMeshes = []; // Store mesh references for updating
let thoughtPhysics = []; // Store physics properties for each thought
let activeRipples = []; // Track active ripple effects
let waterMaterial; // Water shader material
let waterRipples = []; // Water surface ripples (separate from thought ripples)
let lastCameraZ = 0; // Track camera position for flow effect
let waterParticles; // Particle system for water particles
let fishes = []; // Array of fish objects
let videoOverlay; // Video overlay mesh

let thoughts = []; // Array of {text, timestamp} objects

// Initialize the app
async function initApp() {
    initHTML();
    init3D();

    // Start with default thoughts
    const defaultDate = new Date(2025, 8, 9, 23, 0); // 9/9/2025 11PM (month is 0-indexed)
    thoughts = [
        { text: "what's happening", timestamp: defaultDate },
        { text: "what was i just saying", timestamp: defaultDate },
        { text: "fix your posture", timestamp: defaultDate },
        { text: "i'm hungry", timestamp: defaultDate },
        { text: "my stomach hurts", timestamp: defaultDate },
        { text: "my parents sacrificed so much for me", timestamp: defaultDate },
        { text: "what does it mean to love", timestamp: defaultDate },
        { text: "how can i bring down the regime", timestamp: defaultDate },
        { text: "there are no ethical billionaires", timestamp: defaultDate },
        { text: "should i smoke weed right now", timestamp: defaultDate },
        { text: "i have so much love in my life", timestamp: defaultDate },
        { text: "the real miracle is just being alive", timestamp: defaultDate },
        { text: "i can't deal with this shit", timestamp: defaultDate }
    ];

    // Load additional thoughts from Firestore
    try {
        const firestoreThoughts = await loadThoughts();
        if (firestoreThoughts.length > 0) {
            const additionalThoughts = firestoreThoughts.map(t => ({
                text: t.text,
                timestamp: t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp)
            }));
            // Add Firestore thoughts to the default ones
            thoughts = [...thoughts, ...additionalThoughts];
            console.log("Loaded", additionalThoughts.length, "additional thoughts from Firestore");
        }
    } catch (error) {
        console.error("Error loading thoughts from Firestore:", error);
    }

    console.log("Starting with", thoughts.length, "total thoughts");
    await initThoughtsVisualization();
}

console.log("Week9.js loaded, starting app...");
initApp();

function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black background
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    //this puts the three.js stuff in a particular div
    document.getElementById('THREEcontainer').appendChild(renderer.domElement);

    // createPanoVideo("water.mp4");

    moveCameraWithMouse();

    // Camera stays at origin, looking forward
    camera.position.set(0, 0, 0);

    // Add water environment
    createWaterEnvironment();
    createVideoOverlay();
    // createWaterParticles();
    createFishes();

    // Add fog for depth - adjusted range for larger water spheres
    scene.fog = new THREE.Fog(0x001a33, 100, 500);

    animate();
}

function createPanoVideo(filename) {
    let geometry = new THREE.SphereGeometry(1000, 60, 40);
    // invert the geometry on the x-axis so that all of the faces point inward
    geometry.scale(-1, 1, 1);
    videoElement = document.createElement('video');
    videoElement.crossOrigin = 'anonymous';
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.src = filename;
    videoElement.setAttribute('webkit-playsinline', 'webkit-playsinline');
    videoElement.pause(); // Start paused instead of playing
    let videoTexture = new THREE.VideoTexture(videoElement);
    var material = new THREE.MeshBasicMaterial({ map: videoTexture });
    let mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
}

function animate() {
    updatePhysics();
    updateWaterShader();
    // updateWaterParticles();
    updateFishes();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function initHTML() {
    const THREEcontainer = document.createElement("div");
    THREEcontainer.setAttribute("id", "THREEcontainer");
    document.body.appendChild(THREEcontainer);
    THREEcontainer.style.position = "absolute";
    THREEcontainer.style.top = "0";
    THREEcontainer.style.left = "0";
    THREEcontainer.style.width = "100%";
    THREEcontainer.style.height = "100%";
    THREEcontainer.style.zIndex = "1";

    // Create container for input and button
    const inputContainer = document.createElement("div");
    inputContainer.setAttribute("id", "inputContainer");
    document.body.appendChild(inputContainer);
    inputContainer.style.position = "fixed";
    inputContainer.style.bottom = "30px";
    inputContainer.style.left = "50%";
    inputContainer.style.transform = "translateX(-50%)";
    inputContainer.style.zIndex = "5";
    inputContainer.style.display = "flex";
    inputContainer.style.gap = "10px";
    inputContainer.style.alignItems = "center";

    const textInput = document.createElement("input");
    textInput.setAttribute("type", "text");
    textInput.setAttribute("id", "textInput");
    textInput.setAttribute("placeholder", "Share a thought...");
    inputContainer.appendChild(textInput);
    textInput.style.width = "400px";
    textInput.style.padding = "15px 20px";
    textInput.style.fontSize = "16px";
    textInput.style.fontFamily = "Roboto Mono, monospace";
    textInput.style.border = "2px solid rgba(255, 255, 255, 0.3)";
    textInput.style.borderRadius = "25px";
    textInput.style.backgroundColor = "rgba(0, 20, 40, 0.7)";
    textInput.style.color = "white";
    textInput.style.outline = "none";
    textInput.style.backdropFilter = "blur(10px)";
    textInput.style.transition = "all 0.3s ease";

    // Placeholder styling
    const style = document.createElement('style');
    style.textContent = `
        #textInput::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        #textInput:focus {
            border-color: rgba(79, 195, 247, 0.6);
            box-shadow: 0 0 20px rgba(79, 195, 247, 0.3);
        }
        #sendButton:hover {
            background-color: rgba(79, 195, 247, 0.9);
            transform: scale(1.05);
        }
        #sendButton:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);

    // Create send button
    const sendButton = document.createElement("button");
    sendButton.setAttribute("id", "sendButton");
    sendButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    `;
    inputContainer.appendChild(sendButton);
    sendButton.style.width = "50px";
    sendButton.style.height = "50px";
    sendButton.style.padding = "0";
    sendButton.style.border = "none";
    sendButton.style.borderRadius = "50%";
    sendButton.style.backgroundColor = "rgba(79, 195, 247, 0.7)";
    sendButton.style.color = "white";
    sendButton.style.cursor = "pointer";
    sendButton.style.display = "flex";
    sendButton.style.alignItems = "center";
    sendButton.style.justifyContent = "center";
    sendButton.style.transition = "all 0.3s ease";
    sendButton.style.backdropFilter = "blur(10px)";

    // Handle send function
    async function handleSend() {
        if (textInput.value.trim() !== "") {
            const newThought = textInput.value.trim();
            console.log("Adding new thought:", newThought);

            try {
                // Save to Firestore
                await saveThought(newThought);

                // Add to local thoughts array with current timestamp
                thoughts.push({
                    text: newThought,
                    timestamp: new Date()
                });

                // Clear input
                textInput.value = "";

                // Regenerate embeddings and reposition all thoughts
                await regenerateThoughtsVisualization();
            } catch (error) {
                console.error("Error saving thought:", error);
                alert("Failed to save thought. Please try again.");
            }
        }
    }

    // Event listeners
    textInput.addEventListener("keydown", async function (e) {
        if (e.key === "Enter") {
            await handleSend();
        }
    });

    sendButton.addEventListener("click", handleSend);

    window.addEventListener("dragover", function (e) {
        e.preventDefault();
    }, false);

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        for (let i = 0; i < files.length; i++) {
            if (!files[i].type.match("image")) continue;
            console.log("Dropped image file:", files[i]);

            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    let mouse = { x: e.clientX, y: e.clientY };
                    const pos = find3DCoornatesInFrontOfCamera(150 - camera.fov, mouse);
                    createNewImage(img, pos, files[i]);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(files[i]);
        }
    }, true);
}

function find3DCoornatesInFrontOfCamera(distance, mouse) {
    let vector = new THREE.Vector3();
    vector.set(
        (mouse.x / window.innerWidth) * 2 - 1,
        -(mouse.y / window.innerHeight) * 2 + 1,
        0
    );
    vector.unproject(camera);
    vector.multiplyScalar(distance);
    return vector;
}

function createNewImage(img, posInWorld, file) {
    console.log("Created New Image", posInWorld);
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var context = canvas.getContext("2d");
    context.drawImage(img, 0, 0);
    var fontSize = Math.max(12);
    context.font = fontSize + "pt Arial";
    context.textAlign = "center";
    context.fillStyle = "red";
    context.fillText(file.name, canvas.width / 2, canvas.height - 30);
    var textTexture = new THREE.Texture(canvas);
    textTexture.needsUpdate = true;
    var material = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
    var geo = new THREE.PlaneGeometry(canvas.width / canvas.width, canvas.height / canvas.width);
    var mesh = new THREE.Mesh(geo, material);

    mesh.position.x = posInWorld.x;
    mesh.position.y = posInWorld.y;
    mesh.position.z = posInWorld.z;

    console.log(posInWorld);
    mesh.lookAt(0, 0, 0);
    mesh.scale.set(10, 10, 10);
    scene.add(mesh);
}

function createNewText(text_msg, posInWorld) {
    console.log("Created New Text", posInWorld);
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    var fontSize = Math.max(camera.fov / 2, 72);
    context.font = fontSize + "pt Arial";
    context.textAlign = "center";
    context.fillStyle = "red";
    context.fillText(text_msg, canvas.width / 2, canvas.height / 2);
    var textTexture = new THREE.Texture(canvas);
    textTexture.needsUpdate = true;
    var material = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
    var geo = new THREE.PlaneGeometry(1, 1);
    var mesh = new THREE.Mesh(geo, material);

    mesh.position.x = posInWorld.x;
    mesh.position.y = posInWorld.y;
    mesh.position.z = posInWorld.z;

    console.log(posInWorld);
    mesh.lookAt(0, 0, 0);
    mesh.scale.set(10, 10, 10);
    scene.add(mesh);
}

/////MOUSE STUFF

let mouseDownX = 0, mouseDownY = 0;
let lon = -90, mouseDownLon = 0;
let lat = 0, mouseDownLat = 0;
let isUserInteracting = false;

function moveCameraWithMouse() {
    const div3D = document.getElementById('THREEcontainer');
    div3D.addEventListener('mousedown', div3DMouseDown, false);
    div3D.addEventListener('mousemove', div3DMouseMove, false);
    div3D.addEventListener('mouseup', div3DMouseUp, false);
    div3D.addEventListener('wheel', div3DMouseWheel, { passive: true });
    window.addEventListener('resize', onWindowResize, false);
    camera.target = new THREE.Vector3(0, 0, 0);
}

function div3DMouseDown(event) {
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    mouseDownLon = lon;
    mouseDownLat = lat;
    isUserInteracting = true;
}

function div3DMouseMove(event) {
    if (isUserInteracting) {
        lon = (mouseDownX - event.clientX) * 0.1 + mouseDownLon;
        lat = (event.clientY - mouseDownY) * 0.1 + mouseDownLat;
        computeCameraOrientation();
    }
}

function div3DMouseUp(event) {
    isUserInteracting = false;
}

function div3DMouseWheel(event) {
    // Move camera forward/backward on scroll
    const scrollSpeed = 2;
    const scrollDirection = event.deltaY > 0 ? 1 : -1;

    // Get the current camera direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Move camera along the direction it's looking
    camera.position.addScaledVector(direction, scrollDirection * scrollSpeed);

    // Create water ripple from scroll movement
    const rippleStrength = Math.abs(event.deltaY) * 0.001;
    addWaterRipple(
        camera.position.x,
        camera.position.y,
        camera.position.z,
        rippleStrength
    );

    console.log("Camera position:", camera.position);
}

function computeCameraOrientation() {
    lat = Math.max(-30, Math.min(30, lat));
    let phi = THREE.MathUtils.degToRad(90 - lat);
    let theta = THREE.MathUtils.degToRad(lon);
    camera.target.x = 100 * Math.sin(phi) * Math.cos(theta);
    camera.target.y = 100 * Math.cos(phi);
    camera.target.z = 100 * Math.sin(phi) * Math.sin(theta);
    camera.lookAt(camera.target);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    console.log('Resized');
}

/////THOUGHTS VISUALIZATION WITH UMAP

async function initThoughtsVisualization() {
    console.log("=== Starting thoughts visualization ===");
    await generateAndPositionThoughts();
}

async function regenerateThoughtsVisualization() {
    console.log("=== Regenerating thoughts visualization ===");

    // Store the position of the new thought for ripple effect
    const newThoughtIndex = thoughts.length - 1;

    // Remove all existing thought meshes from scene
    thoughtMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.map.dispose();
        mesh.material.dispose();
    });
    thoughtMeshes = [];
    thoughtPhysics = [];

    // Regenerate with new embeddings
    await generateAndPositionThoughts();

    // Create ripple effect from new thought position
    if (thoughtPhysics.length > 0 && newThoughtIndex < thoughtPhysics.length) {
        const newThoughtPos = thoughtPhysics[newThoughtIndex].basePosition;
        createRipple(newThoughtPos);
    }
}

async function generateAndPositionThoughts() {
    try {
        // Check if we have any thoughts to display
        if (thoughts.length === 0) {
            console.log("No thoughts to display yet");
            return;
        }

        console.log("Fetching embeddings for thoughts...");
        // Extract just the text for embeddings
        const thoughtTexts = thoughts.map(t => t.text);
        const embeddings = await getEmbeddings(thoughtTexts);
        console.log("Got embeddings:", embeddings);

        // Check if UMAP is available
        console.log("UMAP object:", window.UMAP);
        if (typeof UMAP === 'undefined') {
            console.error("UMAP is not defined! Library may not have loaded.");
            return;
        }

        // UMAP needs at least 2 points
        if (thoughts.length < 2) {
            console.log("Need at least 2 thoughts for UMAP, placing single thought at origin");
            createThoughtText(thoughts[0].text, thoughts[0].timestamp, new THREE.Vector3(0, 0, -50));
            return;
        }

        // Apply UMAP to reduce embeddings to 3D
        const umap = new window.UMAP.UMAP({
            nComponents: 3,
            nNeighbors: Math.min(5, thoughts.length - 1),
            minDist: 0.3,
            spread: 2.0
        });

        console.log("Fitting UMAP...");
        const umapEmbeddings = umap.fit(embeddings);
        console.log("UMAP embeddings:", umapEmbeddings);

        // Map UMAP coordinates directly to 3D positions
        // Z-depth is the primary representation from embeddings
        const positions = mapUMAPTo3DPositions(umapEmbeddings);

        console.log("3D positions:", positions);

        // Place each thought in 3D space
        thoughts.forEach((thought, i) => {
            const pos = positions[i];
            console.log(`Placing thought ${i}: "${thought.text}" at`, pos);
            createThoughtText(thought.text, thought.timestamp, pos);
        });

        console.log("Thoughts visualization complete!");

    } catch (error) {
        console.error("Error creating thoughts visualization:", error);
        console.error("Error stack:", error.stack);
    }
}

function mapUMAPTo3DPositions(umapEmbeddings) {
    // Find min/max for each dimension
    const mins = [Infinity, Infinity, Infinity];
    const maxs = [-Infinity, -Infinity, -Infinity];

    umapEmbeddings.forEach(pos => {
        for (let i = 0; i < 3; i++) {
            mins[i] = Math.min(mins[i], pos[i]);
            maxs[i] = Math.max(maxs[i], pos[i]);
        }
    });

    // Map UMAP coordinates to 3D space
    // X and Y: spread across viewport (normalized to -1 to 1, then scaled)
    // Z: depth into the scene (normalized and scaled to negative values)
    const xyScale = 40; // Horizontal/vertical spread
    const zScale = 80;  // Depth range
    const zOffset = -50; // Start distance from camera

    return umapEmbeddings.map(pos => {
        // Normalize each dimension to [0, 1]
        const normX = (pos[0] - mins[0]) / (maxs[0] - mins[0]);
        const normY = (pos[1] - mins[1]) / (maxs[1] - mins[1]);
        const normZ = (pos[2] - mins[2]) / (maxs[2] - mins[2]);

        // Map to 3D space:
        // X, Y: centered around 0, spread out
        // Z: negative values (further from camera)
        return new THREE.Vector3(
            (normX * 2 - 1) * xyScale,  // X: -xyScale to +xyScale
            (normY * 2 - 1) * xyScale,  // Y: -xyScale to +xyScale
            zOffset - (normZ * zScale)  // Z: zOffset to (zOffset - zScale)
        );
    });
}

function createThoughtText(text, timestamp, position) {
    console.log(`Creating thought "${text}" at position:`, position);

    // Format timestamp
    function formatTimestamp(date) {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
    }

    const formattedTime = formatTimestamp(timestamp);

    // Create canvas for text with alpha channel
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 300; // Increased height for timestamp
    const context = canvas.getContext("2d", { alpha: true });

    // Clear to fully transparent
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Main text
    context.font = "400 32pt Roboto Mono, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white";

    // Simple text wrapping for main text
    const maxWidth = 450;
    const words = text.split(' ');
    let line = '';
    let y = canvas.height / 2 - 30; // Shift up to make room for timestamp

    const lines = [];
    if (context.measureText(text).width <= maxWidth) {
        lines.push(text);
    } else {
        // Wrap to multiple lines
        for (let word of words) {
            const testLine = line + word + ' ';
            if (context.measureText(testLine).width > maxWidth && line !== '') {
                lines.push(line);
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
    }

    const lineHeight = 40;
    y = canvas.height / 2 - 30 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
        context.fillText(line.trim(), canvas.width / 2, y + i * lineHeight);
    });

    // Draw timestamp below main text
    context.font = "300 16pt Roboto Mono, monospace";
    context.fillStyle = "rgba(255, 255, 255, 0.6)"; // Slightly transparent
    const timestampY = y + (lines.length - 1) * lineHeight + 50;
    context.fillText(formattedTime, canvas.width / 2, timestampY);

    // Create texture and material
    const textTexture = new THREE.Texture(canvas);
    textTexture.needsUpdate = true;
    textTexture.premultiplyAlpha = false;
    const material = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthTest: true,
        alphaTest: 0.01
    });

    // Create mesh
    const geo = new THREE.PlaneGeometry(20, 10);
    const mesh = new THREE.Mesh(geo, material);

    mesh.position.copy(position);
    // Thoughts face the camera position (looking back toward origin)
    mesh.lookAt(camera.position);

    scene.add(mesh);
    thoughtMeshes.push(mesh); // Store reference for later removal

    // Initialize physics properties
    thoughtPhysics.push({
        mesh: mesh,
        basePosition: position.clone(), // UMAP anchor point
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            0  // No Z velocity
        ),
        mass: 1.0,
        rotationVelocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.002,
            (Math.random() - 0.5) * 0.002,
            0
        )
    });

    console.log("Thought mesh added to scene");
}

/////WATER ENVIRONMENT

function createWaterEnvironment() {
    // Water shader material
    waterMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            cameraZ: { value: 0.0 },
            scrollVelocity: { value: 0.0 },
            ripple1: { value: new THREE.Vector4(0, 0, 0, 0) }, // x, y, z, strength
            ripple2: { value: new THREE.Vector4(0, 0, 0, 0) },
            ripple3: { value: new THREE.Vector4(0, 0, 0, 0) },
            ripple4: { value: new THREE.Vector4(0, 0, 0, 0) },
            ripple5: { value: new THREE.Vector4(0, 0, 0, 0) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;

            void main() {
                vUv = uv;
                vPosition = position;
                vNormal = normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float cameraZ;
            uniform float scrollVelocity;
            uniform vec4 ripple1;
            uniform vec4 ripple2;
            uniform vec4 ripple3;
            uniform vec4 ripple4;
            uniform vec4 ripple5;

            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;

            // Noise function for organic patterns
            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            float smoothNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                float a = noise(i);
                float b = noise(i + vec2(1.0, 0.0));
                float c = noise(i + vec2(0.0, 1.0));
                float d = noise(i + vec2(1.0, 1.0));

                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for(int i = 0; i < 4; i++) {
                    value += amplitude * smoothNoise(p);
                    p *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
                // Flowing animation based on time and camera position
                vec2 flowUv = vUv * 3.0;
                flowUv.y += time * 0.05 + cameraZ * 0.01;
                flowUv.x += sin(time * 0.1 + vUv.y * 2.0) * 0.1;

                // Layered noise for organic water patterns
                float pattern1 = fbm(flowUv + time * 0.03);
                float pattern2 = fbm(flowUv * 1.5 - time * 0.02);
                float combined = (pattern1 + pattern2) * 0.5;

                // Add ripple effects
                float rippleEffect = 0.0;

                // Process each ripple
                if(ripple1.w > 0.0) {
                    float dist = length(vPosition.xy - ripple1.xy);
                    rippleEffect += sin(dist * 0.5 - time * 2.0) * ripple1.w * exp(-dist * 0.05);
                }
                if(ripple2.w > 0.0) {
                    float dist = length(vPosition.xy - ripple2.xy);
                    rippleEffect += sin(dist * 0.5 - time * 2.0) * ripple2.w * exp(-dist * 0.05);
                }
                if(ripple3.w > 0.0) {
                    float dist = length(vPosition.xy - ripple3.xy);
                    rippleEffect += sin(dist * 0.5 - time * 2.0) * ripple3.w * exp(-dist * 0.05);
                }
                if(ripple4.w > 0.0) {
                    float dist = length(vPosition.xy - ripple4.xy);
                    rippleEffect += sin(dist * 0.5 - time * 2.0) * ripple4.w * exp(-dist * 0.05);
                }
                if(ripple5.w > 0.0) {
                    float dist = length(vPosition.xy - ripple5.xy);
                    rippleEffect += sin(dist * 0.5 - time * 2.0) * ripple5.w * exp(-dist * 0.05);
                }

                // Water colors - high contrast gradient with multiple vibrant colors
                vec3 color1 = vec3(0.0, 0.05, 0.2);  // Very deep navy
                vec3 color2 = vec3(0.0, 0.6, 0.8);   // Vibrant turquoise
                vec3 color3 = vec3(0.3, 0.8, 1.0);   // Bright cyan
                vec3 color4 = vec3(0.0, 0.3, 0.6);   // Royal blue
                vec3 color5 = vec3(0.1, 0.4, 0.7);   // Ocean blue
                vec3 color6 = vec3(0.5, 0.9, 1.0);   // Light sky blue

                // Create more dramatic contrast with multiple layers
                float mixValue = combined + rippleEffect * 0.7;

                // Base mix between deep and bright
                vec3 waterColor = mix(color1, color2, mixValue);

                // Add variation with additional colors
                float noise1 = smoothNoise(flowUv * 0.5);
                float noise2 = smoothNoise(flowUv * 0.8 + time * 0.02);

                waterColor = mix(waterColor, color3, noise1 * 0.8);
                waterColor = mix(waterColor, color4, pattern1 * 0.5);
                waterColor = mix(waterColor, color5, pattern2 * 0.6);
                waterColor = mix(waterColor, color6, noise2 * 0.4);

                // Distance-based opacity (farther = more opaque for depth)
                float distFromCamera = length(vPosition - cameraPosition);
                float alpha = clamp(0.4 + distFromCamera * 0.007, 0.3, 0.8);

                gl_FragColor = vec4(waterColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false
    });

    // Create multiple large spheres at different scales for layered effect
    // Make them much larger to encompass full camera movement range
    const sphereGeometry1 = new THREE.SphereGeometry(500, 32, 32);
    const waterSphere1 = new THREE.Mesh(sphereGeometry1, waterMaterial);
    scene.add(waterSphere1);

    const sphereGeometry2 = new THREE.SphereGeometry(700, 32, 32);
    const waterSphere2 = new THREE.Mesh(sphereGeometry2, waterMaterial.clone());
    waterSphere2.material.uniforms.time = waterMaterial.uniforms.time;
    scene.add(waterSphere2);

    const sphereGeometry3 = new THREE.SphereGeometry(900, 32, 32);
    const waterSphere3 = new THREE.Mesh(sphereGeometry3, waterMaterial.clone());
    waterSphere3.material.uniforms.time = waterMaterial.uniforms.time;
    scene.add(waterSphere3);

    console.log("Water environment created");
}

function updateWaterShader() {
    if (!waterMaterial) return;

    // Update time
    waterMaterial.uniforms.time.value += 0.01;

    // Update camera Z for flow effect
    const cameraVelocity = camera.position.z - lastCameraZ;
    waterMaterial.uniforms.scrollVelocity.value = cameraVelocity;
    waterMaterial.uniforms.cameraZ.value = camera.position.z;
    lastCameraZ = camera.position.z;

    // Update water ripples from array (limit to 5 most recent)
    const rippleUniforms = [
        waterMaterial.uniforms.ripple1,
        waterMaterial.uniforms.ripple2,
        waterMaterial.uniforms.ripple3,
        waterMaterial.uniforms.ripple4,
        waterMaterial.uniforms.ripple5
    ];

    // Decay existing ripples
    waterRipples = waterRipples.map(r => ({ ...r, strength: r.strength * 0.95 }))
        .filter(r => r.strength > 0.01);

    // Update shader uniforms
    for (let i = 0; i < 5; i++) {
        if (i < waterRipples.length) {
            const r = waterRipples[i];
            rippleUniforms[i].value.set(r.x, r.y, r.z, r.strength);
        } else {
            rippleUniforms[i].value.set(0, 0, 0, 0);
        }
    }
}

function addWaterRipple(x, y, z, strength = 1.0) {
    waterRipples.push({ x, y, z, strength });
    // Keep only most recent 10
    if (waterRipples.length > 10) {
        waterRipples.shift();
    }
}

function createVideoOverlay() {
    // Create video element
    videoElement = document.createElement('video');
    videoElement.src = './water.mp4'; // Relative path
    // Remove crossOrigin for same-origin content
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.autoplay = true;

    // Start playing
    videoElement.play().catch(err => {
        console.log("Video autoplay failed, will play on user interaction:", err);
        // Try to play on first user interaction
        document.addEventListener('click', () => {
            videoElement.play();
        }, { once: true });
    });

    // Create video texture
    const videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // Create material with reduced opacity
    const videoMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture,
        transparent: true,
        opacity: 0.3, // Reduced opacity to see gradient underneath
        side: THREE.BackSide,
        depthWrite: false
    });

    // Create sphere geometry (slightly smaller than water gradient spheres)
    const videoGeometry = new THREE.SphereGeometry(400, 32, 32);
    videoOverlay = new THREE.Mesh(videoGeometry, videoMaterial);

    scene.add(videoOverlay);

    console.log("Video overlay created");
}

function createWaterParticles() {
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);

    // Initialize particle positions and properties
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Distribute particles in a large volume around the scene
        positions[i3] = (Math.random() - 0.5) * 400;     // x
        positions[i3 + 1] = (Math.random() - 0.5) * 400; // y
        positions[i3 + 2] = (Math.random() - 0.5) * 400; // z

        // Random initial velocities (slow drift)
        velocities[i3] = (Math.random() - 0.5) * 0.2;     // x velocity
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.2; // y velocity
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.2; // z velocity

        // Varying particle sizes
        sizes[i] = Math.random() * 3 + 1;

        // Varying opacities
        opacities[i] = Math.random() * 0.6 + 0.2;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    // Particle material with custom shader for variation
    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            pointTexture: { value: createParticleTexture() }
        },
        vertexShader: `
            attribute float size;
            attribute float opacity;
            varying float vOpacity;

            void main() {
                vOpacity = opacity;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying float vOpacity;

            void main() {
                vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                vec3 particleColor = vec3(0.5, 0.8, 1.0); // Light cyan particles
                gl_FragColor = vec4(particleColor, texColor.a * vOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    waterParticles = new THREE.Points(particleGeometry, particleMaterial);
    waterParticles.userData.velocities = velocities;
    scene.add(waterParticles);

    console.log("Water particles created");
}

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Create circular gradient for soft particles
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function updateWaterParticles() {
    if (!waterParticles) return;

    const positions = waterParticles.geometry.attributes.position.array;
    const velocities = waterParticles.userData.velocities;
    const particleCount = positions.length / 3;

    // Update particle material time
    waterParticles.material.uniforms.time.value += 0.01;

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Update positions with velocities
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];

        // Add gentle random drift
        positions[i3] += (Math.random() - 0.5) * 0.05;
        positions[i3 + 1] += (Math.random() - 0.5) * 0.05;
        positions[i3 + 2] += (Math.random() - 0.5) * 0.05;

        // Wrap particles around bounds (keep them in view)
        const bound = 200;
        if (Math.abs(positions[i3]) > bound) positions[i3] = -positions[i3];
        if (Math.abs(positions[i3 + 1]) > bound) positions[i3 + 1] = -positions[i3 + 1];
        if (Math.abs(positions[i3 + 2]) > bound) positions[i3 + 2] = -positions[i3 + 2];
    }

    waterParticles.geometry.attributes.position.needsUpdate = true;
}

function createFishes() {
    const fishCount = 20;

    for (let i = 0; i < fishCount; i++) {
        const fish = createFish();

        // Random starting position
        fish.mesh.position.set(
            (Math.random() - 0.5) * 300,
            (Math.random() - 0.5) * 300,
            (Math.random() - 0.5) * 300
        );

        // Random swimming path parameters
        fish.pathRadius = Math.random() * 50 + 30;
        fish.pathSpeed = Math.random() * 0.3 + 0.2;
        fish.pathPhase = Math.random() * Math.PI * 2;
        fish.verticalSpeed = Math.random() * 0.1 + 0.05;
        fish.verticalPhase = Math.random() * Math.PI * 2;

        scene.add(fish.mesh);
        fishes.push(fish);
    }

    console.log("Created", fishCount, "fishes");
}

function createFish() {
    // Muted, calm color palette for fish
    const fishColors = [
        { body: 0x8da9c4, tail: 0x6b8caf }, // Soft dusty blue
        { body: 0x9eb89f, tail: 0x7d9a7f }, // Muted sage green
        { body: 0xb8a99d, tail: 0x9a8a80 }, // Warm taupe
        { body: 0xa8b5c7, tail: 0x8a96a8 }, // Pale slate blue
        { body: 0xc4b5a0, tail: 0xa89985 }, // Soft sandy beige
        { body: 0x9eb3b8, tail: 0x7f979c }, // Muted teal-grey
        { body: 0xb8a8b5, tail: 0x9a8a96 }, // Dusty mauve
        { body: 0xa0b89e, tail: 0x849a82 }  // Pale moss green
    ];

    // Pick random color scheme
    const colorScheme = fishColors[Math.floor(Math.random() * fishColors.length)];

    // Create simple fish shape using geometry
    const fishGroup = new THREE.Group();

    // Body (ellipsoid)
    const bodyGeometry = new THREE.SphereGeometry(1, 8, 6);
    bodyGeometry.scale(2, 0.8, 0.6);
    const bodyMaterial = new THREE.MeshBasicMaterial({
        color: colorScheme.body,
        transparent: true,
        opacity: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    fishGroup.add(body);

    // Tail (triangle)
    const tailGeometry = new THREE.ConeGeometry(0.6, 1.5, 3);
    tailGeometry.rotateZ(Math.PI / 2);
    const tailMaterial = new THREE.MeshBasicMaterial({
        color: colorScheme.tail,
        transparent: true,
        opacity: 0.6
    });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(-2, 0, 0);
    fishGroup.add(tail);

    // Fins (small triangles)
    const finGeometry = new THREE.ConeGeometry(0.3, 0.8, 3);
    finGeometry.rotateZ(Math.PI / 2);
    const finMaterial = new THREE.MeshBasicMaterial({
        color: colorScheme.body,
        transparent: true,
        opacity: 0.5
    });

    const finTop = new THREE.Mesh(finGeometry, finMaterial);
    finTop.position.set(0, 0.8, 0);
    finTop.rotation.z = Math.PI / 4;
    fishGroup.add(finTop);

    const finSide1 = new THREE.Mesh(finGeometry, finMaterial.clone());
    finSide1.position.set(0.5, -0.3, 0.5);
    finSide1.rotation.y = Math.PI / 6;
    fishGroup.add(finSide1);

    const finSide2 = new THREE.Mesh(finGeometry, finMaterial.clone());
    finSide2.position.set(0.5, -0.3, -0.5);
    finSide2.rotation.y = -Math.PI / 6;
    fishGroup.add(finSide2);

    // Scale the whole fish
    fishGroup.scale.set(0.8, 0.8, 0.8);

    return {
        mesh: fishGroup,
        body: body,
        tail: tail,
        fins: [finTop, finSide1, finSide2],
        swimPhase: Math.random() * Math.PI * 2
    };
}

function updateFishes() {
    const time = Date.now() * 0.001;

    fishes.forEach((fish, index) => {
        // Circular swimming path with vertical oscillation
        const pathAngle = time * fish.pathSpeed + fish.pathPhase;
        const centerX = Math.sin(pathAngle * 0.3) * 100;
        const centerZ = Math.cos(pathAngle * 0.3) * 100;

        const x = centerX + Math.cos(pathAngle) * fish.pathRadius;
        const z = centerZ + Math.sin(pathAngle) * fish.pathRadius;
        const y = Math.sin(time * fish.verticalSpeed + fish.verticalPhase) * 30;

        fish.mesh.position.set(x, y, z);

        // Point fish in swimming direction
        const nextAngle = pathAngle + 0.1;
        const nextX = centerX + Math.cos(nextAngle) * fish.pathRadius;
        const nextZ = centerZ + Math.sin(nextAngle) * fish.pathRadius;
        fish.mesh.lookAt(nextX, y, nextZ);

        // Animate tail and fins (swimming motion)
        fish.swimPhase += 0.1;
        const tailSwing = Math.sin(fish.swimPhase) * 0.3;
        fish.tail.rotation.y = tailSwing;

        fish.fins.forEach((fin, i) => {
            fin.rotation.z += Math.sin(fish.swimPhase + i) * 0.05;
        });

        // Keep fish within bounds
        const bound = 200;
        if (Math.abs(fish.mesh.position.x) > bound) {
            fish.mesh.position.x = -fish.mesh.position.x * 0.5;
        }
        if (Math.abs(fish.mesh.position.z) > bound) {
            fish.mesh.position.z = -fish.mesh.position.z * 0.5;
        }
    });
}

/////PHYSICS SYSTEM

// Physics constants
const SPRING_STIFFNESS = 0.0001;   // How strongly thoughts are pulled back to UMAP position
const DAMPING = 1.0;            // Water resistance (lower = more resistance, more gentle)
const DRIFT_STRENGTH = 0.008;    // Brownian motion intensity (reduced for gentleness)
const SEMANTIC_FORCE = 0.001;    // Attraction/repulsion strength (reduced)
const MAX_DRIFT_DISTANCE = 500;    // Maximum distance from base position (smaller range)
const RIPPLE_STRENGTH = 2.0;     // Initial ripple force (reduced)
const RIPPLE_DECAY = 0.95;       // How quickly ripple fades (faster decay)

function updatePhysics() {
    const deltaTime = 1 / 60; // Assume 60fps

    // Update active ripples
    activeRipples = activeRipples.filter(ripple => {
        ripple.radius += ripple.speed * deltaTime;
        ripple.strength *= RIPPLE_DECAY;
        return ripple.strength > 0.01; // Remove weak ripples
    });

    thoughtPhysics.forEach((thought, i) => {
        const forces = new THREE.Vector3(0, 0, 0);

        // 1. Brownian motion (random drift) - X and Y only
        forces.add(new THREE.Vector3(
            (Math.random() - 0.5) * DRIFT_STRENGTH,
            (Math.random() - 0.5) * DRIFT_STRENGTH,
            0  // No Z drift
        ));

        // 2. Spring force (pull back to UMAP position) - X and Y only
        const displacement = new THREE.Vector3()
            .subVectors(thought.basePosition, thought.mesh.position);
        displacement.z = 0; // No Z spring force
        const distance = displacement.length();

        // Stronger pull if far from base
        const springForce = displacement.multiplyScalar(SPRING_STIFFNESS);
        forces.add(springForce);

        // 3. Semantic forces (attraction/repulsion from other thoughts) - X and Y only
        thoughtPhysics.forEach((other, j) => {
            if (i === j) return;

            const toOther = new THREE.Vector3()
                .subVectors(other.mesh.position, thought.mesh.position);
            toOther.z = 0; // Ignore Z distance for semantic forces
            const dist = toOther.length();

            if (dist < 30 && dist > 0.1) { // Only affect nearby thoughts
                // Distance in base positions (semantic similarity)
                const semanticDist = thought.basePosition.distanceTo(other.basePosition);

                // Similar thoughts attract, dissimilar repel
                const semanticSimilarity = 1 / (1 + semanticDist / 20);
                const forceDirection = toOther.normalize();

                if (semanticSimilarity > 0.5) {
                    // Attract similar thoughts
                    forces.add(forceDirection.multiplyScalar(SEMANTIC_FORCE * semanticSimilarity));
                } else {
                    // Repel dissimilar thoughts
                    forces.add(forceDirection.multiplyScalar(-SEMANTIC_FORCE * 0.5 / dist));
                }
            }
        });

        // 4. Ripple forces - X and Y only
        activeRipples.forEach(ripple => {
            const toThought = new THREE.Vector3()
                .subVectors(thought.mesh.position, ripple.position);
            toThought.z = 0; // Only ripple in X-Y plane
            const dist = toThought.length();
            const rippleDist = Math.abs(dist - ripple.radius);

            // Apply force if near ripple wavefront
            if (rippleDist < 10) {
                const force = toThought.normalize()
                    .multiplyScalar(ripple.strength * (1 - rippleDist / 10));
                forces.add(force);
            }
        });

        // Update velocity - zero out Z component
        thought.velocity.add(forces);
        thought.velocity.z = 0; // No Z velocity
        thought.velocity.multiplyScalar(DAMPING); // Apply damping

        // Limit velocity (lower for gentler motion)
        const maxVelocity = 0.15;
        if (thought.velocity.length() > maxVelocity) {
            thought.velocity.setLength(maxVelocity);
        }

        // Update position
        const newPosition = thought.mesh.position.clone().add(thought.velocity);

        // Keep Z fixed at base position
        newPosition.z = thought.basePosition.z;

        // Constrain to max drift distance in X-Y plane
        const driftVector = new THREE.Vector2(
            newPosition.x - thought.basePosition.x,
            newPosition.y - thought.basePosition.y
        );
        const driftDistance = driftVector.length();

        if (driftDistance > MAX_DRIFT_DISTANCE) {
            driftVector.setLength(MAX_DRIFT_DISTANCE);
            newPosition.x = thought.basePosition.x + driftVector.x;
            newPosition.y = thought.basePosition.y + driftVector.y;
        }

        thought.mesh.position.copy(newPosition);

        // Create water ripple if thought is moving significantly
        if (thought.velocity.length() > 0.05) {
            // Add subtle ripple to water at thought position
            if (Math.random() < 0.1) { // Only 10% of frames to avoid too many ripples
                addWaterRipple(
                    newPosition.x,
                    newPosition.y,
                    newPosition.z,
                    0.2 // Subtle strength
                );
            }
        }

        // Update rotation (gentle wobble)
        thought.mesh.rotation.x += thought.rotationVelocity.x;
        thought.mesh.rotation.y += thought.rotationVelocity.y;

        // Keep facing camera
        thought.mesh.lookAt(camera.position);
    });
}

function createRipple(position) {
    activeRipples.push({
        position: position.clone(),
        radius: 0,
        speed: 30, // Expand speed
        strength: RIPPLE_STRENGTH
    });
    console.log("Created ripple at", position);
}
