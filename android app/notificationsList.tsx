import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { List } from 'react-native-paper';
import { CctvNotification } from './models';;
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { format } from 'date-fns';
import { createNotificationsTable, getDBConnection, getNotifications, insertNotifications } from './db-service';
import { SQLiteDatabase } from 'react-native-sqlite-storage';
import axios from 'axios';
import messaging from '@react-native-firebase/messaging';

const NotificationsList = (props: { name: string }) => {
    const [notifications, setNotifications] = useState<CctvNotification[]>([]);
    const pageSize = 30;
    const [isLastPage, setIsLastPage] = useState(false);
    const [latestPagekey, setLatestPageKey] = useState(0);

    const messageHandler = async (remoteMessage: any) => {
        syncDataFromServer(props.name);
    }

    useEffect(() => {
        if (props.name !== '') {
            getDBConnection().then(async (db: SQLiteDatabase) => {
                await createNotificationsTable(db);
                syncDataFromServer(props.name);
                fetchMoreDataFromDB();
                messaging().onMessage(messageHandler);
                messaging().setBackgroundMessageHandler(messageHandler);
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
                    setNotifications(notifications => [...newNotifications, ...notifications]);
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
                setNotifications(notifications.concat(data));
            });
        }
    }

    const renderItem = ({ item }: any) => {
        return (
            <List.Item title={format(new Date(item.date), 'dd-MM-yyyy HH:mm:ss')} onPress={() => {
                InAppBrowser.open(item.url);
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
