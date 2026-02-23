import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from './SubscriptionProvider';

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
}

export default function Paywall({ visible, onClose }: PaywallProps) {
    const { purchasePackage, restorePurchases, offerings, isPro, setProStatus } = useSubscription();
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

    // Auto-select annual if available, else monthly
    useEffect(() => {
        if (offerings.length > 0 && !selectedPackage) {
            const annual = offerings.find(p => p.packageType === 'ANNUAL');
            const monthly = offerings.find(p => p.packageType === 'MONTHLY');
            setSelectedPackage(annual || monthly || offerings[0]);
        }
    }, [offerings]);

    const handlePurchase = async () => {
        if (!selectedPackage) return;

        console.log("handlePurchase pressed for:", selectedPackage.identifier);

        // MOCK FALLBACK (If no empty offerings in DEV, or for testing)
        // In this specific user case, they likely have real offerings, but we keep safety.

        setIsPurchasing(true);
        try {
            await purchasePackage(selectedPackage);
        } catch (e) {
            console.error(e);
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
        onClose();
        return null;
    }

    const annualPackage = offerings.find(p => p.packageType === 'ANNUAL');
    const monthlyPackage = offerings.find(p => p.packageType === 'MONTHLY');

    // MOCK DATA for visualization if no offerings loaded yet (optional, better to show spinner)
    const displayAnnual = annualPackage || {
        product: { priceString: "$83.99" },
        packageType: 'ANNUAL',
        identifier: 'mock_annual'
    } as any;

    const displayMonthly = monthlyPackage || {
        product: { priceString: "$9.99" },
        packageType: 'MONTHLY',
        identifier: 'mock_monthly'
    } as any;

    const isLoadingOfferings = offerings.length === 0;

    // Fix for "Purchase Error": If no packages and not just loading, show status
    if (visible && isLoadingOfferings) {
        // You might want to trigger a retry here or just show a status
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
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.content}>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#8E8E93" />
                        </Pressable>

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.header}>
                                <Image
                                    source={require('../assets/images/zen-icon.png')}
                                    style={styles.icon}
                                    resizeMode="contain"
                                />
                                <Text style={styles.title}>Focus Pro</Text>
                                <Text style={styles.subtitle}>Unlock The System</Text>
                            </View>

                            <View style={styles.features}>
                                <FeatureItem text="Unlimited Custom Architects" />
                                <FeatureItem text="Access 'The Minimalist' Coach" />
                                <FeatureItem text="Automated Daily Standups" />
                            </View>

                            {isLoadingOfferings ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#000" />
                                    <Text style={styles.loadingText}>Connecting to Store...</Text>
                                </View>
                            ) : (
                                <View style={styles.plansContainer}>
                                    {/* Annual Plan */}
                                    <Pressable
                                        style={[
                                            styles.planCard,
                                            selectedPackage === displayAnnual && styles.selectedCard,
                                            { marginBottom: 12 }
                                        ]}
                                        onPress={() => setSelectedPackage(displayAnnual)}
                                    >
                                        <View style={styles.badgeContainer}>
                                            <View style={styles.badge}>
                                                <Text style={styles.badgeText}>BEST VALUE</Text>
                                            </View>
                                        </View>
                                        <View style={styles.planContent}>
                                            <View>
                                                <Text style={styles.planTitle}>Annual</Text>
                                                <Text style={styles.planSubtitle}>First 7 days free</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.planPrice}>{displayAnnual.product.priceString}</Text>
                                                <Text style={styles.planPeriod}>/year</Text>
                                            </View>
                                        </View>
                                    </Pressable>

                                    {/* Monthly Plan */}
                                    <Pressable
                                        style={[
                                            styles.planCard,
                                            selectedPackage === displayMonthly && styles.selectedCard
                                        ]}
                                        onPress={() => setSelectedPackage(displayMonthly)}
                                    >
                                        <View style={styles.planContent}>
                                            <View>
                                                <Text style={styles.planTitle}>Monthly</Text>
                                                <Text style={styles.planSubtitle}>Cancel anytime</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.planPrice}>{displayMonthly.product.priceString}</Text>
                                                <Text style={styles.planPeriod}>/month</Text>
                                            </View>
                                        </View>
                                    </Pressable>
                                </View>
                            )}

                        </ScrollView>

                        <View style={styles.footer}>
                            <Pressable
                                style={({ pressed }) => [styles.purchaseButton, pressed && styles.purchaseButtonPressed, (isPurchasing || isLoadingOfferings) && { opacity: 0.7 }]}
                                onPress={handlePurchase}
                                disabled={isPurchasing || isLoadingOfferings}
                            >
                                {isPurchasing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.purchaseButtonText}>
                                        {isLoadingOfferings ? "Please wait..." : `Subscribe for ${selectedPackage?.product.priceString || "$--"}`}
                                    </Text>
                                )}
                            </Pressable>
                            <Pressable onPress={handleRestore} disabled={isPurchasing} style={{ padding: 10 }}>
                                <Text style={styles.restoreText}>Restore Purchases</Text>
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    )
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
        backgroundColor: 'rgba(0,0,0,0.5)', // Darker dim
    },
    safeArea: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 20,
        height: '90%', // Slightly less than full height
        shadowColor: '#000',
        elevation: 5,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    closeButton: {
        alignSelf: 'flex-end',
        marginBottom: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
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
    },
    subtitle: {
        fontSize: 18,
        color: '#8E8E93',
        fontWeight: '500',
    },
    features: {
        gap: 16,
        marginBottom: 30,
        paddingHorizontal: 10,
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
    plansContainer: {
        marginBottom: 20,
    },
    planCard: {
        backgroundColor: '#F2F2F7',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: '#000',
        backgroundColor: '#fff',
    },
    planContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    planTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    planSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    planPrice: {
        fontSize: 18,
        fontWeight: '600',
    },
    planPeriod: {
        fontSize: 14,
        color: '#666',
    },
    badgeContainer: {
        position: 'absolute',
        top: -12,
        right: 12,
        zIndex: 10,
    },
    badge: {
        backgroundColor: 'gold',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    footer: {
        paddingTop: 10,
        alignItems: 'center',
        gap: 12,
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
