import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY = 'userContext';

export default function TabTwoScreen() {
  const [mission, setMission] = useState('');
  const [principles, setPrinciples] = useState('');

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        const data = JSON.parse(jsonValue);
        setMission(data.mission || '');
        setPrinciples(data.principles || '');
      }
    } catch (e) {
      console.error('Failed to load context', e);
    }
  };

  const saveContext = async () => {
    try {
      const value = JSON.stringify({ mission, principles });
      await AsyncStorage.setItem(STORAGE_KEY, value);
      Alert.alert('Saved', 'Your context has been saved.');
    } catch (e) {
      console.error('Failed to save context', e);
      Alert.alert('Error', 'Failed to save your context.');
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
              <Text style={styles.cardLabel}>My Mission</Text>
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
                pressed && styles.saveButtonPressed
              ]}
              onPress={saveContext}
            >
              <Text style={styles.saveButtonText}>Save</Text>
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
