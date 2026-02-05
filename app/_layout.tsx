import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { SubscriptionProvider } from '@/components/SubscriptionProvider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

    if (Platform.OS === 'android') {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
      if (apiKey) {
        Purchases.configure({ apiKey });
      }
    } else if (Platform.OS === 'ios') {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
      if (apiKey) {
        Purchases.configure({ apiKey });
      }
    }
  }, []);

  return (
    <SubscriptionProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SubscriptionProvider>
  );
}
