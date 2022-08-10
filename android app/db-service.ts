import {
  enablePromise,
  openDatabase,
  SQLiteDatabase,
} from 'react-native-sqlite-storage';
import {CctvNotification} from './models';

export const getDBConnection = async (): Promise<SQLiteDatabase> => {
  return openDatabase({name: 'notifications.db', location: 'default'});
};

export const createNotificationsTable = async (db: SQLiteDatabase) => {
  const query =
    'CREATE TABLE IF NOT EXISTS cctv_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, date INTEGER, url TEXT)';
  await db.executeSql(query);
};

export const getNotifications = async (
  db: SQLiteDatabase,
  limit: number = 5,
  offset: number = 5,
): Promise<CctvNotification[]> => {
  try {
    const notifications: CctvNotification[] = [];
    const results = await db.executeSql(
      `SELECT * FROM cctv_notifications ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        notifications.push(result.rows.item(index));
      }
    });
    return notifications;
  } catch (error) {
    console.error(error);
    throw Error('Failed to get notifications !!!');
  }
};

export const insertNotifications = async (
  db: SQLiteDatabase,
  notifications: CctvNotification[],
): Promise<void> => {
  try {
    await db.transaction(tx => {
      notifications.forEach(async notification => {
        tx.executeSql(
          `INSERT INTO cctv_notifications (date, url) VALUES (?,?)`,
          [notification.date, notification.url],
        );
      });
    });
  } catch (error) {
    console.error(error);
    throw Error('Failed to insert notification !!!');
  }
};

enablePromise(true);
