import React, { useState, useContext } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Platform, StatusBar, Image } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeContext } from '../ThemeContext';

export default function ChatScreen() {
  const { isDark, sendLocalNotification } = useContext(ThemeContext);
  const styles = getStyles(isDark);

  const [activeChat, setActiveChat] = useState('entire');
  const [newMessage, setNewMessage] = useState('');

  type Message = { id: string; sender: string; text: string; time: string; image?: string; };

  const [entireFamilyMessages, setEntireFamilyMessages] = useState<Message[]>([
    { id: '1', sender: 'Aunt Sue', text: 'Are we still doing the reunion in July?', time: '9:00 AM' },
    { id: '2', sender: 'Dad', text: 'Yes! Need to finalize the cabin rental.', time: '9:15 AM' },
    { id: '3', sender: 'Uncle Bob', text: 'Look at this cabin I found!', image: 'https://images.unsplash.com/photo-1542315059-c2847a469f37?w=400&q=80', time: '9:30 AM'}
  ]);

  const [householdMessages, setHouseholdMessages] = useState<Message[]>([
    { id: '1', sender: 'Mom', text: 'Hey family! Who wants pizza for dinner tonight?', time: '10:00 AM' },
    { id: '2', sender: 'Dad', text: 'I am down! 🍕', time: '10:05 AM' },
    { id: '3', sender: 'Ava', text: 'Yes please!!! Can we get pepperoni?', time: '10:12 AM' }
  ]);

  const currentMessages = activeChat === 'entire' ? entireFamilyMessages : householdMessages;
  const setCurrentMessages = activeChat === 'entire' ? setEntireFamilyMessages : setHouseholdMessages;

  const sendEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const pickImage = () => {
    alert("Image picker would open here!");
    
    setTimeout(() => {
      setCurrentMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'Me',
        text: '',
        image: 'https://images.unsplash.com/photo-1616091093714-c64882e9ab55?w=400&q=80',
        time: 'Just now'
      }]);
    }, 1000);
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      setCurrentMessages([...currentMessages, {
        id: Date.now().toString(),
        sender: 'Me',
        text: newMessage,
        time: 'Just now'
      }]);
      setNewMessage('');

      // Simulate reply to trigger notification
      setTimeout(() => {
        sendLocalNotification("Johnson Family App", `Mom: Sounds good!`);
        setCurrentMessages((prev) => [...prev, {
          id: Date.now().toString(),
          sender: 'Mom',
          text: 'Sounds good!',
          time: 'Just now'
        }]);
      }, 2000);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Family Chat</Text>
      </View>

      <View style={styles.segmentContainer}>
        <TouchableOpacity 
          style={[styles.segment, activeChat === 'entire' && styles.segmentActive]}
          onPress={() => setActiveChat('entire')}
        >
          <Text style={[styles.segmentText, activeChat === 'entire' && styles.segmentTextActive]}>Johnson Family</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segment, activeChat === 'household' && styles.segmentActive]}
          onPress={() => setActiveChat('household')}
        >
          <Text style={[styles.segmentText, activeChat === 'household' && styles.segmentTextActive]}>Our Household</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.chatArea} contentContainerStyle={styles.chatContent}>
        {currentMessages.map((msg) => {
          const isMe = msg.sender === 'Me';
          return (
            <View key={msg.id} style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, msg.image && styles.imageBubble]}>
              {!isMe && <Text style={styles.senderName}>{msg.sender}</Text>}
              
              {msg.image && (
                <Image source={{ uri: msg.image }} style={styles.messageImage} />
              )}
              
              {!!msg.text && (
                 <Text style={[styles.messageText, isMe && styles.myMessageText]}>{msg.text}</Text>
              )}
              
              <Text style={[styles.timeText, isMe && {color: msg.image ? '#8e8e93' : '#d1d1d6'}]}>{msg.time}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.emojiBar}>
        {['👍', '❤️', '😂', '🔥', '🎉'].map(emoji => (
          <TouchableOpacity key={emoji} onPress={() => sendEmoji(emoji)} style={styles.quickEmoji}>
            <Text style={styles.quickEmojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.gifButton}>
          <Text style={styles.gifButtonText}>GIF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
          <IconSymbol name="plus.circle.fill" size={28} color={isDark ? "#8e8e93" : "#8e8e93"} />
        </TouchableOpacity>
        
        <TextInput 
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={isDark ? "#8e8e93" : "#c7c7cc"}
          value={newMessage}
          onChangeText={setNewMessage}
        />
        
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <IconSymbol name="arrow.up.circle.fill" size={32} color="#007aff" />
        </TouchableOpacity>
      </View>
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
    padding: 20,
    paddingBottom: 12,
    backgroundColor: isDark ? '#121212' : '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? '#fff' : '#000',
  },
  segmentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: isDark ? '#121212' : '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? '#2c2c2e' : '#c6c6c8',
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
  chatArea: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#f2f2f7',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 40,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  imageBubble: {
    padding: 4,
    paddingBottom: 8,
    backgroundColor: isDark ? '#2c2c2e' : '#fff',
  },
  theirMessage: {
    backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  myMessage: {
    backgroundColor: '#007aff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#aeaeb2' : '#8e8e93',
    marginBottom: 4,
    marginLeft: 8,
  },
  messageText: {
    fontSize: 16,
    color: isDark ? '#fff' : '#1c1c1e',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  messageImage: {
    width: 240,
    height: 240,
    borderRadius: 16,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    color: isDark ? '#636366' : '#8e8e93',
    alignSelf: 'flex-end',
    marginTop: 4,
    marginRight: 4,
  },
  emojiBar: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#121212' : '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? '#2c2c2e' : '#c6c6c8',
    alignItems: 'center',
    gap: 12,
  },
  quickEmoji: {
    padding: 4,
  },
  quickEmojiText: {
    fontSize: 24,
  },
  gifButton: {
    backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  gifButtonText: {
    fontWeight: '700',
    color: isDark ? '#fff' : '#1c1c1e',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: isDark ? '#121212' : '#fff',
    alignItems: 'center',
  },
  attachButton: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7',
    color: isDark ? '#fff' : '#000',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
  },
});
