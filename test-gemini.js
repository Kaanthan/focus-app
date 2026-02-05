const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY;

if (!apiKey) {
    console.error("Error: EXPO_PUBLIC_GOOGLE_AI_API_KEY is not set in .env");
    process.exit(1);
}

async function run() {
    try {
        console.log("Testing generation with gemini-2.5-flash...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: 'v1beta' });

        const result = await model.generateContent("Hello, does this work?");
        const response = await result.response;
        const text = response.text();
        console.log("Success! Response: ", text);

    } catch (error) {
        console.error("Generation Failed:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", await error.response.json());
        } else {
            console.error(error);
        }
    }
}

run();
