import { generateDynamicPrompt, getUserContext, UserContext } from '@/app/utils/CoachEngine';
import Paywall from '@/components/Paywall';
import { useSubscription } from '@/components/SubscriptionProvider';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
// FileSystem removed in favor of fetch/blob
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as Clipboard from 'expo-clipboard'; // Real Clipboard

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY || '');

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

export default function ChatScreen() {
    const { title, persona } = useLocalSearchParams<{ title: string; persona?: string }>();
    const { isPro } = useSubscription();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    // UserContext can be null initially
    const [userContext, setUserContext] = useState<UserContext | null>(null);

    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [showToast, setShowToast] = useState(false); // Toast State
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

    useEffect(() => {
        loadContext();
        loadHistory();
    }, []);

    useEffect(() => {
        if (isHistoryLoaded) {
            saveHistory();
        }
    }, [messages, isHistoryLoaded]);

    useEffect(() => {
        // Auto-scroll when chips appear/disappear or state changes
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [isLoading, inputText]);

    const loadContext = async () => {
        const context = await getUserContext();
        if (context) {
            setUserContext(context);
        }
    };

    const loadHistory = async () => {
        try {
            const key = `chat_history_${title}`;
            const savedMessages = await AsyncStorage.getItem(key);
            if (savedMessages) {
                setMessages(JSON.parse(savedMessages));
            }
        } catch (e) {
            console.error('Failed to load chat history', e);
        } finally {
            setIsHistoryLoaded(true);
        }
    };

    const saveHistory = async () => {
        try {
            const key = `chat_history_${title}`;
            await AsyncStorage.setItem(key, JSON.stringify(messages));
        } catch (e) {
            console.error('Failed to save chat history', e);
        }
    };

    const checkDailyLimit = async () => {
        if (isPro) return true;

        try {
            // User Specific Limit Key based on Supabase ID
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id || 'guest';

            const today = new Date().toDateString();
            const storageKey = `daily_usage_${userId}_${today}`;

            const usageJson = await AsyncStorage.getItem(storageKey);
            let usage = { count: 0 };

            if (usageJson) {
                usage = JSON.parse(usageJson);
            }

            if (usage.count >= 10) {
                setShowLimitModal(true);
                return false;
            }

            // Increment and save
            usage.count += 1;
            await AsyncStorage.setItem(storageKey, JSON.stringify(usage));
            return true;
        } catch (e) {
            console.error("Error checking limit", e);
            return true; // Fail open if error
        }
    };

    const sendMessage = async (textOverride?: string) => {
        const textToSend = textOverride || inputText;
        if (!textToSend.trim()) return;

        // Check Limit
        const canProceed = await checkDailyLimit();
        if (!canProceed) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: textToSend,
            sender: 'user',
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            let systemInstruction = '';
            const baseInstruction = "Speak like a senior project editor helping a peer. Never use jargon like 'LLM', 'Token', or 'AI'. Keep it concise. Do not use hashtags. Do not use markdown headers.";

            // Generate Dynamic Prompt
            if (persona === 'dynamic') {
                // Re-fetch context to ensure freshness or use state
                systemInstruction = generateDynamicPrompt(userContext, isPro);
            } else if (persona) {
                // Custom Coach (Manual Creation)
                // Fallback context values if userContext is null
                const mission = userContext?.pursuit || 'Not defined';
                systemInstruction = `${baseInstruction} You are "${title}". Your specialized role is: ${persona}. User Mission: ${mission}.`;
            } else {
                if (title === 'The Minimalist') {
                    systemInstruction = `${baseInstruction} You are a ruthless Socratic editor. Answer only with questions that force the user to delete tasks. Max 15 words.`;
                } else if (title === 'The Solopreneur') {
                    const mission = userContext?.pursuit || 'Not defined';
                    systemInstruction = `${baseInstruction} You are "The Solopreneur Coach". Your student is on a 12 Startups in 12 Months mission. Core Principles: Empathy First. User Mission: ${mission}. Focus 80% on the 'next physical step' and 20% on mindset. If they sound distracted, steer them back to their mission. Keep responses under 100 words.`;
                } else {
                    // Default fallback
                    systemInstruction = generateDynamicPrompt(null, false);
                }
            }

            // Standup Mode Override (Highest Priority)
            if (textToSend.toLowerCase().includes("daily review") || textToSend.toLowerCase().includes("standup")) {
                systemInstruction = `${baseInstruction} You are conducting a Daily Standup. Ask these 3 questions ONE BY ONE. Wait for the answer before asking the next. 1. What did you say NO to today? 2. What is the ONE thing you shipped? 3. Are you blocked? At the end, provide a 1-sentence summary. No hashtags.`;
            }

            // Model Selection - Use Stable Model
            const modelName = 'gemini-1.5-flash';

            // FORCE Constraint at the end
            const finalSystemInstruction = `${systemInstruction} REMEMBER: Answer in under 50 words. NO HASHTAGS.`;

            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: finalSystemInstruction,
            });

            const chat = model.startChat({
                history: messages.map((msg) => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }],
                })),
                generationConfig: {
                    maxOutputTokens: 500,
                },
            });

            const result = await chat.sendMessage(textToSend);
            const response = result.response.text();

            const aiMessage: Message = {
                id: Date.now().toString(),
                text: response,
                sender: 'ai',
            };

            setMessages((prev) => [...prev, aiMessage]);

            if (title === 'The Minimalist') {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
        } catch (error: any) {
            console.error('Error sending message:', error);

            let errorText = "I'm having trouble connecting. Please check your internet or try again.";

            // Handle Rate Limits (429) & Quota Issues
            if (error.message?.includes('429') || error.message?.includes('Quota')) {
                errorText = "The Focus Coach is experiencing high traffic. Please take a deep breath and try again in a few seconds.";
            }
            // Handle 404 (Model Not Found) or 503 (Service Unavailable)
            else if (error.message?.includes('404') || error.message?.includes('503')) {
                errorText = "Service temporarily unavailable. We are recalibrating. Please try again later.";
            }

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: errorText,
                sender: 'ai',
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleSendPress = () => sendMessage();
    const handleSubmitEditing = () => sendMessage();

    const copyToClipboard = async (text: string, id: string) => {
        await Clipboard.setStringAsync(text);
        // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Haptics mock removed, can re-add if package installed
        setCopiedMessageId(id);
        setShowToast(true);
        setTimeout(() => {
            setCopiedMessageId(null);
            setShowToast(false);
        }, 2000);
    };

    const handleSpeak = async (text: string, id: string) => {
        if (speakingMessageId === id) {
            // Stop
            await Speech.stop();
            setSpeakingMessageId(null);
        } else {
            // Play new
            if (speakingMessageId) await Speech.stop();
            setSpeakingMessageId(id);
            const rate = title === 'The Minimalist' ? 0.9 : 1.0;
            Speech.speak(text, {
                rate,
                onDone: () => setSpeakingMessageId(null),
                onStopped: () => setSpeakingMessageId(null),
            });
        }
    };

    const uriToBase64 = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    // base64data is "data:mime;base64,..."
                    resolve(base64data.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("uriToBase64 failed", error);
            throw error;
        }
    };

    const transcribeUserAudio = async (uri: string) => {
        try {
            setLoadingMessage('Listening...');
            setIsLoading(true);

            // Use fetch + FileReader (Standard Web API) - Most reliable for Expo now
            const base64Audio = await uriToBase64(uri);

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: "audio/m4a",
                        data: base64Audio
                    }
                },
                { text: "Transcribe this audio exactly as spoken. Do not add any commentary." },
            ]);

            const transcription = result.response.text();
            if (transcription) {
                setInputText(transcription.trim());
                // Optional: Auto-send could go here
            }
        } catch (error: any) {
            console.error("Transcription failed", error);
            Alert.alert("Transcription Error", error.message || "Could not process audio.");
        } finally {
            setLoadingMessage('');
            setIsLoading(false);
        }
    };

    const handleMicPress = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (recording) {
            // Stop Recording
            setIsListening(false);
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                transcribeUserAudio(uri);
            }
        } else {
            // Start Recording
            try {
                const permission = await Audio.requestPermissionsAsync();

                if (permission.status === 'granted') {
                    await Audio.setAudioModeAsync({
                        allowsRecordingIOS: true,
                        playsInSilentModeIOS: true,
                    });

                    const { recording } = await Audio.Recording.createAsync(
                        Audio.RecordingOptionsPresets.HIGH_QUALITY
                    );
                    setRecording(recording);
                    setIsListening(true);
                } else {
                    console.warn("Permission not granted", permission);
                    alert("Please enable microphone permissions in settings.");
                }
            } catch (err) {
                console.error('Failed to start recording', err);
            }
        }
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View style={{ marginBottom: 12, alignItems: item.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <Pressable
                onLongPress={() => copyToClipboard(item.text, item.id)}
                delayLongPress={500}
                style={({ pressed }) => [
                    styles.messageBubble,
                    item.sender === 'user' ? styles.userBubble : styles.aiBubble,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                ]}
            >
                <Text
                    style={[
                        styles.messageText,
                        item.sender === 'user' ? styles.userText : styles.aiText,
                    ]}
                >
                    {item.text}
                </Text>
            </Pressable>
            {item.sender === 'ai' && (
                <View style={{ flexDirection: 'row', marginTop: 4, marginLeft: 4, gap: 16, opacity: 0.8 }}>
                    <Pressable onPress={() => copyToClipboard(item.text, item.id)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={copiedMessageId === item.id ? "checkmark-circle" : "copy-outline"} size={14} color="#8E8E93" />
                        {copiedMessageId === item.id && <Text style={{ fontSize: 10, color: '#8E8E93' }}>Copied</Text>}
                    </Pressable>
                    <Pressable onPress={() => handleSpeak(item.text, item.id)} hitSlop={10}>
                        <Ionicons name={speakingMessageId === item.id ? "stop-circle-outline" : "volume-high-outline"} size={14} color="#8E8E93" />
                    </Pressable>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                <Text style={{ fontSize: 18, fontWeight: '600' }}>{title || 'Coach'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable onPress={() => {
                        Alert.alert('Clear History', 'Are you sure?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Clear', style: 'destructive', onPress: () => { setMessages([]); AsyncStorage.removeItem(`chat_history_${title}`); } }
                        ]);
                    }}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </Pressable>
                    {isPro && <View style={{ backgroundColor: 'gold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: 'bold' }}>PRO</Text></View>}
                </View>
            </View>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
                    renderItem={renderMessage}
                />

                {isLoading && (
                    <View style={{ padding: 10, alignItems: 'center' }}>
                        <Text style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>{loadingMessage || 'Thinking...'}</Text>
                        <ActivityIndicator color="#000" />
                    </View>
                )}

                <View>
                    {!isLoading && inputText.length === 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.suggestionsContainer}
                            style={{ maxHeight: 50, marginBottom: 8 }}
                        >
                            <CategoryPill title="Deep Work" icon="briefcase" onPress={() => sendMessage("Help me focus on Deep Work")} />
                            <CategoryPill title="Stress" icon="medical" onPress={() => sendMessage("I'm feeling stressed. Help me decompress.")} />
                            <CategoryPill title="Planning" icon="calendar" onPress={() => sendMessage("Help me plan my day")} />
                            <CategoryPill title="Motivation" icon="flame" onPress={() => sendMessage("I need motivation")} />
                            <CategoryPill title="Critique" icon="eye" onPress={() => sendMessage("Critique my current task")} />
                            <CategoryPill title="Simplify" icon="cut" onPress={() => sendMessage("Simplify my next step")} />
                            <CategoryPill title="Daily Review" icon="checkmark-done-circle" onPress={() => sendMessage("Start Daily Review")} />
                        </ScrollView>
                    )}

                    <View style={styles.inputContainer}>
                        <Pressable onPress={handleMicPress} style={{ paddingHorizontal: 8 }}>
                            <Ionicons name={isListening ? "mic" : "mic-outline"} size={24} color={isListening ? "#007AFF" : "#8E8E93"} />
                        </Pressable>
                        <TextInput
                            style={styles.input}
                            placeholder={isListening ? "Listening..." : "Ask your coach..."}
                            placeholderTextColor="#A0A0A5"
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={handleSubmitEditing}
                            returnKeyType="send"
                        />
                        <Pressable
                            style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
                            onPress={handleSendPress}
                            disabled={isLoading}
                        >
                            <Ionicons name="arrow-up" size={20} color="white" />
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Toast Notification */}
            {showToast && (
                <View style={{ position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center', zIndex: 100 }}>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Copied to clipboard</Text>
                    </View>
                </View>
            )}

            {/* Limit Reached Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showLimitModal}
                onRequestClose={() => setShowLimitModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>You've found your rhythm.</Text>
                        <Text style={styles.modalBody}>
                            You’ve completed your tactical session for today. To keep your focus sharp and avoid 'talk-procrastination,' we’ve paused the chat.
                        </Text>
                        <Text style={styles.modalPro}>
                            The Pro Move: Want to unlock your Custom Architect persona and the Socratic Minimalist? Support the mission and go Pro.
                        </Text>
                        <Pressable style={styles.modalButton} onPress={() => { setShowLimitModal(false); setShowPaywall(true); }}>
                            <Text style={styles.modalButtonText}>Unlock Unlimited Access</Text>
                        </Pressable>
                        <Pressable style={styles.modalClose} onPress={() => setShowLimitModal(false)}>
                            <Text style={styles.modalCloseText}>Not now</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
        </SafeAreaView>
    );
}

function CategoryPill({ title, icon, onPress }: { title: string; icon: any; onPress: () => void }) {
    return (
        <Pressable
            style={({ pressed }) => [styles.categoryPill, pressed && { opacity: 0.7 }]}
            onPress={onPress}
        >
            <Ionicons name={icon} size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.categoryText}>{title}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 20,
        maxWidth: '80%',
    },
    userBubble: {
        backgroundColor: '#000',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: '#F2F2F7',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#000',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#F2F2F7',
        padding: 12,
        borderRadius: 24,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#000',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonPressed: {
        opacity: 0.8,
    },
    sendButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    suggestionsContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryPill: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E5EA',
        justifyContent: 'center',
        marginRight: 8,
    },
    categoryText: {
        fontSize: 14,
        color: '#000',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalBody: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 24,
    },
    modalPro: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        fontStyle: 'italic',
    },
    modalButton: {
        backgroundColor: '#000',
        paddingVertical: 16,
        paddingHorizontal: 30,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalClose: {
        padding: 10,
    },
    modalCloseText: {
        color: '#666',
        fontSize: 14,
    }
});
