import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingProfile, setCheckingProfile] = useState(false); // New state for "Gatekeeping" check
    const [mode, setMode] = useState<'login' | 'signup'>('login'); // Strict Mode State

    // Helper to check profile and redirect
    const checkProfileAndRedirect = async (userId: string) => {
        setCheckingProfile(true);
        try {
            // Check Supabase Profile
            const { data, error } = await supabase
                .from('profiles')
                .select('onboarding_completed')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 is "Row not found", which is expected for new users sometimes if trigger failed
                console.error("Error fetching profile:", error);
            }

            if (data?.onboarding_completed) {
                // User has finished survey -> Home
                // Sync local cache
                await AsyncStorage.setItem('onboarding_completed', 'true');
                router.replace('/');
            } else {
                // User exists but hasn't finished survey -> Survey
                router.replace('/survey');
            }
        } catch (e) {
            console.error("Profile check failed", e);
            router.replace('/survey'); // Fallback safe
        } finally {
            setCheckingProfile(false);
        }
    };

    async function handleAuth() {
        setLoading(true);
        try {
            if (mode === 'login') {
                // STRICT LOGIN
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    Alert.alert("Login Failed", error.message); // Likely "Invalid login credentials"
                    setLoading(false);
                    return;
                }

                if (data.session?.user) {
                    await checkProfileAndRedirect(data.session.user.id);
                }
            } else {
                // STRICT SIGNUP
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) {
                    Alert.alert("Registration Failed", error.message); // Likely is "User already registered"
                    setLoading(false);
                    return;
                }

                if (data.session?.user) {
                    // Create Profile entry immediately to lock them in
                    // Optional: If you use a Trigger in SQL, this might be redundant, but safe to do here too.
                    const { error: profileError } = await supabase.from('profiles').upsert({
                        id: data.session.user.id,
                        onboarding_completed: false, // Explicitly false
                        updated_at: new Date().toISOString()
                    });

                    if (profileError) console.log("Initial profile creation warning:", profileError);

                    // New users go to survey
                    router.replace('/survey');
                } else {
                    Alert.alert('Check your inbox', 'Please check your inbox for email verification!');
                }
            }
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Ionicons name="finger-print" size={64} color="#000" style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text style={styles.title}>Focus Architect</Text>
                <Text style={styles.subtitle}>
                    {mode === 'login' ? "Sign in to your workspace." : "Create your account."}
                </Text>
            </View>

            <View style={[styles.verticallySpaced, styles.mt20]}>
                <TextInput
                    onChangeText={(text) => setEmail(text)}
                    value={email}
                    placeholder="email@address.com"
                    autoCapitalize={'none'}
                    style={styles.input}
                    placeholderTextColor="#999"
                />
            </View>
            <View style={styles.verticallySpaced}>
                <TextInput
                    onChangeText={(text) => setPassword(text)}
                    value={password}
                    secureTextEntry={true}
                    placeholder="Password"
                    autoCapitalize={'none'}
                    style={styles.input}
                    placeholderTextColor="#999"
                />
            </View>

            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Pressable
                    style={[styles.button, styles.primaryButton]}
                    onPress={handleAuth}
                    disabled={loading || checkingProfile}
                >
                    {loading || checkingProfile ? (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <ActivityIndicator color="white" />
                            {checkingProfile && <Text style={{ color: 'white' }}>Checking profile...</Text>}
                        </View>
                    ) : (
                        <Text style={styles.buttonText}>{mode === 'login' ? "Sign In" : "Sign Up"}</Text>
                    )}
                </Pressable>
            </View>

            {mode === 'login' && (
                <View style={styles.verticallySpaced}>
                    <Pressable
                        onPress={async () => {
                            if (!email) {
                                Alert.alert("Error", "Please enter your email address first.");
                                return;
                            }
                            setLoading(true);
                            try {
                                const { error } = await supabase.auth.resetPasswordForEmail(email);
                                if (error) throw error;
                                Alert.alert("Success", "Check your email for the password reset link.");
                            } catch (error: any) {
                                Alert.alert("Error", error.message);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading || checkingProfile}
                        style={{ alignItems: 'center', padding: 10 }}
                    >
                        <Text style={[styles.secondaryText, { fontSize: 14 }]}>Forgot Password?</Text>
                    </Pressable>
                </View>
            )
            }

            <View style={styles.verticallySpaced}>
                <Pressable
                    onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    disabled={loading || checkingProfile}
                    style={{ alignItems: 'center', padding: 10 }}
                >
                    <Text style={styles.secondaryText}>
                        {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </Text>
                </Pressable>
            </View>

            {/* Skip for Dev/Testing if needed, but per requirements we enforce Auth */}
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 40,
        padding: 12,
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center'
    },
    verticallySpaced: {
        paddingTop: 4,
        paddingBottom: 4,
        alignSelf: 'stretch',
    },
    mt20: {
        marginTop: 20,
    },
    input: {
        backgroundColor: '#F2F2F7',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
    },
    button: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#000',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryText: {
        color: '#666',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    }
});
