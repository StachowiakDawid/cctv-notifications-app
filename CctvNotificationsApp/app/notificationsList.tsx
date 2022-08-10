import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { List } from 'react-native-paper';
import { CctvNotification } from './models';
import * as WebBrowser from 'expo-web-browser';
import { format } from 'date-fns';
import { createNotificationsTable, getDBConnection, getNotifications, insertNotifications } from './db-service';
import axios from 'axios';
import { SQLiteDatabase } from 'expo-sqlite';
import { getMessaging } from "@react-native-firebase/messaging";

const NotificationsList = (props: { name: string }) => {
    const [notifications, setNotifications] = useState<CctvNotification[]>([]);
    const pageSize = 30;
    const [isLastPage, setIsLastPage] = useState(false);
    const [latestPagekey, setLatestPageKey] = useState(0);

    const messageHandler = async (remoteMessage: any) => {
        syncDataFromServer(props.name);
    }

    const uniqueBy = (k: any, s = new Set) => (o: any) => !s.has(o[k]) && s.add(o[k]);

    useEffect(() => {
        if (props.name !== '') {
            getDBConnection().then(async (db: SQLiteDatabase) => {
                await createNotificationsTable(db);
                syncDataFromServer(props.name);
                fetchMoreDataFromDB();
                getMessaging().onMessage(messageHandler);
                getMessaging().setBackgroundMessageHandler(messageHandler);
            });
        }
    }, []);

    const syncDataFromServer = (name: string | null) => {
        axios.get(`/fetch-unsent/${name}`).then(response => {
            const idsToConfirm: any[] = [];
            const newNotifications: CctvNotification[] = [];
            response.data.forEach((el: any) => {
                idsToConfirm.push(el.id);
                newNotifications.push({ id: 0, date: parseInt(el.content.split('/')[4].split('.')[0]), url: el.content });
            });
            if (newNotifications.length > 0) {
                getDBConnection().then(async (db: SQLiteDatabase) => {
                    await insertNotifications(db, newNotifications);
                    setNotifications(notifications => [...newNotifications, ...notifications].filter(uniqueBy("date")).sort((a, b) => (b.date - a.date)));
                    axios.post(`/confirm-fetching/${name}`, {
                        fetched: idsToConfirm,
                    }).then(res => { }, (err: any) => {
                        console.log(`confirm ${err}`);
                    });
                });
            }
        }).then(res => { }, (err: any) => {
            console.log(`sync ${err}`);
        });
    }

    const fetchMoreDataFromDB = () => {
        if (!isLastPage) {
            getDBConnection().then(async (db: SQLiteDatabase) => {
                const data = await getNotifications(db, pageSize, latestPagekey);
                if (data.length < pageSize) {
                    setIsLastPage(true);
                } else {
                    setLatestPageKey(latestPagekey + pageSize);
                }
                setNotifications(notifications.concat(data).filter(uniqueBy("date")));
            });
        }
    }

    const renderItem = ({ item }: any) => {
        return (
            <List.Item title={format(new Date(item.date), 'dd-MM-yyyy HH:mm:ss')} onPress={async () => {
                await WebBrowser.openBrowserAsync(item.url);
            }} />
        );
    };

    return (
        <View style={{ flex: 1 }}>
            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={(item: any) => item.date}
                extraData={notifications.length}
                onEndReachedThreshold={0.2}
                onEndReached={fetchMoreDataFromDB}
            />
        </View>
    );
};

export default NotificationsList;
