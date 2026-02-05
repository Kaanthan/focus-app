import React, { createContext, useContext, useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';

interface SubscriptionContextType {
    isPro: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({ isPro: false });

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
    const [isPro, setIsPro] = useState(false);

    useEffect(() => {
        const checkSubscription = async () => {
            try {
                const customerInfo = await Purchases.getCustomerInfo();
                const isActive = customerInfo.entitlements.active['Focus App Pro'] !== undefined;
                console.log('Current Pro Status for Focus App Pro: ' + isActive);
                if (isActive) {
                    setIsPro(true);
                }
            } catch (e) {
                // Error fetching customer info
                console.error("Error fetching customer info", e);
            }
        };

        checkSubscription();

        // Listen for updates
        const customerInfoUpdated = async (info: any) => {
            const isActive = info.entitlements.active['Focus App Pro'] !== undefined;
            console.log('Current Pro Status for Focus App Pro (Listener): ' + isActive);
            if (isActive) {
                setIsPro(true);
            } else {
                setIsPro(false);
            }
        }

        try {
            Purchases.addCustomerInfoUpdateListener(customerInfoUpdated);
        } catch (e) {
            console.log("Error adding listener", e)
        }

        return () => {
            try {
                Purchases.removeCustomerInfoUpdateListener(customerInfoUpdated);
            } catch (e) {
                console.log("Error removing listener", e)
            }
        };
    }, []);

    return (
        <SubscriptionContext.Provider value={{ isPro }}>
            {children}
        </SubscriptionContext.Provider>
    );
};
