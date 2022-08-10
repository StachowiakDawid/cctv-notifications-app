import { View, PermissionsAndroid } from "react-native";
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, PaperProvider, TextInput } from 'react-native-paper';
import NotificationsList from './notificationsList';
import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import messaging from '@react-native-firebase/messaging';
import { getApps, initializeApp } from "firebase/app";
import { APP_API_URL, FIREBASE_APP_ID, FIREBASE_PROJECT_ID, FIREBASE_APP_API_KEY, FIREBASE_SENDER_ID } from './constants';
import { useNavigation, router } from "expo-router";

PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

if (getApps().length < 1) {
  initializeApp({
    appId: FIREBASE_APP_ID,
    projectId: FIREBASE_PROJECT_ID,
    apiKey: FIREBASE_APP_API_KEY,
    messagingSenderId: FIREBASE_SENDER_ID,
    databaseURL: '',
    storageBucket: ''
  });
}

axios.defaults.baseURL = APP_API_URL;

messaging().onNotificationOpenedApp(remoteMessage => {
  // router.navigate({ pathname: '/' });
  WebBrowser.openBrowserAsync(remoteMessage!.data!.url as string);
});
messaging().getInitialNotification().then(remoteMessage => {
  WebBrowser.openBrowserAsync(remoteMessage!.data!.url as string);
});

export default function Index() {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('name').then(async (name) => {
      if (name !== null) {
        setName(name);
        setIsLoaded(true);
        setIsConfigured(true);
        const newToken = await messaging().getToken();
        const oldToken = await AsyncStorage.getItem('token');
        if (oldToken !== newToken) {
          registerToken(name, newToken);
        }
      } else {
        setIsLoaded(true);
      }
    })
  }, []);

  const registerToken = (name: string, token: string) => {
    axios.post(`/register-token/${name}`, {
      token: token
    }).then(res => {
      AsyncStorage.setItem('token', token);
      AsyncStorage.setItem('name', name);
      setName(name);
      setIsConfigured(true);
      setIsLoaded(true);
    }, (err: any) => {
      console.log(`register ${err}`);
    });
  }

  const submitName = async () => {
    registerToken(name, await messaging().getToken());
  }

  return (
    <PaperProvider>
      <View style={{ flex: 1 }}>
        {isConfigured ?
          <NotificationsList name={name} />
          :
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {isLoaded && <>
              <TextInput placeholder="Wprowadź swoją nazwę" value={name} onChangeText={setName} />
              <Button onPress={submitName}>Zapisz nazwę</Button>
            </>}
          </View>
        }
      </View>
    </PaperProvider>
  );
}
