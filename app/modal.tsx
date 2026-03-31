import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View, TextInput, TouchableOpacity, Switch } from 'react-native';
import React, { useState, useContext } from 'react';
import { router } from 'expo-router';
import { ThemeContext } from './ThemeContext';

export default function ModalScreen() {
  const { isDark, sendLocalNotification } = useContext(ThemeContext);
  const styles = getStyles(isDark);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isEntireFamily, setIsEntireFamily] = useState(false);

  const handleSave = () => {
    // Notify
    if (title) {
        sendLocalNotification(
            "Event Added",
            `"${title}" is added to the family calendar for ${date || 'upcoming'}.`
        );
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Event</Text>
      
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

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Add to Calendar</Text>
      </TouchableOpacity>

      <StatusBar style={isDark ? 'light' : Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#f2f2f7',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: isDark ? '#fff' : '#000',
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
    fontWeight: '600',
    color: isDark ? '#aeaeb2' : '#8e8e93',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: isDark ? '#1c1c1e' : '#fff',
    color: isDark ? '#fff' : '#000',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#1c1c1e' : '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#1c1c1e',
  },
  switchSub: {
    fontSize: 13,
    color: isDark ? '#aeaeb2' : '#8e8e93',
    marginTop: 4,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#007aff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
