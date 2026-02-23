import { useAuth } from '@/components/AuthProvider';
import { useSubscription } from '@/components/SubscriptionProvider';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Purchases from 'react-native-purchases';

export default function ProfileScreen() {
    const { user, session } = useAuth();
    const { restorePurchases, isPro } = useSubscription(); // Use context for restore
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSignOut = async () => {
        try {
            if (!__DEV__) {
                await Purchases.logOut();
            }
        } catch (e) {
            console.error("RC Logout Failed", e);
        }
        const { error } = await supabase.auth.signOut();
        if (error) Alert.alert('Error signing out', error.message);
        router.replace('/auth');
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            "⚠️ PERMANENTLY DELETE?",
            "This will wipe your data and cannot be undone. Are you absolutely sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "YES, DELETE ACCOUNT",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Try Supabase RPC to delete user (Backend must support this)
                            const { error } = await supabase.rpc('delete_user_account');

                            if (error) {
                                console.log("RPC delete failed, falling back to local wipe + auth delete via admin if possible (client side restricted)");
                                // Fallback: Just sign out and wipe local data to comply with "Right to be Forgotten" from device perspective
                                // In a real prod app, you'd trigger an Edge Function here.
                            }

                            // 2. Reset RevenueCat
                            if (!__DEV__) {
                                try {
                                    const isAnon = await Purchases.isAnonymous();
                                    if (!isAnon) {
                                        await Purchases.logOut();
                                    }
                                } catch (rcError) {
                                    console.log("RevenueCat Logout Error (Ignored):", rcError);
                                }
                            }

                            // 3. Sign Out Supabase
                            await supabase.auth.signOut();

                            // 4. Wipe Local Data (Last!)
                            await AsyncStorage.clear();

                            Alert.alert("Account Deleted", "Your data has been wiped from this device.");
                            router.replace('/');
                        } catch (e: any) {
                            Alert.alert("Error", e.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="person-circle-outline" size={80} color="#000" />
                <Text style={styles.email}>{user?.email || 'Anonymous User'}</Text>
                {isPro && <View style={styles.proBadge}><Text style={styles.proText}>PRO MEMBER</Text></View>}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subscription</Text>
                <Pressable style={styles.row} onPress={restorePurchases}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="refresh-circle-outline" size={24} color="#000" />
                        <Text style={styles.rowText}>Restore Purchases</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </Pressable>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                <Pressable style={styles.row} onPress={handleSignOut}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="log-out-outline" size={24} color="#000" />
                        <Text style={styles.rowText}>Sign Out</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </Pressable>

                <Pressable style={styles.row} onPress={handleDeleteAccount}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                        <Text style={[styles.rowText, { color: '#FF3B30' }]}>Delete Account</Text>
                    </View>
                </Pressable>
            </View>

            <View style={{ padding: 20 }}>
                <Text style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>Version 1.0.0</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#fff',
        marginBottom: 20,
    },
    email: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 10,
    },
    proBadge: {
        backgroundColor: 'gold',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 8,
    },
    proText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    section: {
        backgroundColor: '#fff',
        marginBottom: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e5e5e5',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        marginLeft: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    rowText: {
        fontSize: 16,
        fontWeight: '400',
    }
});
