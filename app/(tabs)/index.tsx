import React, { useState, useMemo, useContext } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeContext } from '../ThemeContext';

export default function HomeScreen() {
  const { isDark, theme, setTheme } = useContext(ThemeContext);
  const styles = getStyles(isDark);

  const [isAdmin, setIsAdmin] = useState(true);
  const [activeScope, setActiveScope] = useState('household'); // 'household' or 'entire'

  type Announcement = { id: string; author: string; time: string; text: string; scope?: string; isSystem?: boolean; };

  // Mock Users data including Birthdays and Washer Access
  const [users, setUsers] = useState([
    { id: '1', name: 'Dad', role: 'admin', hasWasherAccess: true, birthday: '1980-08-14' },
    { id: '2', name: 'Mom', role: 'admin', hasWasherAccess: true, birthday: '1982-12-01' },
    { id: '3', name: 'Ava', role: 'child', hasWasherAccess: false, birthday: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0] },
    { id: '4', name: 'Liam', role: 'child', hasWasherAccess: true, birthday: '2014-04-10' },
  ]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: '1', author: 'Mom', time: '2h ago', text: "Please don't forget to take out the trash tonight!", scope: 'household' },
    { id: '2', author: 'Dad', time: '1d ago', text: "We are going to Grandma's house this coming Sunday for dinner. Be ready by 4 PM.", scope: 'household' },
    { id: '3', author: 'Aunt Sue', time: '2d ago', text: "Can't wait for the family reunion next month!", scope: 'entire' }
  ]);

  const fullAnnouncements = useMemo(() => {
    let combined: any[] = announcements.filter(a => activeScope === 'entire' ? true : a.scope === 'household');
    const today = new Date();
    today.setHours(0,0,0,0);

    users.forEach(user => {
      const bdayDate = new Date(user.birthday);
      bdayDate.setFullYear(today.getFullYear()); 

      if (bdayDate < today) {
        bdayDate.setFullYear(today.getFullYear() + 1); 
      }

      const diffTime = Math.abs(bdayDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (diffDays <= 7 && diffDays > 0) {
        combined.unshift({
          id: `bday-${user.id}`,
          author: 'System',
          time: 'Just now',
          text: `🎉 Birthday Alert! ${user.name}'s birthday is coming up in ${diffDays} days on ${bdayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}! 🎂🎁`,
          isSystem: true
        });
      } else if (diffDays === 0) {
        combined.unshift({
          id: `bday-${user.id}`,
          author: 'System',
          time: 'Just now',
          text: `🎉🎂 HAPPY BIRTHDAY ${user.name.toUpperCase()}!!! 🎈🎁`,
          isSystem: true
        });
      }
    });

    return combined;
  }, [users, announcements, activeScope]);

  const toggleWasherAccess = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, hasWasherAccess: !u.hasWasherAccess } : u));
  };

  const currentUser = users.find(u => u.name === 'Dad');
  const hasLaundromatAccess = currentUser?.hasWasherAccess || false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Dashboard</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => alert('Invite link copied!')} style={styles.inviteBtn}>
              <IconSymbol name="person.crop.circle.badge.plus" size={24} color="#007aff" />
            </TouchableOpacity>
            <View style={styles.profileBadge}>
              <Text style={styles.profileInitials}>Dad</Text>
            </View>
          </View>
        </View>

        <View style={styles.segmentContainer}>
          <TouchableOpacity 
            style={[styles.segment, activeScope === 'entire' && styles.segmentActive]}
            onPress={() => setActiveScope('entire')}
          >
            <Text style={[styles.segmentText, activeScope === 'entire' && styles.segmentTextActive]}>Johnson Family</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.segment, activeScope === 'household' && styles.segmentActive]}
            onPress={() => setActiveScope('household')}
          >
            <Text style={[styles.segmentText, activeScope === 'household' && styles.segmentTextActive]}>Our Household</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Admin Section (Only visible to Admin and Household) */}
        {isAdmin && activeScope === 'household' && (
          <View style={[styles.card, styles.adminCard]}>
            <View style={styles.adminHeader}>
              <Text style={styles.adminTitle}>Admin Settings</Text>
              <Text style={styles.adminSubtitle}>Manage App Capabilities per User</Text>
            </View>
            
            {users.map((user) => (
              <View key={user.id} style={styles.adminRow}>
                <View>
                  <Text style={styles.adminRowText}>{user.name}</Text>
                  <Text style={styles.adminRowSub}>Washer & Dryer Access</Text>
                </View>
                <Switch 
                  value={user.hasWasherAccess} 
                  onValueChange={() => toggleWasherAccess(user.id)}
                  trackColor={{ false: isDark ? "#555" : "#d1d1d6", true: "#34c759" }}
                  ios_backgroundColor={isDark ? "#555" : "#d1d1d6"}
                />
              </View>
            ))}

            <View style={[styles.adminRow, { borderTopWidth: 1, borderTopColor: isDark ? '#2c2c2e' : '#e5e5ea', marginTop: 12, paddingTop: 16 }]}>
               <View>
                 <Text style={styles.adminRowText}>Appearance</Text>
                 <Text style={styles.adminRowSub}>Toggle Dark Mode</Text>
               </View>
               <View style={{flexDirection: 'row', gap: 6}}>
                 <TouchableOpacity onPress={() => setTheme('light')} style={{padding: 6, backgroundColor: theme === 'light' ? '#007aff' : 'transparent', borderRadius: 8}}>
                   <Text style={{fontWeight: '600', color: theme === 'light' ? '#fff' : (isDark ? '#fff' : '#000')}}>Light</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => setTheme('dark')} style={{padding: 6, backgroundColor: theme === 'dark' ? '#007aff' : 'transparent', borderRadius: 8}}>
                   <Text style={{fontWeight: '600', color: theme === 'dark' ? '#fff' : (isDark ? '#fff' : '#000')}}>Dark</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => setTheme('system')} style={{padding: 6, backgroundColor: theme === 'system' ? '#007aff' : 'transparent', borderRadius: 8}}>
                   <Text style={{fontWeight: '600', color: theme === 'system' ? '#fff' : (isDark ? '#fff' : '#000')}}>System</Text>
                 </TouchableOpacity>
               </View>
            </View>

          </View>
        )}

        {/* Laundry Section */}
        {activeScope === 'household' && (
          hasLaundromatAccess ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Laundry Schedule</Text>
              
              <View style={styles.laundryBlocks}>
                <View style={[styles.laundryBlock, { backgroundColor: isDark ? '#1a3644' : '#e8f3f8' }]}>
                  <Text style={styles.machineTitle}>Washer</Text>
                  <Text style={styles.machineStatusActive}>Running (34m)</Text>
                  <Text style={styles.machineUser}>Booked by Mom</Text>
                </View>

                <View style={[styles.laundryBlock, { backgroundColor: isDark ? '#443628' : '#fcf3e8' }]}>
                  <Text style={styles.machineTitle}>Dryer</Text>
                  <Text style={styles.machineStatusEmpty}>Available</Text>
                  <TouchableOpacity style={styles.bookButton}>
                    <Text style={styles.bookButtonText}>Book Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>Your Washer/Dryer scheduling has been disabled by Admin.</Text>
            </View>
          )
        )}

        {/* Announcements Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <TouchableOpacity><Text style={styles.linkText}>Post</Text></TouchableOpacity>
          </View>

          {fullAnnouncements.map((ann, idx) => (
            <View key={ann.id} style={[styles.announcementItem, idx === fullAnnouncements.length - 1 && {borderBottomWidth: 0, paddingBottom: 0}]}>
              <Text style={styles.announcementAuthor}>{ann.author} • {ann.time}</Text>
              <Text style={[styles.announcementBody, ann.isSystem && {color: '#d9115c', fontWeight: '500'}]}>{ann.text}</Text>
            </View>
          ))}
        </View>

        {/* Family Calendar Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => router.push('/modal')}>
              <Text style={styles.linkText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventList}>
            <View style={styles.eventDateBox}>
               <Text style={styles.eventDay}>TUE</Text>
               <Text style={styles.eventNumber}>29</Text>
            </View>
            <View style={styles.eventDetailsBox}>
               <View style={[styles.eventPill, { backgroundColor: isDark ? '#4a3b69' : '#EADDFF' }]}>
                 <Text style={[styles.eventTime, isDark && {color: '#eaddff'}]}>4:00 PM</Text>
                 <Text style={[styles.eventName, isDark && {color: '#fff'}]}>Ava's Piano Lesson</Text>
               </View>
            </View>
          </View>

           <View style={styles.eventList}>
            <View style={styles.eventDateBox}>
               <Text style={styles.eventDay}>TUE</Text>
               <Text style={styles.eventNumber}>31</Text>
            </View>
            <View style={styles.eventDetailsBox}>
               <View style={[styles.eventPill, { backgroundColor: isDark ? '#632c3f' : '#FFD8E4' }]}>
                 <Text style={[styles.eventTime, isDark && {color: '#ffd8e4'}]}>6:30 PM</Text>
                 <Text style={[styles.eventName, isDark && {color: '#fff'}]}>{activeScope === 'entire' ? "Family Reunion 🎉" : "Halloween Party!"}</Text>
               </View>
            </View>
          </View>

        </View>
        
        <View style={{height: 100}} />

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#f2f2f7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: isDark ? '#121212' : '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? '#2c2c2e' : '#c6c6c8',
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
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  segmentActive: {
    backgroundColor: '#007aff',
  },
  segmentText: {
    fontWeight: '600',
    color: isDark ? '#fff' : '#1c1c1e',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#f2f2f7',
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
    backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.04,
    shadowRadius: 10,
    elevation: 2,
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
