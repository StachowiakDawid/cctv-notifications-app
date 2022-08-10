import { PermissionsAndroid, useColorScheme, View } from "react-native";
import { Button, MD3DarkTheme, MD3LightTheme, PaperProvider, TextInput, useTheme } from "react-native-paper";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from "react";
import axios from "axios";
import NotificationsList from "./notificationsList";
import { useNavigation } from "expo-router";
import { getMessaging } from "@react-native-firebase/messaging";

axios.defaults.baseURL = process.env.EXPO_PUBLIC_API_URL;

PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

getMessaging().onNotificationOpenedApp(remoteMessage => {
  // router.navigate({ pathname: '/' });
  WebBrowser.openBrowserAsync(remoteMessage!.data!.url as string);
});
getMessaging().getInitialNotification().then(remoteMessage => {
  WebBrowser.openBrowserAsync(remoteMessage!.data!.url as string);
});

export default function Index() {
  const navigation = useNavigation();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const paperTheme =
    colorScheme === 'dark'
      ? { ...MD3DarkTheme, colors: theme.dark }
      : { ...MD3LightTheme, colors: theme.light };
      
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
        const newToken = await getMessaging().getToken();
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
      token
    }).then(() => {
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
    registerToken(name, await getMessaging().getToken());
  }

  return (
    <PaperProvider theme={paperTheme}>
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
