import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSubscription } from '@/components/SubscriptionProvider';
import RevenueCatUI from 'react-native-purchases-ui';

export default function HomeScreen() {
  const router = useRouter();
  const { isPro } = useSubscription();

  const handleCardPress = async (title: string) => {
    if (title === 'The Minimalist' && !isPro) {
      try {
        const paywallResult = await RevenueCatUI.presentPaywall();
        // Check if the user is now pro after the paywall interaction
        // specifically for the case where they might have restored or purchased
        if (paywallResult === RevenueCatUI.PAYWALL_RESULT.PURCHASED || paywallResult === RevenueCatUI.PAYWALL_RESULT.RESTORED) {
          router.push({
            pathname: '/chat',
            params: { title },
          });
        }
      } catch (e) {
        console.error("Paywall error", e);
      }
      return;
    }

    router.push({
      pathname: '/chat',
      params: { title },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Daily Focus</Text>
        </View>

        <View style={styles.cardsContainer}>
          <CoachCard
            title="The Solopreneur"
            description="Build in public and ship fast."
            onPress={() => handleCardPress('The Solopreneur')}
          />
          <CoachCard
            title="The Minimalist"
            description="Cut the noise. Ruthless prioritization."
            onPress={() => handleCardPress('The Minimalist')}
          />
          <CoachCard
            title="The Habit Builder"
            description="Consistency and daily systems."
            onPress={() => handleCardPress('The Habit Builder')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CoachCard({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3, // for Android
    minHeight: 120,
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardContent: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  cardDescription: {
    fontSize: 16,
    color: '#3C3C43',
    opacity: 0.6,
    lineHeight: 22,
  },
});
