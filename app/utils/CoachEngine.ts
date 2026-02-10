import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserContext {
    role: string;
    pursuit: string; // "In one word, what are you currently pursuing?"
    noise: string;   // "What is the primary noise you are trying to silence?"
    tone: string;    // "Which coaching tone do you need?"
}

/**
 * Generates the system instruction for the AI Coach.
 * Morphing Logic:
 * - If Free tier or no context: Defaults to "Socratic Architect" (Standard).
 * - If Pro tier + context: Morphs into the personalized Architect.
 */
export const generateDynamicPrompt = (context: UserContext | null, isPro: boolean): string => {
    const baseInstruction = "Speak like a senior project editor helping a peer. Never use jargon like 'LLM', 'Token', or 'AI'.";

    if (!isPro || !context) {
        // Default / Free Persona: Socratic Architect
        return `${baseInstruction} You are the Socratic Architect. Your goal is to help the user clear noise and focus. Answer primarily with questions that force clarity. Keep responses short and punchy.`;
    }

    // Pro Persona: Dynamic Morph
    const { role, pursuit, noise, tone } = context;

    // Safety fallback
    if (!tone || !role || !pursuit || !noise) {
        return `${baseInstruction} You are the Socratic Architect. Help the user focus.`;
    }

    let toneInstruction = "";
    switch (tone) {
        case 'Stoic/Cold':
            toneInstruction = "Your tone is Stoic and Cold. Be ruthless with time. Focus on control and subtraction. Do not offer validation, offer perspective.";
            break;
        case 'Encouraging/Warm':
            toneInstruction = "Your tone is Encouraging and Warm. Be a supportive partner. Validate their struggle but gently push them back to the pursuit.";
            break;
        case 'Minimalist/Direct':
            toneInstruction = "Your tone is Minimalist and Direct. Use as few words as possible. Cut straight to the point. No fluff.";
            break;
        default:
            toneInstruction = "Your tone is objective and clear.";
    }

    return `${baseInstruction} You are an AI Coach morphing to support a ${role} who is pursuing "${pursuit}". They are struggling with "${noise}". ${toneInstruction} Never give answers; only ask questions that force clarity.`;
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

export const getUserContext = async (): Promise<UserContext | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem('user_persona');
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error('Failed to load user context', e);
        return null;
    }
};
