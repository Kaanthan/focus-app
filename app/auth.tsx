import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) Alert.alert(error.message);
        setLoading(false);
        if (!error) {
            // Navigate to Paywall or Home based on logic, but typically Paywall first for new users
            // For now, let's assume we want to upsell immediately after auth
            router.replace('/');
        }
    }

    async function signUpWithEmail() {
        setLoading(true);
        const {
            data: { session },
            error,
        } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) Alert.alert(error.message);
        else if (!session) Alert.alert('Please check your inbox for email verification!');

        setLoading(false);
        if (session) {
            router.replace('/');
        }
    }

    return (
        <View style={styles.container}>
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Ionicons name="finger-print" size={64} color="#000" style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text style={styles.title}>Focus Architect</Text>
                <Text style={styles.subtitle}>Sign in to save your persona.</Text>
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
                    onPress={isSignUp ? signUpWithEmail : signInWithEmail}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{isSignUp ? "Sign Up" : "Sign In"}</Text>}
                </Pressable>
            </View>

            <View style={styles.verticallySpaced}>
                <Pressable onPress={() => setIsSignUp(!isSignUp)} disabled={loading} style={{ alignItems: 'center', padding: 10 }}>
                    <Text style={styles.secondaryText}>{isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}</Text>
                </Pressable>
            </View>

            {/* Skip for Dev/Testing if needed, but per requirements we enforce Auth */}
        </View>
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
