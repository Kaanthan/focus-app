const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY;

if (!apiKey) {
    console.error("Error: EXPO_PUBLIC_GOOGLE_AI_API_KEY is not set in .env");
    process.exit(1);
}

async function run() {
    try {
        console.log("Testing Gemini 3 Flash Preview connection...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const result = await model.generateContent("Hello, who are you?");
        const response = await result.response;
        const text = response.text();
        console.log("Success! Response:", text);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

run();
