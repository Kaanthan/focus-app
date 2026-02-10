const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY;

if (!apiKey) {
    console.error("Error: EXPO_PUBLIC_GOOGLE_AI_API_KEY is not set in .env");
    process.exit(1);
}

async function run() {
    try {
        console.log("Listing available models...");
        const genAI = new GoogleGenerativeAI(apiKey);
        // For listing models, we don't need getGenerativeModel, we need a different approach or just test specific known ones.
        // Actually the SDK doesn't have a direct listModels on genAI instance in some versions?
        // Let's use the API directly via fetch to be sure, or try the model manager if available.
        // But the error message said "Call ListModels to see...".
        // The Node SDK might expose this via GoogleGenerativeAI.getGenerativeModel... wait.

        // Let's just try to hit the REST API to list models, it's more reliable for debugging.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.log("No models found or error:", data);
        }

    } catch (error) {
        console.error("List Models Failed:", error);
    }
}

run();
