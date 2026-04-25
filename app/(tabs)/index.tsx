import React, { useState, useMemo, useContext } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity, SafeAreaView, Platform, StatusBar, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeContext } from '../ThemeContext';
import { auth, db } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';

export default function HomeScreen() {
  const { isDark, theme, setTheme } = useContext(ThemeContext);
  const styles = getStyles(isDark);

  const [isAdmin, setIsAdmin] = useState(true);
  const [activeScope, setActiveScope] = useState('household'); // 'household' or 'entire'
  const [isPosting, setIsPosting] = useState(false);
  const [postText, setPostText] = useState('');

  type Announcement = { id: string; author: string; time: string; text: string; scope?: string; isSystem?: boolean; };
  type FamilyEvent = { id: string; title: string; date: string; time: string; author: string; isEntireFamily: boolean; householdId: string; };

  // Live Firestore syncing arrays!
  const [users, setUsers] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [appliances, setAppliances] = useState<any>({
    washer: { status: 'Available', bookedBy: '', timerEnd: 0 },
    dryer: { status: 'Available', bookedBy: '', timerEnd: 0 }
  });
  const [applianceSchedule, setApplianceSchedule] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60000); // Tick every minute
    
    // 1. Listen to Events Live
    const qAnn = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubAnn = onSnapshot(qAnn, (snap) => {
      const liveEvents = snap.docs.map(d => {
        const data = d.data();
        let timeString = data.time || 'Just now';
        
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          timeString = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
        }
        
        return { 
          id: d.id, 
          author: data.author, 
          text: data.text, 
          scope: data.scope, 
          time: timeString
        } as Announcement;
      });
      setAnnouncements(liveEvents);
    });

    // 2. Listen to Users Live
    const unsubUsers = onSnapshot(collection(db, 'users'), async (snap) => {
      if (snap.empty) {
        // Automatically inject basic users into DB so sliders always have data during prototype phase!
        const defaultUsers = [
          { name: 'Dad', role: 'admin', hasWasherAccess: true, birthday: '1980-08-14' },
          { name: 'Mom', role: 'admin', hasWasherAccess: true, birthday: '1982-12-01' },
          { name: 'Ava', role: 'child', hasWasherAccess: false, birthday: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0] },
          { name: 'Liam', role: 'child', hasWasherAccess: true, birthday: '2014-04-10' },
        ];
        try {
            for (const u of defaultUsers) { await addDoc(collection(db, 'users'), u); }
        } catch (e) {
           console.log("Failed to seed mock users against database rules");
        }
      } else {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });

    // 3. Listen to Laundry Machines Live
    const unsubAppliances = onSnapshot(doc(db, 'settings', 'laundry'), async (snap) => {
      if (!snap.exists()) {
        await setDoc(doc(db, 'settings', 'laundry'), {
          washer: { status: 'Available', bookedBy: '', timerEnd: 0 },
          dryer: { status: 'Available', bookedBy: '', timerEnd: 0 }
        });
      } else {
        setAppliances(snap.data());
      }
    });

    // 4. Listen to Upcoming Schedule
    const unsubApplianceSchedule = onSnapshot(collection(db, 'appliances_washer'), (snap) => {
       setApplianceSchedule(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Listen to Global Calendar Events
    const unsubEvents = onSnapshot(query(collection(db, 'events'), orderBy('createdAt', 'asc')), (snap) => {
       setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyEvent)));
    });

    return () => { clearInterval(clock); unsubAnn(); unsubUsers(); unsubAppliances(); unsubApplianceSchedule(); unsubEvents(); };
  }, []);

  const fullAnnouncements = useMemo(() => {
    return announcements.filter(a => a.scope === activeScope);
  }, [announcements, activeScope]);

  const toggleWasherAccess = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
        try {
            await updateDoc(doc(db, 'users', userId), { hasWasherAccess: !user.hasWasherAccess });
        } catch (e: any) {
             alert("Cloud access denied: " + e.message);
        }
    }
  };

  const bookAppliance = async (type: 'washer' | 'dryer') => {
    try {
      const endTime = Date.now() + 45 * 60000; // 45 Minutes cycle
      await updateDoc(doc(db, 'settings', 'laundry'), {
        [`${type}`]: { status: 'Running', bookedBy: auth.currentUser?.displayName || 'Family Member', timerEnd: endTime }
      });
    } catch (e: any) { alert("Failed to book: " + e.message); }
  };

  const freeAppliance = async (type: 'washer' | 'dryer') => {
    try {
      await updateDoc(doc(db, 'settings', 'laundry'), {
        [`${type}`]: { status: 'Available', bookedBy: '', timerEnd: 0 }
      });
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  const currentUser = users.find(u => u.name === auth.currentUser?.displayName || u.id === auth.currentUser?.uid);
  const hasLaundromatAccess = currentUser ? currentUser.hasWasherAccess : true; // Fallback to true if unsynced

  const renderAppliance = (type: 'washer'|'dryer', title: string, colorOnDark: string, colorOnLight: string) => {
    const data = appliances[type];
    const isRunning = data.status === 'Running' && data.timerEnd > now;
    const isMine = data.bookedBy === auth.currentUser?.displayName;
    const minsLeft = Math.max(0, Math.round((data.timerEnd - now) / 60000));

    const handleActionClick = () => {
      if (isRunning) {
        // If it's already running, immediately take them to the calendar to book future slots
        router.push({ pathname: '/appliance-schedule', params: { type } });
      } else {
        Alert.alert(
          `Book ${title}`,
          "Would you like to start a load right now, or schedule it for a future date?",
          [
             { text: 'Cancel', style: 'cancel' },
             { text: 'Schedule for Later', onPress: () => router.push({ pathname: '/appliance-schedule', params: { type } }) },
             { text: 'Start Now (45m)', onPress: () => bookAppliance(type) },
          ]
        );
      }
    };

    return (
      <View style={[styles.laundryBlock, { backgroundColor: isDark ? colorOnDark : colorOnLight }]}>
        <Text style={styles.machineTitle}>{title}</Text>
        
        {isRunning ? (
          <>
            <Text style={styles.machineStatusActive}>Running ({minsLeft}m)</Text>
            <Text style={styles.machineUser}>Booked by {data.bookedBy}</Text>
            {isMine && (
              <TouchableOpacity onPress={() => freeAppliance(type)} style={{marginTop: 8, marginBottom: 4}}>
                <Text style={{color: '#007aff', fontWeight: 'bold'}}>Finish Early</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.bookButton} onPress={handleActionClick}>
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.bookButton} onPress={handleActionClick}>
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
          </>
        )}

        {applianceSchedule.length > 0 && (
          <View style={{marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', alignItems: 'center'}}>
            <Text style={{fontWeight: '700', marginBottom: 12, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2}}>Upcoming Schedule</Text>
            {applianceSchedule.filter(s => {
               if (!s.date) return false;
               const sDate = new Date(s.date + 'T00:00:00');
               const today = new Date();
               today.setHours(0,0,0,0);
               const diff = (sDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
               return diff >= 0 && diff <= 7;
            }).sort((a,b) => new Date(a.date+'T'+a.timeSlot.split(' ')[0]).getTime() - new Date(b.date+'T'+b.timeSlot.split(' ')[0]).getTime()).slice(0, 4).map(s => {
               const sDate = new Date(s.date + 'T00:00:00');
               const isToday = sDate.toDateString() === new Date().toDateString();
               const dayName = isToday ? 'Today' : sDate.toLocaleDateString('en-US', { weekday: 'short' });
               
               return (
                 <View key={s.id} style={{paddingVertical: 6, alignItems: 'center'}}>
                    <Text style={{color: isDark ? '#fff' : '#000', fontWeight: '500', fontSize: 14}}>
                        {dayName} at {s.timeSlot} <Text style={{color: '#007aff', fontWeight: '700'}}>• {s.bookedBy}</Text>
                    </Text>
                 </View>
               )
            })}
          </View>
        )}
      </View>
    );
  };

  const handlePostAnnouncement = () => {
    setIsPosting(!isPosting);
  };

  const submitAnnouncement = async () => {
    if (!postText || postText.trim() === '') {
       setIsPosting(false);
       return;
    }
    try {
      await addDoc(collection(db, 'announcements'), {
        author: auth.currentUser?.displayName || 'Family Member',
        text: postText.trim(),
        scope: activeScope,
        createdAt: serverTimestamp()
      });
      setPostText('');
      setIsPosting(false);
    } catch (e: any) { alert("Failed to post: " + e.message); }
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <LinearGradient colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#e0c3fc', '#8ec5fc', '#4facfe']} style={styles.safeArea}>
    <SafeAreaView style={{flex: 1}}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Our Household</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => Alert.alert('Household Invite Code', `Share this code with your family member to join your household tier:\n\n${currentUser?.householdId}`)} style={styles.inviteBtn}>
              <IconSymbol name="person.crop.circle.badge.plus" size={24} color="#007aff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.inviteBtn}>
              <IconSymbol name="gear" size={24} color={isDark ? "#fff" : "#1c1c1e"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.profileBadge}>
              <Text style={styles.profileInitials}>{(auth.currentUser?.displayName || 'U').charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Laundry Section */}
        {hasLaundromatAccess ? (
            <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.card}>
              <View style={styles.laundryBlocks}>
                {renderAppliance('washer', 'Washing Schedule', '#1a3644', '#e8f3f8')}
              </View>
            </BlurView>
          ) : (
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>Your Washer/Dryer scheduling has been disabled by Admin.</Text>
            </View>
          )}

        {/* Announcements Section */}
        <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <TouchableOpacity onPress={handlePostAnnouncement}>
               <Text style={styles.linkText}>{isPosting ? 'Cancel' : 'Post'}</Text>
            </TouchableOpacity>
          </View>

          {isPosting && (
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8}}>
               <TextInput
                 style={{flex: 1, color: isDark ? '#fff' : '#000', fontSize: 16, paddingVertical: 8}}
                 placeholder="Publishing to your Household..."
                 placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                 value={postText}
                 onChangeText={setPostText}
                 autoFocus
                 onSubmitEditing={submitAnnouncement}
                 returnKeyType="send"
               />
               <TouchableOpacity onPress={submitAnnouncement} style={{backgroundColor: '#007aff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginLeft: 8}}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>Send</Text>
               </TouchableOpacity>
            </View>
          )}

          {fullAnnouncements.map((ann, idx) => (
            <View key={ann.id} style={[styles.announcementItem, idx === fullAnnouncements.length - 1 && {borderBottomWidth: 0, paddingBottom: 0}]}>
              <Text style={styles.announcementAuthor}>{ann.author} • {ann.time}</Text>
              <Text style={[styles.announcementBody, ann.isSystem && {color: '#d9115c', fontWeight: '500'}]}>{ann.text}</Text>
            </View>
          ))}
        </BlurView>

        {/* Family Calendar Section */}
        <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => router.push('/modal')}>
              <Text style={styles.linkText}>Add</Text>
            </TouchableOpacity>
          </View>

          {events.filter(e => !e.isEntireFamily).length === 0 ? (
             <View style={{paddingVertical: 20, alignItems: 'center'}}>
                <Text style={{color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}}>No upcoming household events.</Text>
             </View>
          ) : (
             events.filter(e => !e.isEntireFamily).map((evt, idx) => {
               // Parse date conceptually for the calendar block
               const dayShort = evt.date.substring(0, 3).toUpperCase() || 'TBD';
               const numDay = evt.date.replace(/[^0-9]/g, '').substring(0, 2) || '--';
               return (
                  <View key={evt.id} style={styles.eventList}>
                    <View style={styles.eventDateBox}>
                       <Text style={styles.eventDay}>{dayShort}</Text>
                       <Text style={styles.eventNumber}>{numDay}</Text>
                    </View>
                    <View style={styles.eventDetailsBox}>
                       <View style={[styles.eventPill, { backgroundColor: isDark ? '#4a3b69' : '#EADDFF' }]}>
                         <Text style={[styles.eventTime, isDark && {color: '#eaddff'}]}>{evt.time}</Text>
                         <Text style={[styles.eventName, isDark && {color: '#fff'}]}>{evt.title}</Text>
                       </View>
                    </View>
                  </View>
               );
             })
          )}
        </BlurView>
        
        <View style={{height: 100}} />

      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  inviteBtn: {
    padding: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  segmentActive: {
    backgroundColor: isDark ? 'rgba(10, 132, 255, 0.9)' : '#007aff',
  },
  segmentText: {
    fontWeight: '700',
    color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: isDark ? '#fff' : '#000',
    letterSpacing: -0.5,
  },
  profileBadge: {
    backgroundColor: isDark ? '#333' : '#000',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
  },
  cardInfo: {
    padding: 16,
    backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    color: isDark ? '#aeaeb2' : '#8e8e93',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  adminCard: {
    backgroundColor: isDark ? '#121212' : '#f9f9fb',
    borderWidth: 1,
    borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
  },
  adminHeader: {
    marginBottom: 12,
  },
  adminTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: isDark ? '#fff' : '#1c1c1e',
  },
  adminSubtitle: {
    fontSize: 13,
    color: isDark ? '#aeaeb2' : '#8e8e93',
    marginTop: 2,
  },
  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? '#2c2c2e' : '#e5e5ea',
  },
  adminRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#1c1c1e',
  },
  adminRowSub: {
    fontSize: 13,
    color: isDark ? '#aeaeb2' : '#8e8e93',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: isDark ? '#fff' : '#000',
  },
  linkText: {
    color: '#007aff',
    fontSize: 16,
    fontWeight: '600',
  },
  laundryBlocks: {
    flexDirection: 'row',
    gap: 12,
  },
  laundryBlock: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    minHeight: 120,
  },
  machineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: isDark ? '#fff' : '#1c1c1e',
    marginBottom: 4,
  },
  machineStatusActive: {
    fontSize: 15,
    color: '#34c759',
    fontWeight: '600',
    marginTop: 8,
  },
  machineStatusEmpty: {
    fontSize: 15,
    color: isDark ? '#aeaeb2' : '#8e8e93',
    fontWeight: '500',
    marginTop: 8,
  },
  machineUser: {
    fontSize: 13,
    color: isDark ? '#aeaeb2' : '#8e8e93',
    marginTop: 4,
  },
  bookButton: {
    backgroundColor: '#007aff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  announcementItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? '#2c2c2e' : '#e5e5ea',
    paddingBottom: 16,
    marginBottom: 16,
  },
  announcementAuthor: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '600',
    marginBottom: 4,
  },
  announcementBody: {
    fontSize: 16,
    color: isDark ? '#fff' : '#1c1c1e',
    lineHeight: 22,
  },
  eventList: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  eventDateBox: {
    width: 40,
    alignItems: 'center',
    marginRight: 16,
  },
  eventDay: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#aeaeb2' : '#8e8e93',
  },
  eventNumber: {
    fontSize: 20,
    fontWeight: '400',
    color: isDark ? '#fff' : '#1c1c1e',
  },
  eventDetailsBox: {
    flex: 1,
  },
  eventPill: {
    padding: 12,
    borderRadius: 12,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1c1c1e',
    opacity: 0.8,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginTop: 2,
  },
});
