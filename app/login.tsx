import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { ThemeContext } from './ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function LoginScreen() {
  const { isDark } = useContext(ThemeContext);
  const styles = getStyles(isDark);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return alert("Please fill out all fields.");
    
    setLoading(true);
    try {
      if (isRegistering) {
        if (!name || !birthday) {
            setLoading(false);
            return alert("Please enter your name and birthday!");
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name,
          email,
          birthday,
          role: 'child', // default to child until approved for own household
          householdId: 'pending', // Users are globally registered at first, admin assigns to household later
          hasWasherAccess: false,
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient 
        colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#e0c3fc', '#8ec5fc', '#4facfe']} 
        style={styles.container}
      >
        <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.card}>
          <View style={styles.iconContainer}>
             <IconSymbol name="house.circle.fill" size={72} color={isDark ? '#fff' : '#007aff'} />
          </View>
          <Text style={styles.title}>Johnson Group</Text>
          <Text style={styles.subtitle}>{isRegistering ? 'Create your unique family profile' : 'Welcome back to the family hub'}</Text>
          
          <View style={styles.formContainer}>
            {isRegistering && (
                <View>
                  <View style={[styles.inputWrapper, {backgroundColor: isDark ? 'rgba(0,0,0,0.4)': 'rgba(255,255,255,0.7)'}]}>
                      <IconSymbol name="person.fill" size={20} color={isDark ? "#8e8e93" : "#8e8e93"} style={styles.inputIcon} />
                      <TextInput 
                          style={styles.input} 
                          placeholder="Your First Name"
                          placeholderTextColor={isDark ? "#8e8e93" : "#8e8e93"}
                          value={name}
                          onChangeText={setName}
                      />
                  </View>
                  <View style={[styles.inputWrapper, {backgroundColor: isDark ? 'rgba(0,0,0,0.4)': 'rgba(255,255,255,0.7)'}]}>
                      <IconSymbol name="calendar" size={20} color={isDark ? "#8e8e93" : "#8e8e93"} style={styles.inputIcon} />
                      <TextInput 
                          style={styles.input} 
                          placeholder="Birthday (MM/DD/YYYY)"
                          placeholderTextColor={isDark ? "#8e8e93" : "#8e8e93"}
                          value={birthday}
                          onChangeText={setBirthday}
                      />
                  </View>
                </View>
            )}

            <View style={[styles.inputWrapper, {backgroundColor: isDark ? 'rgba(0,0,0,0.4)': 'rgba(255,255,255,0.7)'}]}>
                <IconSymbol name="envelope.fill" size={20} color={isDark ? "#8e8e93" : "#8e8e93"} style={styles.inputIcon} />
                <TextInput 
                    style={styles.input} 
                    placeholder="Email Address"
                    placeholderTextColor={isDark ? "#8e8e93" : "#8e8e93"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
            </View>

            <View style={[styles.inputWrapper, {backgroundColor: isDark ? 'rgba(0,0,0,0.4)': 'rgba(255,255,255,0.7)'}]}>
               <IconSymbol name="lock.fill" size={20} color={isDark ? "#8e8e93" : "#8e8e93"} style={styles.inputIcon} />
               <TextInput 
                   style={styles.input} 
                   placeholder="Password"
                   placeholderTextColor={isDark ? "#8e8e93" : "#8e8e93"}
                   secureTextEntry
                   value={password}
                   onChangeText={setPassword}
               />
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegistering ? 'Join the Hub' : 'Enter Home'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleText} onPress={() => setIsRegistering(!isRegistering)}>
              <Text style={styles.linkText}>
                  {isRegistering ? "Returning? Log In" : "New member? Sign Up"}
              </Text>
          </TouchableOpacity>
        </BlurView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    padding: 32,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: isDark ? '#fff' : '#1c1c1e',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    gap: 16,
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: isDark ? '#fff' : '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: isDark ? '#0a84ff' : '#007aff',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleText: {
    marginTop: 16,
    alignItems: 'center',
    padding: 10,
  },
  linkText: {
    color: isDark ? '#64d2ff' : '#007aff',
    fontSize: 15,
    fontWeight: '700',
  }
});
