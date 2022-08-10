import * as SQLite from 'expo-sqlite';
import { CctvNotification } from './models';

export const getDBConnection = async (): Promise<SQLite.SQLiteDatabase> => {
  return SQLite.openDatabaseAsync('notifications');
};

export const createNotificationsTable = async (db: SQLite.SQLiteDatabase) => {
  const query =
    'CREATE TABLE IF NOT EXISTS cctv_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, date INTEGER UNIQUE, url TEXT)';
  await db.runAsync(query);
};

export const getNotifications = async (
  db: SQLite.SQLiteDatabase,
  limit: number = 5,
  offset: number = 5,
): Promise<CctvNotification[]> => {
  try {
    const notifications: CctvNotification[] = [];
    const results = await db.getAllAsync(
      `SELECT * FROM cctv_notifications ORDER BY date DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    results.forEach((result: any) => {
      notifications.push(result);
    });
    return notifications;
  } catch (error) {
    console.error(error);
    throw Error('Failed to get notifications !!!');
  }
};

export const insertNotifications = async (
  db: SQLite.SQLiteDatabase,
  notifications: CctvNotification[],
): Promise<void> => {
  try {
    await db.withTransactionAsync(async () => {
      const statement = await db.prepareAsync(
        `INSERT INTO cctv_notifications (date, url) VALUES ($date, $url)`
      );
      try {
        notifications.forEach(async notification => {
          await statement.executeAsync({ $date: notification.date, $url: notification.url });
        });
      } finally {
        await statement.finalizeAsync();
      }
    });
  } catch (error) {
    console.error(error);
    throw Error('Failed to insert notification !!!');
  }
};
