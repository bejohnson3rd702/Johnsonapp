import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeContext } from '../ThemeContext';
import { auth, db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';

export default function ShoppingScreen() {
  const { isDark } = useContext(ThemeContext);
  const styles = getStyles(isDark);
  
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'shopping_list'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
       setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleAddItem = async () => {
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, 'shopping_list'), {
         name: newItem.trim(),
         addedBy: auth.currentUser?.displayName || 'Family',
         createdAt: serverTimestamp()
      });
      setNewItem('');
    } catch(e) {}
  };

  const handleRemoveItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shopping_list', id));
    } catch(e) {}
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <LinearGradient colors={isDark ? ['#3E2723', '#4E342E', '#5D4037'] : ['#FFF3E0', '#FFE0B2', '#FFCC80']} style={styles.safeArea}>
    <SafeAreaView style={{flex: 1}}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Shopping List</Text>
      </View>

      <View style={styles.inputContainer}>
         <TextInput
            style={styles.input}
            placeholder="Add an item to the list..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
         />
         <TouchableOpacity onPress={handleAddItem} style={styles.addButton}>
            <IconSymbol name="plus" size={24} color="#FFF" />
         </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
         <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.card}>
            {items.length === 0 ? (
               <View style={styles.emptyWrap}>
                   <IconSymbol name="cart" size={48} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                   <Text style={[styles.emptyText, {color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}]}>
                       The shopping list is currently empty.
                   </Text>
               </View>
            ) : (
               items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                     <View style={{flex: 1}}>
                         <Text style={styles.itemName}>{item.name}</Text>
                         <Text style={styles.itemSubName}>Added by {item.addedBy}</Text>
                     </View>
                     <TouchableOpacity onPress={() => handleRemoveItem(item.id)} style={styles.checkBtn}>
                        <IconSymbol name="checkmark.circle" size={28} color="#FF7043" />
                     </TouchableOpacity>
                  </View>
               ))
            )}
         </BlurView>
         <View style={{height: 100}} />
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, },
  title: { fontSize: 28, fontWeight: '700', color: isDark ? '#fff' : '#000', letterSpacing: -0.5, },
  inputContainer: {
     flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15, gap: 10
  },
  input: {
     flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)',
     borderRadius: 16, paddingHorizontal: 16, color: isDark ? '#fff' : '#000',
     fontSize: 16, height: 50
  },
  addButton: {
     backgroundColor: '#E65100', width: 50, height: 50, borderRadius: 16,
     alignItems: 'center', justifyContent: 'center'
  },
  container: { flex: 1, },
  content: { padding: 20, paddingTop: 0, },
  card: {
    borderRadius: 24, padding: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
    minHeight: 200,
  },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.8 },
  emptyText: { marginTop: 15, fontSize: 16, fontWeight: '500' },
  itemRow: {
     flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
     borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  },
  itemName: { fontSize: 18, fontWeight: '600', color: isDark ? '#fff' : '#1c1c1e' },
  itemSubName: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: 4 },
  checkBtn: { paddingLeft: 15 }
});
