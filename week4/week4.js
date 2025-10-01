// Week 4 - Blonde Album Song Clustering with Embeddings and UMAP
import { getEmbeddings } from './api.js';

// Song data
const SONGS = [
    'nikes', 'ivy', 'pink-white', 'be-yourself', 'solo', 'skyline-to',
    'self-control', 'good-guy', 'nights', 'solo-reprise', 'pretty-sweet',
    'facebook-story', 'white-ferrari', 'seigfried', 'godspeed', 'futura-free'
];

const songData = {};
let canvas, ctx;
let leadingSongSelect, songsGrid, clusterBtn, statusDiv;

// Initialize the application
init();

async function init() {
    setupUI();
    await loadAllLyrics();
    setupEventListeners();
}

function setupUI() {
    canvas = document.getElementById('myCanvas');
    ctx = canvas.getContext('2d');
    leadingSongSelect = document.getElementById('leadingSong');
    songsGrid = document.getElementById('songs-grid');
    clusterBtn = document.getElementById('clusterBtn');
    statusDiv = document.getElementById('status');

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 600;

    // Populate leading song dropdown
    SONGS.forEach(song => {
        const option = document.createElement('option');
        option.value = song;
        option.textContent = formatSongName(song);
        leadingSongSelect.appendChild(option);
    });

    // Create checkboxes for all songs
    SONGS.forEach(song => {
        const div = document.createElement('div');
        div.className = 'song-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `song-${song}`;
        checkbox.value = song;

        const label = document.createElement('label');
        label.htmlFor = `song-${song}`;
        label.textContent = formatSongName(song);

        div.appendChild(checkbox);
        div.appendChild(label);
        songsGrid.appendChild(div);

        // Make the whole div clickable
        div.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
        });
    });
}

function formatSongName(filename) {
    return filename
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function loadAllLyrics() {
    statusDiv.textContent = 'Loading lyrics...';
    statusDiv.className = 'loading';

    for (const song of SONGS) {
        try {
            const response = await fetch(`lyrics/${song}.txt`);
            const text = await response.text();
            songData[song] = {
                name: formatSongName(song),
                lyrics: text,
                embedding: null,
                x: 0,
                y: 0
            };
        } catch (error) {
            console.error(`Error loading ${song}:`, error);
        }
    }

    statusDiv.textContent = 'Select a leading song and at least one other song, then click "Cluster Songs"';
    statusDiv.className = '';
}

function setupEventListeners() {
    clusterBtn.addEventListener('click', handleCluster);
    canvas.addEventListener('click', handleCanvasClick);

    // Update checkboxes when leading song changes
    leadingSongSelect.addEventListener('change', () => {
        const leadingSong = leadingSongSelect.value;
        document.querySelectorAll('#songs-grid input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.value === leadingSong) {
                checkbox.checked = false;
                checkbox.disabled = true;
            } else {
                checkbox.disabled = false;
            }
        });
    });
}

async function handleCluster() {
    const leadingSong = leadingSongSelect.value;
    const selectedSongs = Array.from(
        document.querySelectorAll('#songs-grid input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    if (!leadingSong) {
        alert('Please select a leading song');
        return;
    }

    if (selectedSongs.length === 0) {
        alert('Please select at least one other song to cluster');
        return;
    }

    // Combine leading song with selected songs
    const allSelectedSongs = [leadingSong, ...selectedSongs];

    try {
        statusDiv.textContent = 'Getting embeddings...';
        statusDiv.className = 'loading';
        clusterBtn.disabled = true;

        // Get lyrics for selected songs
        const lyrics = allSelectedSongs.map(song => songData[song].lyrics);

        // Get embeddings
        const embeddings = await getEmbeddings(lyrics);

        // Store embeddings
        allSelectedSongs.forEach((song, i) => {
            songData[song].embedding = embeddings[i];
        });

        statusDiv.textContent = 'Running UMAP...';

        // Run UMAP
        const umap = new UMAP.UMAP({
            nComponents: 2,
            nNeighbors: Math.min(15, allSelectedSongs.length - 1),
            minDist: 0.1,
            spread: 1.0
        });

        const umapEmbeddings = umap.fit(embeddings);

        // Store UMAP coordinates
        allSelectedSongs.forEach((song, i) => {
            songData[song].umapX = umapEmbeddings[i][0];
            songData[song].umapY = umapEmbeddings[i][1];
        });

        statusDiv.textContent = 'Click on any song to make it the leading song';
        statusDiv.className = '';

        // Visualize
        visualize(leadingSong, allSelectedSongs);

    } catch (error) {
        console.error('Error during clustering:', error);
        statusDiv.textContent = `Error: ${error.message}. Make sure you have an auth token in localStorage.`;
        statusDiv.className = 'error';
    } finally {
        clusterBtn.disabled = false;
    }
}

function visualize(leadingSong, selectedSongs) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get UMAP coordinates
    const coords = selectedSongs.map(song => ({
        song,
        x: songData[song].umapX,
        y: songData[song].umapY
    }));

    // Find min/max for scaling
    const xValues = coords.map(c => c.x);
    const yValues = coords.map(c => c.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // Scale to canvas with padding
    const padding = 80;
    const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
    const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);

    coords.forEach(coord => {
        coord.canvasX = padding + (coord.x - minX) * scaleX;
        coord.canvasY = padding + (coord.y - minY) * scaleY;
        songData[coord.song].x = coord.canvasX;
        songData[coord.song].y = coord.canvasY;
    });

    // Draw connections from leading song
    const leadingCoord = coords.find(c => c.song === leadingSong);
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
    ctx.lineWidth = 2;

    coords.forEach(coord => {
        if (coord.song !== leadingSong) {
            ctx.beginPath();
            ctx.moveTo(leadingCoord.canvasX, leadingCoord.canvasY);
            ctx.lineTo(coord.canvasX, coord.canvasY);
            ctx.stroke();
        }
    });

    // Draw points and labels
    coords.forEach(coord => {
        const isLeading = coord.song === leadingSong;

        // Draw circle
        ctx.beginPath();
        ctx.arc(coord.canvasX, coord.canvasY, isLeading ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = isLeading ? '#e74c3c' : '#3498db';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#2c3e50';
        ctx.font = isLeading ? 'bold 14px Courier New' : '12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(songData[coord.song].name, coord.canvasX, coord.canvasY - 15);
    });
}

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Check if click is near any song
    const currentLeading = leadingSongSelect.value;
    const selectedSongs = Array.from(
        document.querySelectorAll('#songs-grid input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    const allSelectedSongs = [currentLeading, ...selectedSongs];

    for (const song of allSelectedSongs) {
        const data = songData[song];
        if (!data.x || !data.y) continue;

        const dist = Math.sqrt((clickX - data.x) ** 2 + (clickY - data.y) ** 2);

        if (dist < 20) {
            if (song !== currentLeading) {
                // Update leading song
                leadingSongSelect.value = song;

                // Update checkboxes
                document.querySelectorAll('#songs-grid input[type="checkbox"]').forEach(checkbox => {
                    if (checkbox.value === song) {
                        checkbox.checked = false;
                        checkbox.disabled = true;
                    } else if (checkbox.value === currentLeading) {
                        checkbox.checked = true;
                        checkbox.disabled = false;
                    }
                });

                // Re-visualize with new leading song
                visualize(song, allSelectedSongs);
            }
            break;
        }
    }
}
