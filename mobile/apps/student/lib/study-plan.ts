import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

const STORAGE_KEY = 'rafeeq.study-tasks.v1';
const CHANNEL_ID = 'study-reminders';

export type StudyTask = {
  id: string;
  subject: string;
  title: string;
  startsAt: string;
  endsAt: string;
  completed: boolean;
  reminderId?: string;
};

export type NewStudyTask = Omit<StudyTask, 'id' | 'completed' | 'reminderId'>;

export async function loadStudyTasks(): Promise<StudyTask[]> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isTask).sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
}

export async function saveStudyTasks(tasks: StudyTask[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export async function createStudyTask(input: NewStudyTask, studentName?: string): Promise<StudyTask> {
  const task: StudyTask = { ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, completed: false };
  const reminderId = await scheduleReminder(task, studentName);
  return reminderId ? { ...task, reminderId } : task;
}

export async function removeReminder(task: StudyTask): Promise<void> {
  if (task.reminderId) await Notifications.cancelScheduledNotificationAsync(task.reminderId).catch(() => undefined);
}

async function scheduleReminder(task: StudyTask, studentName?: string): Promise<string | undefined> {
  const start = new Date(task.startsAt);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now() + 30_000) return undefined;
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return undefined;

  if (process.env.EXPO_OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: 'Study reminders', importance: AndroidImportance.HIGH, vibrationPattern: [0, 200, 150, 200], lightColor: '#0D6FEA' });
  }
  const name = studentName?.trim();
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Rafeeq', body: `${name ? `حان موعدك يا ${name}` : 'حان موعد دراستك'} — ${task.subject}`, sound: 'default', data: { taskId: task.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: start, channelId: CHANNEL_ID },
  });
}

function isTask(value: unknown): value is StudyTask {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<StudyTask>;
  return typeof task.id === 'string' && typeof task.subject === 'string' && typeof task.title === 'string' && typeof task.startsAt === 'string' && typeof task.endsAt === 'string' && typeof task.completed === 'boolean';
}
