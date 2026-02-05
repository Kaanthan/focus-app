import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY || '');

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

export default function ChatScreen() {
    const { title } = useLocalSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [userContext, setUserContext] = useState({ mission: '', principles: '' });
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

    useEffect(() => {
        loadContext();
        loadHistory();
    }, []);

    useEffect(() => {
        if (isHistoryLoaded) {
            saveHistory();
        }
    }, [messages, isHistoryLoaded]);

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

    const loadContext = async () => {
        try {
            const jsonValue = await AsyncStorage.getItem('userContext');
            if (jsonValue != null) {
                const data = JSON.parse(jsonValue);
                setUserContext({
                    mission: data.mission || 'Not defined',
                    principles: data.principles || 'Not defined',
                });
            }
        } catch (e) {
            console.error('Failed to load context', e);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            let systemInstruction = '';

            if (title === 'The Minimalist') {
                systemInstruction = 'You are a ruthless Socratic editor. Answer only with questions that force the user to delete tasks. Max 15 words.';
            } else if (title === 'The Solopreneur') {
                systemInstruction = `You are "The Solopreneur Coach". Your student is on a 12 Startups in 12 Months mission. Core Principles: Empathy First. User Mission: ${userContext.mission}. User Principles: ${userContext.principles}. Focus 80% on the 'next physical step' and 20% on mindset. If they sound distracted, steer them back to their mission. Keep responses under 100 words.`;
            } else {
                // Default fallback
                systemInstruction = `You are the ${title}. Your mission is to help the user achieve their goals. Context: ${userContext.mission}.`;
            }

            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: systemInstruction,
            }, { apiVersion: 'v1beta' });

            const chat = model.startChat({
                history: messages.map((msg) => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }],
                })),
            });

            const result = await chat.sendMessage(inputText);
            const output = result.response.text();

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: output,
                sender: 'ai',
            };

            setMessages((prev) => [...prev, aiMessage]);

            if (title === 'The Minimalist') {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
        } catch (error) {
            console.error('Error generating response:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Sorry, I encountered an error. Please check your API key and try again.',
                sender: 'ai',
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View
            style={[
                styles.messageBubble,
                item.sender === 'user' ? styles.userBubble : styles.aiBubble,
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
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{title || 'Coach'}</Text>
                    <Pressable onPress={() => setMessages([])} hitSlop={10}>
                        <Ionicons name="refresh-circle" size={28} color="#007AFF" />
                    </Pressable>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={isLoading ? (
                        <View style={[styles.messageBubble, styles.aiBubble]}>
                            <ActivityIndicator size="small" color="#000000" />
                        </View>
                    ) : null}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask your coach..."
                        placeholderTextColor="#A0A0A5"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={sendMessage}
                        returnKeyType="send"
                    />
                    <Pressable
                        style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
                        onPress={sendMessage}
                        disabled={isLoading}
                    >
                        <Text style={styles.sendButtonText}>Send</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    header: {
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F2F2F7',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    clearButtonText: {
        color: '#007AFF', // Standard iOS blue or brand color
        fontSize: 16,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 20,
        gap: 15,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 16,
        borderRadius: 24,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#000000',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#FFFFFF',
    },
    aiText: {
        color: '#000000',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#F2F2F7',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        gap: 10,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#000000',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonPressed: {
        opacity: 0.8,
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
});
