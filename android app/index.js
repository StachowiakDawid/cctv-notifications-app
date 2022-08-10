import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { Provider as PaperProvider } from 'react-native-paper';
import { firebase } from '@react-native-firebase/messaging';
import { FIREBASE_APP_ID, FIREBASE_APP_NAME } from './constants';

firebase.initializeApp({
  appId: FIREBASE_APP_ID,
  projectId: FIREBASE_APP_NAME
});

export default function Main() {
  return (
    <PaperProvider>
      <App />
    </PaperProvider>
  );
}

AppRegistry.registerComponent(appName, () => Main);
