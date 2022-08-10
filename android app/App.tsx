import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, TextInput } from 'react-native-paper';
import NotificationsList from './notificationsList';
import axios from 'axios';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import messaging from '@react-native-firebase/messaging';
import { APP_API_URL } from './constants';

axios.defaults.baseURL = APP_API_URL;

messaging().onNotificationOpenedApp(remoteMessage => {
  InAppBrowser.open(remoteMessage.data!.url);
});
messaging().getInitialNotification().then(remoteMessage => {
  InAppBrowser.open(remoteMessage!.data!.url);
});

const App = () => {
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
  );
};

export default App;
