import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/components/AuthProvider';
import { SubscriptionProvider } from '@/components/SubscriptionProvider';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Ignore specific development warnings
LogBox.ignoreLogs([
  'GoogleGenerativeAI Error',
  'Error sending message',
  'The native view manager for module',
]);

// Prevent the splash screen from auto-hiding before asset loading is complete.

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // MOCK NOTIFICATIONS (Day 5 Feature)
    console.log('🔔 [Mock] Scheduling Notification: "What is your ONE thing?" for 9:00 AM');
    console.log('🔔 [Mock] Scheduling Notification: "Did you ship it?" for 5:00 PM');
  }, []);

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
