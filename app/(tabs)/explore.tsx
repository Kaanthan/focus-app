import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY = 'user_persona';

export default function TabTwoScreen() {
  const [mission, setMission] = useState('');
  const [principles, setPrinciples] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    try {
      // 1. Try Local Storage first for speed
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        const data = JSON.parse(jsonValue);
        setMission(data.pursuit || '');
        setPrinciples(data.principles || '');
      }

      // 2. Background Refresh from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('persona_data')
          .eq('id', session.user.id)
          .single();

        if (data?.persona_data) {
          const remoteCtx = data.persona_data;
          setMission(remoteCtx.pursuit || '');
          setPrinciples(remoteCtx.principles || '');
          // Update local to match remote
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remoteCtx));
        }
      }

    } catch (e) {
      console.error('Failed to load context', e);
    }
  };

  const saveContext = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // 1. Get existing context to merge (preserve role, noise, tone)
      const existingJson = await AsyncStorage.getItem(STORAGE_KEY);
      const existingData = existingJson ? JSON.parse(existingJson) : {};

      const updatedContext = {
        ...existingData,
        pursuit: mission,
        principles: principles
      };

      // 2. Save Local
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedContext));

      // 3. Save to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Regenerate Personas with new context
        try {
          const module = await import('@/app/utils/CoachEngine');
          const aiPersonas = await module.generatePersonas(updatedContext);

          // Save new personas
          await AsyncStorage.setItem('ai_personas', JSON.stringify(aiPersonas));

          // Update Supabase with both context AND new personas
          updatedContext.ai_personas = aiPersonas;

          const { error } = await supabase
            .from('profiles')
            .update({ persona_data: updatedContext })
            .eq('id', session.user.id);

          if (error) throw error;
        } catch (genError) {
          console.error("Failed to regenerate personas", genError);
          // Fallback: just save context if generation fails
          const { error } = await supabase
            .from('profiles')
            .update({ persona_data: updatedContext })
            .eq('id', session.user.id);
          if (error) throw error;
        }
      }

      Alert.alert('Saved', 'Your context has been updated. The AI will now reflect this.');
    } catch (e: any) {
      console.error('Failed to save context', e);
      Alert.alert('Error', 'Failed to save: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Context</Text>
          </View>

          <View style={styles.cardsContainer}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>My Mission (Pursuit)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 12 Startups in 12 Months"
                placeholderTextColor="#A0A0A5"
                multiline
                scrollEnabled={false}
                value={mission}
                onChangeText={setMission}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>My Principles</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Build in public, Empathy first"
                placeholderTextColor="#A0A0A5"
                multiline
                scrollEnabled={false}
                value={principles}
                onChangeText={setPrinciples}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                loading && { opacity: 0.5 }
              ]}
              onPress={saveContext}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Context'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    elevation: 3,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000000',
  },
  input: {
    fontSize: 16,
    color: '#3C3C43',
    lineHeight: 24,
    minHeight: 40,
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
