import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

interface SubscriptionContextType {
    isPro: boolean;
    purchasePackage: (pack: PurchasesPackage) => Promise<void>;
    restorePurchases: () => Promise<void>;
    offerings: PurchasesPackage[];
    setProStatus: (status: boolean) => void; // For debug/testing
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isPro: false,
    purchasePackage: async () => { },
    restorePurchases: async () => { },
    offerings: [],
    setProStatus: () => { }
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
    const [isPro, setIsPro] = useState(false);
    const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);

    useEffect(() => {
        const initPurchases = async () => {
            if (Platform.OS === 'web' || Constants.appOwnership === 'expo') {
                console.log("RevenueCat not supported on web or Expo Go client");
                return;
            }

            const apiKey = Platform.OS === 'android'
                ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
                : process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

            if (apiKey) {
                console.log("Configuring RevenueCat with API Key ending in:", apiKey.slice(-4));
                await Purchases.configure({ apiKey });

                // Load data after config
                await checkSubscription(); // Wait for this
                loadOfferings();

                Purchases.addCustomerInfoUpdateListener(customerInfoUpdated);

                // FORCE IDENTITY SYNC ON MOUNT
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    console.log("Mount Sync: Logging into RevenueCat with", session.user.id);
                    await Purchases.logIn(session.user.id);
                    // Re-check subscription after login to be sure
                    await checkSubscription();
                }
            } else {
                console.warn("No RevenueCat API Key found for this platform. App running in Mock Mode.");
            }
        };

        const checkSubscription = async () => {
            try {
                console.log("Fetching customer info...");
                const customerInfo = await Purchases.getCustomerInfo();
                const isActive = customerInfo.entitlements.active['Focus App Pro'] !== undefined; // Use correct entitlement ID
                if (isActive) setIsPro(true);
            } catch (e: any) {
                console.log("Error fetching customer info", e);
            }
        };

        const loadOfferings = async () => {
            try {
                console.log("Fetching offerings...");
                const offerings = await Purchases.getOfferings();
                // Fallback check changed to be handled in UI, but we keep this for data loading
                if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                    // console.log("Setting available packages:", offerings.current.availablePackages.length);
                    setOfferings(offerings.current.availablePackages);
                } else {
                    console.log("No current offerings found or availablePackages empty.");
                }
            } catch (e) {
                console.log("Error fetching offerings", e);
            }
        };

        const customerInfoUpdated = (info: any) => {
            const isActive = info.entitlements.active['Focus App Pro'] !== undefined;
            setIsPro(isActive);
        }

        initPurchases();

        // AUTH LISTENER FOR IDENTITY SYNC
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return;

            if (event === 'SIGNED_IN' && session?.user) {
                try {
                    console.log("Identifying user with RevenueCat:", session.user.id);
                    const { customerInfo } = await Purchases.logIn(session.user.id);
                    // Update Status Immediately based on this user's info
                    const isActive = customerInfo.entitlements.active['Focus App Pro'] !== undefined;
                    setIsPro(isActive);
                    console.log("RevenueCat Login Success. Pro Status:", isActive);
                } catch (e) {
                    console.error("RevenueCat Login Error:", e);
                }
            } else if (event === 'SIGNED_OUT') {
                try {
                    console.log("Resetting RevenueCat identity");
                    await Purchases.logOut();
                    // After logout, we are anonymous. 
                    // Usually anonymous users don't have Pro unless they just bought it on this device without logging in.
                    // safely assume false for safety, or checkPurchases() again if we want to support device-based pro.
                    // For this app, "Logout" implies clearing user data, so strict reset is safer.
                    setIsPro(false);
                    console.log("RevenueCat Logout Success. Pro cleared.");
                } catch (e) {
                    console.error("RevenueCat Logout Error:", e);
                    // Force clear anyway
                    setIsPro(false);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
            if (Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
                Purchases.removeCustomerInfoUpdateListener(customerInfoUpdated);
            }
        };
    }, []);

    const purchasePackage = async (pack: PurchasesPackage) => {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pack);
            if (customerInfo.entitlements.active['Focus App Pro'] !== undefined) {
                setIsPro(true);
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert("Purchase Error", e.message);
            }
        }
    };

    const restorePurchases = async () => {
        try {
            const customerInfo = await Purchases.restorePurchases();
            if (customerInfo.entitlements.active['Focus App Pro'] !== undefined) {
                setIsPro(true);
                Alert.alert("Success", "Your purchases have been restored.");
            } else {
                Alert.alert("No Purchases", "No active subscriptions found to restore.");
            }
        } catch (e: any) {
            Alert.alert("Restore Error", e.message);
        }
    };

    return (
        <SubscriptionContext.Provider value={{ isPro, purchasePackage, restorePurchases, offerings, setProStatus: setIsPro }}>
            {children}
        </SubscriptionContext.Provider>
    );
};
