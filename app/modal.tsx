import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, ScrollView } from 'react-native';
import React, { useState, useContext } from 'react';
import { router } from 'expo-router';
import { ThemeContext } from './ThemeContext';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';

export default function ModalScreen() {
  const { isDark, sendLocalNotification } = useContext(ThemeContext);
  const styles = getStyles(isDark);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isEntireFamily, setIsEntireFamily] = useState(false);
  const handleSave = async () => {
    if (!title) return;
    try {
      // Create a formally structured cloud event for UI ingestion rather than just text
      await addDoc(collection(db, 'events'), {
        title,
        date: date || 'TBD',
        time: time || 'TBD',
        author: auth.currentUser?.displayName || 'Unknown',
        authorId: auth.currentUser?.uid || '',
        isEntireFamily,
        householdId: 'main', // Hardcoding for local cache, real prod would query users doc
        createdAt: serverTimestamp()
      });

      sendLocalNotification(
          "Event Scheduled",
          `"${title}" is added to the calendar for ${date || 'upcoming'}.`
      );
    } catch (e: any) {
       alert("Failed to create Event: " + e.message);
    }
    router.back();
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
    <LinearGradient colors={isDark ? ['#3E2723', '#4E342E', '#5D4037'] : ['#FFF3E0', '#FFE0B2', '#FFCC80']} style={styles.container}>
      <ScrollView contentContainerStyle={{flexGrow: 1, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New Event</Text>
      
      <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.glassCard}>
        <View style={styles.formGroup}>
        <Text style={styles.label}>Event Title</Text>
        <TextInput 
          style={styles.input}
          placeholder="e.g. Dinner at Grandma's"
          placeholderTextColor={isDark ? "#8e8e93" : "#c7c7cc"}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, {flex: 1, marginRight: 8}]}>
          <Text style={styles.label}>Date</Text>
          <TextInput 
            style={styles.input}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={isDark ? "#8e8e93" : "#c7c7cc"}
            value={date}
            onChangeText={setDate}
          />
        </View>
        <View style={[styles.formGroup, {flex: 1, marginLeft: 8}]}>
          <Text style={styles.label}>Time</Text>
          <TextInput 
            style={styles.input}
            placeholder="00:00 PM"
            placeholderTextColor={isDark ? "#8e8e93" : "#c7c7cc"}
            value={time}
            onChangeText={setTime}
          />
        </View>
      </View>

      <View style={styles.switchGroup}>
        <View style={styles.switchLabelContainer}>
          <Text style={styles.switchTitle}>Invite Entire Extended Family</Text>
          <Text style={styles.switchSub}>If off, this event will only be visible to your immediate household.</Text>
        </View>
        <Switch 
          value={isEntireFamily}
          onValueChange={setIsEntireFamily}
          trackColor={{ false: isDark ? "#555" : "#d1d1d6", true: "#34c759" }}
          ios_backgroundColor={isDark ? "#555" : "#d1d1d6"}
        />
        </View>
      </BlurView>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Add to Calendar</Text>
      </TouchableOpacity>

      <StatusBar style="light" />
      </ScrollView>
    </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 24,
    marginTop: 10,
  },
  formGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    color: isDark ? '#fff' : '#000',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 0,
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#000',
  },
  switchSub: {
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    marginTop: 4,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#E65100',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
