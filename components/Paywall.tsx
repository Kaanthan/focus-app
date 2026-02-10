import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSubscription } from './SubscriptionProvider';

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
}

export default function Paywall({ visible, onClose }: PaywallProps) {
    const { purchasePackage, restorePurchases, offerings, isPro, setProStatus } = useSubscription();
    const [isPurchasing, setIsPurchasing] = React.useState(false);

    const handlePurchase = async () => {
        console.log("handlePurchase pressed. Offerings length:", offerings.length);

        // MOCK FALLBACK FOR TESTING
        if (offerings.length === 0) {
            console.log("No offerings found. Triggering MOCK purchase flow for testing.");
            Alert.alert(
                "Test Mode",
                "No RevenueCat offerings found. Simulate successful purchase?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Simulate Success",
                        onPress: async () => {
                            setIsPurchasing(true);
                            // Simulate network delay
                            setTimeout(() => {
                                setIsPurchasing(false);
                                Alert.alert("Success", "Mock purchase completed!");
                                setProStatus(true); // Manually unlock Pro for testing
                            }, 1500);
                        }
                    }
                ]
            );
            return;
        }

        setIsPurchasing(true);
        try {
            // Assuming the first package is the monthly one we want, or find by identifier
            const packageToBuy = offerings[0];
            await purchasePackage(packageToBuy);
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setIsPurchasing(true);
        try {
            await restorePurchases();
        } finally {
            setIsPurchasing(false);
        }
    };

    if (isPro) {
        // If they become pro while paywall is open, close it
        onClose();
        return null;
    }

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="light" />
                <View style={styles.content}>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={30} color="#8E8E93" />
                    </Pressable>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.header}>
                            {/* Placeholder for the generated Zen icon, replace URI when available */}
                            <Image
                                source={require('../assets/images/zen-icon.png')}
                                style={styles.icon}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>Focus Pro</Text>
                            <Text style={styles.subtitle}>Unlock The Minimalist</Text>
                        </View>

                        <View style={styles.features}>
                            <FeatureItem text="Unlimited Custom Coaches" />
                            <FeatureItem text="Access 'The Minimalist' Coach" />
                            <FeatureItem text="Automated Daily Nudges" />
                            <FeatureItem text="Support Independent Development" />
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <Text style={styles.price}>$9.99 / month</Text>
                        <Pressable
                            style={({ pressed }) => [styles.purchaseButton, pressed && styles.purchaseButtonPressed]}
                            onPress={handlePurchase}
                            disabled={isPurchasing}
                        >
                            {isPurchasing ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.purchaseButtonText}>Subscribe Now</Text>
                            )}
                        </Pressable>
                        <Pressable onPress={handleRestore} disabled={isPurchasing} style={{ padding: 10 }}>
                            <Text style={styles.restoreText}>Restore Purchases</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#000000" />
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        paddingBottom: 50,
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    closeButton: {
        alignSelf: 'flex-end',
        marginBottom: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    icon: {
        width: 80,
        height: 80,
        marginBottom: 20,
        borderRadius: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        color: '#8E8E93',
        fontWeight: '500',
    },
    features: {
        gap: 20,
        marginBottom: 40,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#3C3C43',
    },
    footer: {
        // marginTop: 'auto', // Removed as it's now below a flex: 1 ScrollView
        paddingTop: 20,
        alignItems: 'center',
        gap: 16,
    },
    price: {
        fontSize: 16,
        color: '#8E8E93',
        marginBottom: 8,
    },
    purchaseButton: {
        backgroundColor: '#000000',
        width: '100%',
        paddingVertical: 18,
        borderRadius: 28,
        alignItems: 'center',
    },
    purchaseButtonPressed: {
        opacity: 0.8,
    },
    purchaseButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    restoreText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
});
