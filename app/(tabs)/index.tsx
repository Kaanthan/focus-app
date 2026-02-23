import { getUserContext } from '@/app/utils/CoachEngine';
import Paywall from '@/components/Paywall'; // Ensure this path is correct based on your file structure
import { useSubscription } from '@/components/SubscriptionProvider';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
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
  const [customCoaches, setCustomCoaches] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachPersona, setNewCoachPersona] = useState('');

  // Retune Modal State
  const [isRetuneModalVisible, setIsRetuneModalVisible] = useState(false);
  const [retunePursuit, setRetunePursuit] = useState('');
  const [retuneNoise, setRetuneNoise] = useState('');
  const [isRetuning, setIsRetuning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          // 1. Get Session
          const { data: { session } } = await supabase.auth.getSession();
          let context = null;

          if (session?.user) {
            // Load Custom Coaches first (independent of session mostly, but good to have)
            const savedCustom = await AsyncStorage.getItem('user_custom_coaches');
            if (savedCustom) {
              const parsed = JSON.parse(savedCustom);
              setCustomCoaches(parsed);
            }

            // 2. Try Fetch from Supabase (Source of Truth)
            const { data, error } = await supabase
              .from('profiles')
              .select('persona_data, onboarding_completed')
              .eq('id', session.user.id)
              .maybeSingle(); // Use maybeSingle to handle 'Not Found' gracefully

            // Handle Deleted/Missing Profile
            if (!data && !error) {
              console.log("User has session but no profile (Likely Deleted). Forcing Logout.");
              await supabase.auth.signOut();
              await AsyncStorage.clear(); // Nuke everything
              router.replace('/auth');
              return;
            }

            // 2.5 STALE CACHE CHECK
            // Check if we have a stored user ID. If it differs, CLEAR EVERYTHING.
            const lastUserId = await AsyncStorage.getItem('last_user_id');
            if (lastUserId !== session.user.id) {
              console.log("New User Detected! Clearing stale cache...");
              await AsyncStorage.removeItem('ai_personas');
              await AsyncStorage.removeItem('user_persona');
              await AsyncStorage.setItem('last_user_id', session.user.id);
              // Also clear context variable to force fetch/regen
              context = null;
            }

            if (data?.persona_data) {
              context = data.persona_data;
              // Update local cache while we are at it
              await AsyncStorage.setItem('user_persona', JSON.stringify(context));
            } else {
              // Fallback to local if DB fails or empty
              const local = await getUserContext();
              context = local;
            }

            // Explicit Check for Onboarding Status
            const localCompleted = await AsyncStorage.getItem('onboarding_completed');
            let isCompleted = data?.onboarding_completed;

            if (localCompleted === 'true') {
              // Local completion takes precedence (optimistic)
              isCompleted = true;
            } else if (isCompleted === undefined || isCompleted === null) {
              // Fallback if local is empty and DB is empty
              isCompleted = false;
            }

            if (isCompleted !== true) {
              console.log("User onboarding not complete (DB: " + data?.onboarding_completed + ", Local: " + localCompleted + "), redirecting to survey.");
              router.replace('/survey');
              return;
            }
          } else {
            // No session -> Redirect to Login/Signup first
            // We want to force authentication before onboarding
            console.log("No session found, redirecting to Auth.");
            router.replace('/auth');
            return;
          }

          // ... (fetch session logic remains)

          if (!context) {
            // ... (redirect logic remains)
            console.log("No context found, redirecting to survey.");
            router.replace('/survey');
            return;
          }

          // ... (custom coaches logic remains)

          // Dynamic Persona Logic
          let displayedCoaches = [];

          if (context) {
            // 1. Try to get cached AI personas
            if (context.ai_personas && context.ai_personas.length > 0) {
              displayedCoaches = context.ai_personas;
              await AsyncStorage.setItem('ai_personas', JSON.stringify(displayedCoaches));
            }

            // 2. If empty, check local storage
            if (displayedCoaches.length === 0) {
              const cachedPersonas = await AsyncStorage.getItem('ai_personas');
              if (cachedPersonas) {
                const parsed = JSON.parse(cachedPersonas);
                if (parsed.length > 0) displayedCoaches = parsed;
              }
            }

            // 3. GENERATION TRAP
            // If we are Pro, and we STILL don't have displayed coaches (or they are defaults),
            // We MUST generate them.
            if (isPro && displayedCoaches.length === 0) {
              console.log("User is Pro but has no AI cards. Generating now...");
              // Show loading state or skeleton here if possible, for now just log

              import('@/app/utils/CoachEngine').then(async (module) => {
                try {
                  const aiPersonas = await module.generatePersonas(context);
                  if (aiPersonas && aiPersonas.length > 0) {
                    displayedCoaches = aiPersonas;
                    await AsyncStorage.setItem('ai_personas', JSON.stringify(aiPersonas));

                    // Sync to Supabase
                    const updatedContext = { ...context, ai_personas: aiPersonas };
                    await supabase.from('profiles').update({
                      persona_data: updatedContext
                    }).eq('id', session.user.id);

                    // Update UI immediately
                    setCoaches([...aiPersonas, ...customCoaches]);
                  }
                } catch (err) {
                  console.error("Generation failed", err);
                }
              });
            } else if (!isPro && displayedCoaches.length === 0) {
              // Free user, no AI cards yet -> Generate them anyway! 
              // We want free users to SEE them, just not open them (handled by lock logic).
              // So we use the SAME logic.
              console.log("Generating AI Personas for Free User...");
              import('@/app/utils/CoachEngine').then(async (module) => {
                const aiPersonas = await module.generatePersonas(context);
                displayedCoaches = aiPersonas;
                await AsyncStorage.setItem('ai_personas', JSON.stringify(aiPersonas));
                const updatedContext = { ...context, ai_personas: aiPersonas };
                await supabase.from('profiles').update({ persona_data: updatedContext }).eq('id', session.user.id);
                setCoaches([...aiPersonas, ...customCoaches]);
              });
            }
          }

          // Final Fallback if generation is pending or failed
          if (displayedCoaches.length === 0) {
            displayedCoaches = defaultCoaches;
          }

          setCoaches([...displayedCoaches, ...customCoaches]);

        } catch (e) {
          console.error('Failed to load data', e);
        }
      };

      loadData();
    }, [isPro])
  );

  const handleRetunePress = async () => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }

    try {
      const jsonValue = await AsyncStorage.getItem('user_persona');
      const context = jsonValue != null ? JSON.parse(jsonValue) : null;
      if (context) {
        setRetunePursuit(context.pursuit || '');
        setRetuneNoise(context.noise || '');
      }
      setIsRetuneModalVisible(true);
    } catch (e) {
      console.error("Error loading context for retune", e);
    }
  };

  const saveRetune = async () => {
    if (!retunePursuit.trim() || !retuneNoise.trim()) return;
    setIsRetuning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // 1. Get Current Context
      const jsonValue = await AsyncStorage.getItem('user_persona');
      const currentContext = jsonValue != null ? JSON.parse(jsonValue) : {};

      // 2. Update Context
      const updatedContext = {
        ...currentContext,
        pursuit: retunePursuit,
        noise: retuneNoise,
        // Clear old personas to force regen
        ai_personas: []
      };

      // 3. Save Local & DB
      await AsyncStorage.setItem('user_persona', JSON.stringify(updatedContext));
      await AsyncStorage.removeItem('ai_personas'); // Clear cache

      await supabase.from('profiles').update({
        persona_data: updatedContext
      }).eq('id', session.user.id);

      // 4. Regenerate Personas Immediately
      const module = await import('@/app/utils/CoachEngine');
      const aiPersonas = await module.generatePersonas(updatedContext);

      // 5. Update UI
      await AsyncStorage.setItem('ai_personas', JSON.stringify(aiPersonas));

      // Update updatedContext with new personas for DB sync (optional but good)
      updatedContext.ai_personas = aiPersonas;
      await supabase.from('profiles').update({
        persona_data: updatedContext
      }).eq('id', session.user.id);

      setCoaches([...aiPersonas, ...customCoaches]);

      setIsRetuneModalVisible(false);
    } catch (e) {
      console.error("Retune failed", e);
    } finally {
      setIsRetuning(false);
    }
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

  const [editingCoachIndex, setEditingCoachIndex] = useState<number | null>(null);

  const handleLongPress = (index: number) => {
    // Allow editing for ALL users (Requested by User)
    setEditingCoachIndex(index);
    setNewCoachName(coaches[index].title);
    setNewCoachPersona(coaches[index].persona);
    setIsModalVisible(true);
  };

  const saveCustomCoach = async () => {
    if (!newCoachName.trim() || !newCoachPersona.trim()) return;

    let updatedList = [...coaches];

    if (editingCoachIndex !== null) {
      // Edit Mode
      updatedList[editingCoachIndex] = {
        ...updatedList[editingCoachIndex],
        title: newCoachName,
        persona: newCoachPersona
      };
    } else {
      // Create Mode
      const newCoach = { title: newCoachName, description: 'Custom Coach', persona: newCoachPersona };
      updatedList = [...coaches, newCoach];
    }

    setCoaches(updatedList);

    // SYNC LOGIC
    // We assume the first 3 are "AI/Standard" and the rest are "Custom".
    // Or loosely: if it's in the first 3 indices, it's likely an AI persona we want to save to 'ai_personas'.

    // 1. Separate AI Personas (derived from first few) vs Custom (extras)
    // This is a bit loose but works for our "3 dynamic cards" logic.
    const aiPersonasToSync = updatedList.slice(0, 3);
    const customCoachesToSave = updatedList.slice(3);

    // 2. Save Custom to Local
    await AsyncStorage.setItem('user_custom_coaches', JSON.stringify(customCoachesToSave));

    // 3. Save AI Personas to Local & Supabase
    if (editingCoachIndex !== null && editingCoachIndex < 3) {
      await AsyncStorage.setItem('ai_personas', JSON.stringify(aiPersonasToSync));

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Fetch current context to merge
          const { data } = await supabase.from('profiles').select('persona_data').eq('id', session.user.id).single();
          const currentContext = data?.persona_data || {};

          await supabase.from('profiles').update({
            persona_data: { ...currentContext, ai_personas: aiPersonasToSync }
          }).eq('id', session.user.id);
          console.log("Synced renamed AI persona to Supabase");
        }
      } catch (e) {
        console.error("Failed to sync rename to Supabase", e);
      }
    }

    setIsModalVisible(false);
    setNewCoachName('');
    setNewCoachPersona('');
    setEditingCoachIndex(null);
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
          {coaches.map((coach, index) => {
            const isLocked = !isPro && index > 0;
            return (
              <CoachCard
                key={index}
                title={coach.title}
                description={coach.description}
                isLocked={isLocked}
                onPress={() => {
                  if (isLocked) {
                    setShowPaywall(true);
                    return;
                  }
                  handleCardPress(coach.title, coach.persona);
                }}
                onLongPress={() => handleLongPress(index)}
              />
            );
          })}

          <Pressable
            style={[styles.card, { borderStyle: 'dashed', borderWidth: 2, borderColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: 20 }]}
            onPress={handleCreateCoachPress}
          >
            <Text style={{ fontSize: 18, color: '#007AFF', fontWeight: 'bold' }}>＋ Create New Coach</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal for Creating OR Editing Coach */}
      {isModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
                {editingCoachIndex !== null ? 'Edit Coach' : 'Create Custom Coach'}
              </Text>

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
                <Pressable onPress={() => { setIsModalVisible(false); setEditingCoachIndex(null); }} style={{ flex: 1, padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: 'bold' }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveCustomCoach} style={{ flex: 1, backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{editingCoachIndex !== null ? 'Save' : 'Create'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Retune Modal */}
      {isRetuneModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
                Retune Your Context
              </Text>
              <Text style={{ color: '#666', marginBottom: 20 }}>
                Update your focus. Your AI coaches will morph to match.
              </Text>

              <Text style={{ fontWeight: '600', marginBottom: 8 }}>Current Pursuit</Text>
              <TextInput
                placeholder="e.g. Launching my MVP"
                style={{ backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, marginBottom: 16, fontSize: 16 }}
                value={retunePursuit}
                onChangeText={setRetunePursuit}
              />

              <Text style={{ fontWeight: '600', marginBottom: 8 }}>Current Noise / Blocker</Text>
              <TextInput
                placeholder="e.g. Procrastination, Overthinking"
                style={{ backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, marginBottom: 24, fontSize: 16 }}
                value={retuneNoise}
                onChangeText={setRetuneNoise}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setIsRetuneModalVisible(false)} style={{ flex: 1, padding: 16, alignItems: 'center' }} disabled={isRetuning}>
                  <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: 'bold' }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveRetune} style={{ flex: 1, backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center' }} disabled={isRetuning}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{isRetuning ? 'Retuning...' : 'Update'}</Text>
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

import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// ... (keep other imports)

function CoachCard({ title, description, onPress, onLongPress, isLocked }: { title: string; description: string; onPress: () => void; onLongPress: () => void; isLocked?: boolean }) {
  // Random start time to make them feel organic/independent
  const randomDelay = Math.random() * 2000;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!isLocked) {
      // Subtle breathing
      scale.value = withDelay(randomDelay, withRepeat(
        withSequence(
          withTiming(1.02, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      ));
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isLocked ? 0.8 : opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Animated.View style={[
        styles.card,
        animatedStyle,
        isLocked && { opacity: 0.8 }
      ]}>
        {/* Content remains same, but wrapper is Animated.View */}
        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.cardTitle}>{title}</Text>
            {isLocked && <Ionicons name="lock-closed" size={24} color="#999" />}
          </View>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>
      </Animated.View>
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
