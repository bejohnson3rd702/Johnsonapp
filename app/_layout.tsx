import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { ThemeProvider as AppThemeProvider, useTheme } from './ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { isDark } = useTheme();
  
  const [user, setUser] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setUser(usr);
      setIsReady(true);
      
      // If user logs in, request Push Notification permission & register token
      if (usr) {
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
            });
          }

          if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            
            if (existingStatus !== 'granted') {
              const { status } = await Notifications.requestPermissionsAsync();
              finalStatus = status;
            }
            
            if (finalStatus === 'granted') {
              // Explicit Project ID extracted from app.json
              const pushTokenData = await Notifications.getExpoPushTokenAsync({
                projectId: 'f70eeae9-9b7b-46b6-8192-8cf0352f8ec1'
              });
              
              if (pushTokenData && pushTokenData.data) {
                // Update the user's document in Firestore with the push token
                await updateDoc(doc(db, 'users', usr.uid), {
                  expoPushToken: pushTokenData.data
                });
              }
            }
          }
        } catch (error) {
           console.log("Could not register push token securely:", error);
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Wait until the router is fully mounted and Firebase has returned the initial user state
    if (!isReady || !navigationState?.key) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Kick them out to login if they try to access tabs when logged out
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Push them to tabs if they try to access login when already logged in
      router.replace('/(tabs)');
    }
  }, [user, segments, navigationState?.key, isReady]);

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Create Event' }} />
        <Stack.Screen name="appliance-schedule" options={{ presentation: 'modal', title: 'Schedule Appliance' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
