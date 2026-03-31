import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CalendarProvider, WeekCalendar } from 'react-native-calendars';
import { ThemeContext } from './ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';
import { db, auth } from '../firebaseConfig';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

export default function ApplianceScheduleScreen() {
  const { type } = useLocalSearchParams();
  const { isDark, sendLocalNotification } = useContext(ThemeContext);
  const styles = getStyles(isDark);
  
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!type) return;
    const q = query(collection(db, `appliances_${type}`));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSchedule(items);
    });
    return unsub;
  }, [type]);

  const timeSlots = [
    '08:00 AM', '10:00 AM', '12:00 PM', 
    '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM', '10:00 PM'
  ];

  const bookSlot = async (timeSlot: string) => {
    const existing = schedule.find(s => s.date === selectedDate && s.timeSlot === timeSlot);
    if (existing) {
       if (existing.bookedBy === auth.currentUser?.displayName) {
          Alert.alert("Cancel Booking?", "Remove yourself from this time slot?", [
             { text: 'Keep Slot' },
             { text: 'Cancel Booking', style: 'destructive', onPress: async () => {
                 setLoading(true);
                 await deleteDoc(doc(db, `appliances_${type}`, existing.id));
                 setLoading(false);
             }}
          ]);
       } else {
          Alert.alert("Slot Taken", `This slot is already reserved by ${existing.bookedBy}`);
       }
       return;
    }

    setLoading(true);
    try {
        await addDoc(collection(db, `appliances_${type}`), {
          date: selectedDate,
          timeSlot,
          bookedBy: auth.currentUser?.displayName || 'Family Member',
          createdAt: serverTimestamp()
        });

        // Compute 30 mins prior
        const [timePart, ampm] = timeSlot.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        const bookingDate = new Date(`${selectedDate}T00:00:00`);
        bookingDate.setHours(hours, minutes, 0, 0);
        
        const notificationDate = new Date(bookingDate.getTime() - 30 * 60000); // 30 mins before
        
        if (notificationDate > new Date()) {
           sendLocalNotification(
             "Washing Machine Reminder",
             `Heads up! The washing machine is scheduled by ${auth.currentUser?.displayName || 'someone'} in 30 minutes.`,
             { date: notificationDate }
           );
        }

    } catch(e: any) { alert("Error saving to schedule: " + e.message); }
    setLoading(false);
  };

  const markedDates = schedule.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = { marked: true, dotColor: '#007aff' };
    return acc;
  }, {});

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <LinearGradient colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#e0c3fc', '#8ec5fc', '#4facfe']} style={styles.container}>
      <CalendarProvider
        date={selectedDate}
        onDateChanged={setSelectedDate}
        theme={{
          calendarBackground: 'transparent',
          textSectionTitleColor: isDark ? '#ffffff' : '#000000',
          selectedDayBackgroundColor: '#007aff',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#007aff',
          dayTextColor: isDark ? '#ffffff' : '#2d4150',
          textDisabledColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
        }}
      >
        <WeekCalendar 
           firstDay={1} 
           markedDates={markedDates}
           theme={{
             calendarBackground: 'transparent',
             dayTextColor: isDark ? '#fff' : '#000',
           }}
        />
        
        <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.slotContainer}>
          <ScrollView contentContainerStyle={{paddingBottom: 40}}>
            <Text style={styles.slotHeader}>
              {(typeof type === 'string' ? type.charAt(0).toUpperCase() + type.slice(1) : '')} Schedule for {selectedDate}
            </Text>
          {loading && <ActivityIndicator color="#007aff" style={{marginBottom: 10}} />}
          
          {timeSlots.map(time => {
             const booking = schedule.find(s => s.date === selectedDate && s.timeSlot === time);
             const isBooked = !!booking;
             const isMine = booking?.bookedBy === auth.currentUser?.displayName;
             
             return (
               <TouchableOpacity 
                 key={time} 
                 style={[
                    styles.slotRow, 
                    isBooked && !isMine && styles.slotRowBooked,
                    isMine && styles.slotRowMine
                 ]}
                 onPress={() => bookSlot(time)}
                 disabled={loading}
               >
                 <Text style={[styles.slotTime, isBooked && styles.slotTextBooked, isMine && styles.slotTextMine]}>
                   {time}
                 </Text>
                 <Text style={[styles.slotStatus, isBooked && styles.slotTextBooked, isMine && styles.slotTextMine]}>
                   {isMine ? 'My Booking' : isBooked ? booking.bookedBy : 'Available'}
                 </Text>
               </TouchableOpacity>
             )
          })}
          
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#007aff', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 }}>
             <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Save & Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </CalendarProvider>
    </LinearGradient>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  slotContainer: {
    flex: 1,
    marginTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  slotHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: isDark ? '#fff' : '#000',
    marginBottom: 20,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  slotRowBooked: {
    backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)',
    opacity: 0.6,
  },
  slotRowMine: {
    backgroundColor: isDark ? 'rgba(0,122,255,0.3)' : 'rgba(0,122,255,0.1)',
    borderColor: '#007aff',
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#000',
  },
  slotStatus: {
    fontSize: 16,
    color: '#007aff',
    fontWeight: '700',
  },
  slotTextBooked: {
    color: isDark ? '#aeaeb2' : '#8e8e93',
  },
  slotTextMine: {
    color: isDark ? '#64d2ff' : '#007aff',
  }
});
