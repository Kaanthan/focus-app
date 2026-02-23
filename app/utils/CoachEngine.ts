import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserContext {
    role: string;
    pursuit: string; // "In one word, what are you currently pursuing?"
    noise: string;   // "What is the primary noise you are trying to silence?"
    tone: string;    // "Which coaching tone do you need?"
    principles?: string; // "What are your core principles?"
}

/**
 * Generates the system instruction for the AI Coach.
 * Morphing Logic:
 * - If Free tier or no context: Defaults to "Socratic Architect" (Standard).
 * - If Pro tier + context: Morphs into the personalized Architect.
 */
export const generateDynamicPrompt = (context: UserContext | null, isPro: boolean): string => {
    const baseInstruction = "You are the AI Partner for the user's 'Better Creating' journey. Your goal is to help them build systems, not just solve immediate problems. Be encouraging, concise, and focused on clarity.";

    if (!isPro || !context) {
        // Default / Free Persona: The System Builder
        return `${baseInstruction} You are the System Builder. Help the user clear noise and focus on one next step. Answer primarily with questions that force clarity. Keep responses short and punchy. Under 50 words. No hashtags.`;
    }

    // Pro Persona: Dynamic Morph
    const { role, pursuit, noise, tone, principles } = context;

    // Safety fallback
    if (!tone || !role || !pursuit || !noise) {
        return `${baseInstruction} You are the System Builder. Help the user focus.`;
    }

    let toneInstruction = "";
    switch (tone) {
        case 'Stoic/Cold':
            toneInstruction = "Your tone is Stoic but Constructive. Focus on objective reality and time management. 'Discipline is freedom'. Do not coddle, but do not be rude. Offer perspective.";
            break;
        case 'Encouraging/Warm':
            toneInstruction = "Your tone is Encouraging and Warm. Be an accountability partner who believes in them. Validate their struggle, then gently push them to the next system-based step.";
            break;
        case 'Minimalist/Direct':
            toneInstruction = "Your tone is Minimalist and Direct. Use as few words as possible. Cut straight to the essence. Remove fluff. Focus on the 'One Thing'.";
            break;
        default:
            toneInstruction = "Your tone is objective and clear.";
    }

    const principlesInstruction = principles ? ` Guiding Principles: "${principles}".` : "";

    return `${baseInstruction} you are now morphing into: The ${role} Architect. The user is pursuing "${pursuit}" but is battling "${noise}".${principlesInstruction} ${toneInstruction} Never give long lectures. Ask questions that help them build a better system for their work. Keep it under 50 words. No hashtags.`;
};

export const generateCoachTitle = (context: UserContext | null, isPro: boolean): string => {
    if (!isPro || !context || !context.tone || !context.role) return "The Standard Coach";

    // "The [Tone] [Role] Architect"
    // Tone: "Stoic/Cold" -> "Stoic"
    const toneAdjective = context.tone.includes('/') ? context.tone.split('/')[0] : context.tone;

    // Role: context.role (which is mapped from pursuit)
    return `The ${toneAdjective} ${context.role} Architect`;
};

export const generateCoachDescription = (context: UserContext | null, isPro: boolean): string => {
    if (!isPro || !context || !context.pursuit || !context.noise) return "Clear noise. Focus on what matters.";
    return `Focus on: ${context.pursuit}. Silence: ${context.noise}.`;
};

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY || '');

export interface CoachPersona {
    title: string;
    description: string;
    persona: string;
}

export const generatePersonas = async (context: UserContext): Promise<CoachPersona[]> => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
        You are an expert system designer. The user is pursuing "${context.pursuit}" and battling "${context.noise}". They prefer a "${context.tone}" tone.
        ${context.principles ? `Their core principles are: "${context.principles}".` : ""}
        
        Generate 3 distinct AI Coach Personas to help them.
        1. A "Minimalist/Direct" persona.
        2. A "Encouraging/Warm" persona.
        3. A "System/Architect" persona.

        Return ONLY a valid JSON array of 3 objects. No markdown formatting.
        Format:
        [
            { "title": "The [Adjective] [Role]", "description": "Short motto (max 8 words)", "persona": "System instruction for this specific persona" },
            ...
        ]
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let text = response.text();

        // Clean cleanup if Gemini returns markdown code blocks
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const personas: CoachPersona[] = JSON.parse(text);
        return personas;
    } catch (error) {
        console.error("Gemini Persona Generation Failed:", error);
        // Fallback to static if AI fails
        return [
            { title: "The Solopreneur", description: "Build in public and ship fast.", persona: "You are the Solopreneur coach." },
            { title: "The Minimalist", description: "Cut the noise. Ruthless prioritization.", persona: "You are the Minimalist coach." },
            { title: "The Habit Builder", description: "Consistency and daily systems.", persona: "You are the Habit coach." },
        ];
    }
};

export const getUserContext = async (): Promise<UserContext | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem('user_persona');
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error('Failed to load user context', e);
        return null;
    }
};
