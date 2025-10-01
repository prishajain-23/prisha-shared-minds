// API module for Week 4 - Text Embeddings for Blonde Album Lyrics
// Gets embeddings using the ITP/IMA Replicate Proxy

const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";

// Get embeddings for an array of text strings
export async function getEmbeddings(texts) {
    console.log("Requesting embeddings for:", texts);

    const authToken = (typeof localStorage !== 'undefined')
        ? localStorage.getItem('itp-ima-replicate-proxy-ok')
        : null;

    const data = {
        version: "beautyyuyanli/multilingual-e5-large:a06276a89f1a902d5fc225a9ca32b6e8e6292b7f3b136518878da97c458e2bad",
        input: {
            texts: JSON.stringify(texts),
        },
    };

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(data),
    };

    try {
        const raw_response = await fetch(PROXY_URL, options);

        if (!raw_response.ok) {
            const text = await raw_response.text().catch(() => "");
            throw new Error(`Proxy request failed: ${raw_response.status} ${text}`);
        }

        const json_response = await raw_response.json();
        console.log("Embeddings response:", json_response);

        if (json_response.error) {
            throw new Error(json_response.error);
        }

        const embeddings = json_response.output;

        if (!embeddings || embeddings.length !== texts.length) {
            throw new Error("Mismatch between number of texts and number of embeddings returned.");
        }

        return embeddings;

    } catch (error) {
        console.error("Error fetching embeddings:", error);
        throw error;
    }
}

// Make the function globally available
window.getEmbeddings = getEmbeddings;
