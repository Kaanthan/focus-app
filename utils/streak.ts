import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = 'user_streak_count';
const LAST_ACTIVE_DATE_KEY = 'user_last_active_date';

export const updateStreak = async (): Promise<number> => {
    try {
        const today = new Date().toDateString();
        const lastActiveDate = await AsyncStorage.getItem(LAST_ACTIVE_DATE_KEY);
        const currentStreakStr = await AsyncStorage.getItem(STREAK_KEY);
        let currentStreak = currentStreakStr ? parseInt(currentStreakStr) : 0;

        if (lastActiveDate === today) {
            // Already active today; return current streak
            return currentStreak;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastActiveDate === yesterday.toDateString()) {
            // Consecutive day
            currentStreak += 1;
        } else {
            // Streaks broken or new user
            currentStreak = 1;
        }

        await AsyncStorage.setItem(LAST_ACTIVE_DATE_KEY, today);
        await AsyncStorage.setItem(STREAK_KEY, currentStreak.toString());

        return currentStreak;
    } catch (e) {
        console.error('Error updating streak:', e);
        return 0;
    }
};

export const getStreak = async (): Promise<number> => {
    try {
        const streak = await AsyncStorage.getItem(STREAK_KEY);
        return streak ? parseInt(streak) : 0;
    } catch (e) {
        return 0;
    }
};
