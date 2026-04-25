import React, { useState, useEffect, useContext } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ThemeContext } from './ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function SettingsScreen() {
  const { isDark, theme, setTheme } = useContext(ThemeContext);
  const styles = getStyles(isDark);
  
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  
  // Real-time listen to users and requests
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubReqs = onSnapshot(collection(db, 'household_requests'), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubReqs(); };
  }, []);

  const myUserDoc = users.find(u => u.id === auth.currentUser?.uid || u.name === auth.currentUser?.displayName);
  // Default to child if not fully loaded.
  const myRole = myUserDoc?.role || 'child'; 
  const myHouseholdId = myUserDoc?.householdId || 'main';
  
  // A person labeled a parent or admin gets admin responsibilities.
  const isAdmin = myRole === 'admin' || myRole === 'parent';

  // Manageable users are exactly those who share the admin's household.
  const manageableUsers = users.filter(u => u.householdId === myHouseholdId);
  const pendingRequests = requests.filter(r => r.status === 'pending');
  // New users floating in the global tier without a localized household
  const pendingUsers = users.filter(u => u.householdId === 'pending');

  const toggleWasherAccess = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', userId), { hasWasherAccess: !user.hasWasherAccess });
    } catch (e: any) { alert("Error updating access: " + e.message); }
  };

  const assignToMyHousehold = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        householdId: myHouseholdId,
        role: 'child' // Enforce base role on entry
      });
      alert("Successfully added user to your household constraints!");
    } catch (e: any) { alert("Error assigning to household: " + e.message); }
  };

  const requestOwnHousehold = async () => {
     try {
       // Check if already requested
       const existing = requests.find(r => r.userId === auth.currentUser?.uid && r.status === 'pending');
       if (existing) {
         return Alert.alert("Pending Request", "You already have a pending household request waiting for approval.");
       }
       await addDoc(collection(db, 'household_requests'), {
          userId: auth.currentUser?.uid,
          name: auth.currentUser?.displayName || 'Family Member',
          status: 'pending',
          createdAt: serverTimestamp()
       });
       Alert.alert("Request Sent", "A parent must approve your new household request.");
     } catch(e: any) { alert(e.message); }
  };

  const approveRequest = async (req: any) => {
     try {
       // Generate unique household ID for them
       const newHouseholdId = 'household_' + Date.now();
       
       // Update their specific user doc to make them an admin of their NEW household.
       await updateDoc(doc(db, 'users', req.userId), {
          role: 'admin',
          householdId: newHouseholdId
       });
       // Clear the request
       await updateDoc(doc(db, 'household_requests', req.id), { status: 'approved' });
       Alert.alert("Approved", `${req.name} is now the admin of their own household!`);
     } catch(e:any) { alert(e.message); }
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <LinearGradient colors={isDark ? ['#3E2723', '#4E342E', '#5D4037'] : ['#FFF3E0', '#FFE0B2', '#FFCC80']} style={{flex: 1}}>
    <SafeAreaView style={{flex: 1}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 8}}>
          <Text style={styles.linkText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{width: 50}} />
      </View>

      <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20}}>
          <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.card}>
            
            {!isAdmin && (
               <TouchableOpacity 
                  onPress={async () => {
                     try {
                        if (!auth.currentUser) return alert('Auth mapping not ready yet.');
                        await updateDoc(doc(db, 'users', auth.currentUser.uid), { role: 'admin' });
                        alert('You have been promoted to Admin Status! The UI will now unlock.');
                     } catch(err: any) {
                        alert("Promotion failed. Database blocked it: " + err.message);
                     }
                  }}
                  style={{ backgroundColor: '#ffcc00', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 }}
               >
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#000' }}>👑 Become an Admin (Debug Mode)</Text>
               </TouchableOpacity>
            )}

            {isAdmin && (
              <>
                <View style={styles.adminHeader}>
                  <Text style={styles.adminTitle}>Household Admin Controls</Text>
                  <Text style={styles.adminSubtitle}>Manage capabilities for members in your household</Text>
                </View>
                
                {manageableUsers.map((user) => (
                  <View key={user.id} style={styles.adminRow}>
                    <View>
                      <Text style={styles.adminRowText}>{user.name}</Text>
                      <Text style={styles.adminRowSub}>Washer & Dryer Access</Text>
                    </View>
                    <Switch 
                      value={user.hasWasherAccess || false} 
                      onValueChange={() => toggleWasherAccess(user.id)}
                      trackColor={{ false: isDark ? "#555" : "#d1d1d6", true: "#34c759" }}
                      ios_backgroundColor={isDark ? "#555" : "#d1d1d6"}
                    />
                  </View>
                ))}

                {pendingUsers.length > 0 && (
                  <View style={{marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}}>
                    <Text style={[styles.adminTitle, { fontSize: 18, marginBottom: 12}]}>Unassigned Family Members</Text>
                    {pendingUsers.map(u => (
                       <View key={u.id} style={styles.adminRow}>
                          <View>
                            <Text style={styles.adminRowText}>{u.name}</Text>
                            <Text style={styles.adminRowSub}>{u.email}</Text>
                          </View>
                          <TouchableOpacity 
                             onPress={() => assignToMyHousehold(u.id)}
                             style={{backgroundColor: '#E65100', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12}}>
                              <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>Add to Household</Text>
                          </TouchableOpacity>
                       </View>
                    ))}
                  </View>
                )}

                {pendingRequests.length > 0 && (
                  <View style={{marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}}>
                    <Text style={[styles.adminTitle, { fontSize: 18, marginBottom: 12}]}>Pending Household Requests</Text>
                    {pendingRequests.map(req => (
                      <View key={req.id} style={styles.adminRow}>
                         <View>
                           <Text style={styles.adminRowText}>{req.name}</Text>
                           <Text style={styles.adminRowSub}>Wants to start their own household</Text>
                         </View>
                         <TouchableOpacity onPress={() => approveRequest(req)} style={{backgroundColor: '#E65100', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8}}>
                           <Text style={{color: '#fff', fontWeight: 'bold'}}>Approve</Text>
                         </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {!isAdmin && (
               <View style={styles.adminHeader}>
                 <Text style={styles.adminTitle}>Household Permissions</Text>
                 <Text style={styles.adminSubtitle}>You are currently a household member.</Text>
                 
                 <TouchableOpacity onPress={requestOwnHousehold} style={{marginTop: 16, backgroundColor: '#E65100', padding: 14, borderRadius: 12, alignItems: 'center'}}>
                    <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Request New Household</Text>
                 </TouchableOpacity>
               </View>
            )}

            <View style={[styles.adminRow, { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', marginTop: 12, paddingTop: 16 }]}>
               <View>
                 <Text style={styles.adminRowText}>Appearance</Text>
                 <Text style={styles.adminRowSub}>Toggle Mode</Text>
               </View>
               <View style={{flexDirection: 'row', gap: 6}}>
                 <TouchableOpacity onPress={() => setTheme('light')} style={{padding: 6, backgroundColor: theme === 'light' ? '#E65100' : 'transparent', borderRadius: 8}}>
                   <Text style={{fontWeight: '600', color: theme === 'light' ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)')}}>Light</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => setTheme('dark')} style={{padding: 6, backgroundColor: theme === 'dark' ? '#E65100' : 'transparent', borderRadius: 8}}>
                   <Text style={{fontWeight: '600', color: theme === 'dark' ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)')}}>Dark</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => setTheme('system')} style={{padding: 6, backgroundColor: theme === 'system' ? '#E65100' : 'transparent', borderRadius: 8}}>
                   <Text style={{fontWeight: '600', color: theme === 'system' ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)')}}>System</Text>
                 </TouchableOpacity>
               </View>
            </View>

            <TouchableOpacity 
              onPress={() => signOut(auth).then(() => router.replace('/login'))} 
              style={{marginTop: 24, backgroundColor: 'rgba(255, 59, 48, 0.2)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.4)'}}>
              <Text style={{color: '#ff3b30', fontWeight: 'bold', textAlign: 'center', fontSize: 16}}>Sign Out ({auth.currentUser?.displayName || 'User'})</Text>
            </TouchableOpacity>
          </BlurView>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  linkText: {
    color: isDark ? '#64d2ff' : '#E65100',
    fontSize: 17,
    fontWeight: '600',
  },
  card: {
    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
  },
  adminHeader: {
    marginBottom: 20,
  },
  adminTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: isDark ? '#fff' : '#000',
  },
  adminSubtitle: {
    fontSize: 14,
    color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    marginTop: 4,
  },
  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  adminRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#000',
  },
  adminRowSub: {
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    marginTop: 2,
  },
});
