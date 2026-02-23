import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type QuestionType = {
    id: 'role' | 'noise' | 'tone';
    question: string;
    placeholder?: string;
    hint?: string;
    options?: string[];
};

const QUESTIONS: QuestionType[] = [
    {
        id: 'role', // Mapping "Pursuit" answer to "Role" for the Architect title
        question: "In one word, what are you currently pursuing?",
        placeholder: "e.g. Freedom, Mastery, Peace",
        hint: "One word only.",
    },
    {
        id: 'noise',
        question: "What is the primary noise you are trying to silence?",
        options: ['Social Media', 'Meetings', 'Procrastination', 'Overthinking'],
    },
    {
        id: 'tone',
        question: "Which coaching tone do you need?",
        options: ['Stoic/Cold', 'Encouraging/Warm', 'Minimalist/Direct'],
    },
];

export default function SurveyScreen() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({ role: '', noise: '', tone: '' });

    const [loading, setLoading] = useState(false);

    const handleNext = async (currentAnswers = answers) => {
        // DEBUG ALERT - REMOVE LATER
        // Alert.alert("Debug", `Step: ${currentStep}, Options: ${QUESTIONS.length}`);

        if (currentStep < QUESTIONS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finish
            console.log("Starting Finish Flow...");
            setLoading(true);
            try {
                // ... rest of logic

                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session?.user) {
                    console.error("Session Error:", sessionError);
                    Alert.alert("Error", "No authenticated user found. Please log in again.");
                    router.replace('/auth');
                    return;
                }

                // Prepare persona data - ensure it's a plain object
                const personaData = {
                    role: currentAnswers.role,
                    noise: currentAnswers.noise,
                    tone: currentAnswers.tone,
                    pursuit: currentAnswers.role
                };

                console.log("Attempting to save persona for user:", session.user.id);
                console.log("Persona Data:", JSON.stringify(personaData));

                // Create a promise that rejects after 10 seconds
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), 10000)
                );

                // 1. Save to Supabase (Source of Truth) with timeout
                const { error } = await Promise.race([
                    supabase
                        .from('profiles')
                        .upsert({
                            id: session.user.id,
                            onboarding_completed: true,
                            persona_data: personaData,
                            updated_at: new Date().toISOString(),
                        }),
                    timeoutPromise
                ]) as any;

                if (error) {
                    console.error("Supabase upsert failed:", error);
                    console.error("Supabase error details:", JSON.stringify(error));
                    Alert.alert("Error", `Failed to save profile: ${error.message || 'Unknown error'}. Please check your connection.`);
                    return;
                }

                console.log("Supabase save successful");

                // 2. Save to Local Storage (Cache for speed/offline)
                await AsyncStorage.setItem('user_persona', JSON.stringify(personaData));
                await AsyncStorage.setItem('onboarding_completed', 'true'); // Local flag for speed

                console.log("Local storage save successful, navigating to home");
                router.replace('/');
            } catch (e: any) {
                console.error("Failed to save persona (Catch Block)", e);
                Alert.alert("Error", "An unexpected error occurred: " + (e.message || e));
            } finally {
                setLoading(false);
            }
        }
    };

    const handleOptionSelect = (option: string) => {
        const newAnswers = { ...answers, [QUESTIONS[currentStep].id]: option };
        setAnswers(newAnswers);

        // Auto advance for options
        setTimeout(() => {
            handleNext(newAnswers);
        }, 200);
    };

    const currentQuestion = QUESTIONS[currentStep];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <Text style={styles.stepText}>Step {currentStep + 1} of {QUESTIONS.length}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.question}>{currentQuestion.question}</Text>
                {currentQuestion.hint && <Text style={styles.hint}>{currentQuestion.hint}</Text>}

                {currentQuestion.options ? (
                    <View style={styles.optionsContainer}>
                        {currentQuestion.options.map((option) => (
                            <Pressable
                                key={option}
                                style={({ pressed }) => [
                                    styles.optionButton,
                                    answers[currentQuestion.id] === option && styles.optionSelected,
                                    pressed && styles.optionPressed,
                                    loading && { opacity: 0.7 }
                                ]}
                                disabled={loading}
                                onPress={() => handleOptionSelect(option)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    answers[currentQuestion.id] === option && styles.optionTextSelected
                                ]}>{option}</Text>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View>
                        <TextInput
                            style={styles.input}
                            placeholder={currentQuestion.placeholder}
                            placeholderTextColor="#999"
                            value={answers[currentQuestion.id]}
                            onChangeText={(text) => setAnswers({ ...answers, [currentQuestion.id]: text })}
                            autoFocus
                            onSubmitEditing={() => handleNext()}
                            returnKeyType={currentStep === QUESTIONS.length - 1 ? "done" : "next"}
                        />
                        <Pressable style={[styles.button, loading && { opacity: 0.7 }]} onPress={() => handleNext()} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.buttonText}>
                                        {currentStep === QUESTIONS.length - 1 ? "Finish & Morph" : "Next"}
                                    </Text>
                                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                                </>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 40,
    },
    backButton: {
        padding: 10,
        marginRight: 10,
        marginLeft: -10,
    },
    stepText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
    },
    question: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 10,
        color: '#000',
        letterSpacing: -0.5,
    },
    hint: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        fontStyle: 'italic',
    },
    input: {
        borderBottomWidth: 2,
        borderBottomColor: '#000',
        fontSize: 28,
        paddingVertical: 10,
        marginBottom: 40,
        color: '#000',
    },
    button: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 40,
        gap: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    optionsContainer: {
        gap: 12,
    },
    optionButton: {
        padding: 20,
        borderRadius: 16,
        backgroundColor: '#F2F2F7',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionPressed: {
        opacity: 0.8,
        backgroundColor: '#E5E5EA',
    },
    optionSelected: {
        borderColor: '#000',
        backgroundColor: '#fff',
    },
    optionText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#000',
    },
    optionTextSelected: {
        fontWeight: '700',
    }
});
