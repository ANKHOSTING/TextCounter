import { Alert, Platform } from 'react-native';

/** Confirm a destructive action. Web has no multi-button React Native alerts. */
export function confirmAction(title: string, message: string | undefined, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    const text = message ? `${title}\n\n${message}` : title;
    if (ask?.(text)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
