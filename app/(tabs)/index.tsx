import { generateCoachDescription, generateCoachTitle, getUserContext } from '@/app/utils/CoachEngine';
import Paywall from '@/components/Paywall'; // Ensure this path is correct based on your file structure
import { useSubscription } from '@/components/SubscriptionProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function HomeScreen() {
  const router = useRouter();
  const { isPro } = useSubscription();
  const [streak, setStreak] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  // Default Coaches
  const defaultCoaches = [
    { title: 'The Solopreneur', description: 'Build in public and ship fast.', persona: '' },
    { title: 'The Minimalist', description: 'Cut the noise. Ruthless prioritization.', persona: '' },
    { title: 'The Habit Builder', description: 'Consistency and daily systems.', persona: '' },
  ];

  const [coaches, setCoaches] = useState(defaultCoaches);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachPersona, setNewCoachPersona] = useState('');

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          // Onboarding Check
          const context = await getUserContext();
          if (!context) {
            // If no context, force survey.
            // But valid point: if they just installed, they need to see something.
            // "appears before the Home screen"
            router.replace('/survey');
            return;
          }

          // Load Custom Coaches
          const savedCoaches = await AsyncStorage.getItem('custom_coaches');
          let customCoaches = [];
          if (savedCoaches) {
            customCoaches = JSON.parse(savedCoaches);
          }

          // Dynamic Persona Logic
          const dynamicTitle = generateCoachTitle(context, isPro);
          const dynamicDescription = generateCoachDescription(context, isPro);

          // NOTE: We don't need to generate the FULL prompt here, just the UI elements.
          // The ChatScreen will generate the prompt on the fly using CoachEngine.

          const updatedDefaults = [
            {
              title: dynamicTitle,
              description: dynamicDescription,
              persona: 'dynamic'
            },
            { title: 'The Minimalist', description: 'Cut the noise. Ruthless prioritization.', persona: '' },
            { title: 'The Habit Builder', description: 'Consistency and daily systems.', persona: '' },
          ];

          setCoaches([...updatedDefaults, ...customCoaches]);

        } catch (e) {
          console.error('Failed to load data', e);
        }
      };

      loadData();
    }, [isPro])
  );

  const handleRetunePress = () => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }
    router.push('/survey');
  };

  const handleCreateCoachPress = async () => {
    // Morph Logic:
    // If Free -> Paywall
    // If Pro -> Check if Survey done -> If so, maybe edit? Or if not done -> Survey

    if (!isPro) {
      setShowPaywall(true);
      return;
    }

    // Check if survey is done (Simple check for now, can be more robust)
    try {
      const userPersona = await AsyncStorage.getItem('user_persona');
      if (!userPersona) {
        router.push('/survey');
      } else {
        // If already done, maybe allow editing or show custom creation?
        // For now, let's stick to the "Custom Coach" creation flow if they are Pro, 
        // but maybe "Morph" specifically refers to the dynamic persona.
        // The prompt says "The 'Morph' Logic in Home... If Pro, use survey data to dynamically set...".
        // It implies the "Standard Coach" card itself changes.

        // Let's implement the "Create Coach" as the manual flow (capped at 1 for free, unlimited for pro).
        // And the "Standard Coach" card becomes the "Dynamic Persona" card for Pro users.

        // So we need to RE-READ the "Standard Coach" logic.
        // But valid point: if they want to RE-TAKE survey, maybe this button can do it?
        // Let's stick to the manual creation flow for this button for now, as implemented.
        // But we need a WAY to trigger the survey if they are Pro and haven't done it.
        // Maybe a banner? or just on mount?

        // Re-reading usage of current "Create New Coach" button:
        // "If a Free user taps the 'Morph' button... trigger Paywall."
        // Currently the button is "Create New Coach".

        setIsModalVisible(true);
      }
    } catch (e) {
      console.error("Error checking persona", e);
      setIsModalVisible(true);
    }
  };

  const saveCustomCoach = async () => {
    if (!newCoachName.trim() || !newCoachPersona.trim()) return;

    const newCoach = { title: newCoachName, description: 'Custom Coach', persona: newCoachPersona };
    const updatedList = [...coaches, newCoach];
    setCoaches(updatedList);

    // Filter out defaults before saving
    const customOnly = updatedList.slice(defaultCoaches.length);
    await AsyncStorage.setItem('user_custom_coaches', JSON.stringify(customOnly));

    setIsModalVisible(false);
    setNewCoachName('');
    setNewCoachPersona('');
  };

  const handleCardPress = async (title: string, persona: string) => {
    if (title === 'The Minimalist' && !isPro) {
      setShowPaywall(true);
      return;
    }

    router.push({
      pathname: '/chat',
      params: { title, persona },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Daily Focus</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Pressable onPress={handleRetunePress}>
                <Text style={{ fontSize: 14, color: '#007AFF', fontWeight: 'bold' }}>Retune</Text>
              </Pressable>
              {streak > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Text style={{ fontSize: 14 }}>🔥 {streak}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardsContainer}>
          {coaches.map((coach, index) => (
            <CoachCard
              key={index}
              title={coach.title}
              description={coach.description}
              onPress={() => handleCardPress(coach.title, coach.persona)}
            />
          ))}

          <Pressable
            style={[styles.card, { borderStyle: 'dashed', borderWidth: 2, borderColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: 20 }]}
            onPress={handleCreateCoachPress}
          >
            <Text style={{ fontSize: 18, color: '#007AFF', fontWeight: 'bold' }}>＋ Create New Coach</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Simple Modal for New Coach */}
      {isModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Create Custom Coach</Text>

              <TextInput
                placeholder="Coach Name (e.g. The Stoic)"
                style={{ backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 16 }}
                value={newCoachName}
                onChangeText={setNewCoachName}
              />

              <TextInput
                placeholder="Persona (e.g. Answer like Marcus Aurelius, focus on control)"
                style={{ backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, marginBottom: 24, fontSize: 16, height: 100, textAlignVertical: 'top' }}
                multiline
                value={newCoachPersona}
                onChangeText={setNewCoachPersona}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setIsModalVisible(false)} style={{ flex: 1, padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: 'bold' }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveCustomCoach} style={{ flex: 1, backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
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
