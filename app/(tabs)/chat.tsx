import React, { useState, useContext, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Platform, StatusBar, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeContext } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';

// --- FIREBASE IMPORTS ---
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

export default function ChatScreen() {
  const { isDark } = useContext(ThemeContext);
  const styles = getStyles(isDark);
  const scrollViewRef = useRef<ScrollView>(null);

  const [myHouseholdId, setMyHouseholdId] = useState<string>('main');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  type Message = { id: string; sender: string; senderId: string; text: string; time: string; householdId: string; createdAt?: any };
  const [messages, setMessages] = useState<Message[]>([
    { id: 'loading', sender: 'System', senderId: 'sys', text: 'Loading family messages...', time: '', householdId: 'main' }
  ]);

  useEffect(() => {
    // 1. Fetch current user's household config
    const fetchHousehold = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setMyHouseholdId(userDoc.data().householdId || 'main');
        }
      }
    };
    fetchHousehold();

    // 2. Listen to all messages in the messages collection
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        let timeString = 'Just now';
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          timeString = date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
        }
        
        return {
          id: doc.id,
          sender: data.sender || 'Unknown',
          senderId: data.senderId || '',
          text: data.text || '',
          time: timeString,
          householdId: data.householdId || 'main'
        } as Message;
      });
      
      setMessages(liveMessages);
      // Auto scroll to bottom
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
    });

    return () => unsubscribe();
  }, []);

  // Filter messages to ONLY show those matching our household ID safely segregating chats automatically
  const currentMessages = messages.filter(m => m.householdId === myHouseholdId || m.id === 'loading');

  const sendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;
    setIsSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        sender: auth.currentUser.displayName || 'Family Member',
        senderId: auth.currentUser.uid,
        text: newMessage.trim(),
        householdId: myHouseholdId,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (e: any) { alert("Message failed: " + e.message); }
    setIsSending(false);
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LinearGradient colors={isDark ? ['#3E2723', '#4E342E', '#5D4037'] : ['#FFF3E0', '#FFE0B2', '#FFCC80']} style={styles.safeArea}>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

          {/* HEADER */}
          <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.headerGlass}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Our Household</Text>
              <Text style={styles.subtitle}>Private Family Chat</Text>
            </View>
          </BlurView>

          {/* CHAT FEED */}
          <ScrollView 
             ref={scrollViewRef} 
             style={styles.chatContainer} 
             contentContainerStyle={{padding: 16, paddingBottom: 20}}
          >
            {currentMessages.length === 0 ? (
               <View style={styles.emptyState}>
                 <Text style={styles.emptyText}>Be the first to say hello!</Text>
               </View>
            ) : (
               currentMessages.map(msg => {
                 const isMe = msg.senderId === auth.currentUser?.uid;
                 const isSystem = msg.id === 'loading';
                 
                 if (isSystem) return (
                     <View key={msg.id} style={{alignItems: 'center', marginVertical: 20}}>
                        <Text style={{color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}}>{msg.text}</Text>
                     </View>
                 );

                 return (
                   <View key={msg.id} style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
                     {!isMe && (
                         <View style={styles.avatarPill}>
                             <Text style={styles.avatarText}>{msg.sender.charAt(0).toUpperCase()}</Text>
                         </View>
                     )}
                     <BlurView 
                        intensity={isDark ? 50 : 80} 
                        tint={blurTint} 
                        style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}
                     >
                       {!isMe && <Text style={styles.messageSender}>{msg.sender}</Text>}
                       <Text style={styles.messageText}>{msg.text}</Text>
                       <Text style={styles.messageTime}>{msg.time}</Text>
                     </BlurView>
                   </View>
                 )
               })
            )}
          </ScrollView>

          {/* INPUT AREA */}
          <BlurView intensity={isDark ? 60 : 90} tint={blurTint} style={styles.inputContainer}>
            <TextInput
              style={styles.inputField}
              placeholder="Message your household..."
              placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
               style={[styles.sendButton, !newMessage.trim() && {opacity: 0.5}]} 
               onPress={sendMessage}
               disabled={!newMessage.trim() || isSending}
            >
              {isSending ? <ActivityIndicator color="#fff" /> : <IconSymbol name="arrow.up" size={20} color="#fff" />}
            </TouchableOpacity>
          </BlurView>

        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1 },
  headerGlass: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  chatContainer: { flex: 1 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageWrapperMe: {
    justifyContent: 'flex-end',
  },
  messageWrapperThem: {
    justifyContent: 'flex-start',
  },
  avatarPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,122,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: isDark ? '#fff' : '#E65100',
    fontWeight: 'bold',
    fontSize: 12,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  messageBubbleMe: {
    backgroundColor: 'rgba(0,122,255,0.2)',
    borderBottomRightRadius: 4,
  },
  messageBubbleThem: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: isDark ? '#fff' : '#1c1c1e',
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 10,
    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: isDark ? '#fff' : '#000',
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E65100',
    alignItems: 'center',
    justifyContent: 'center',
  }
});
