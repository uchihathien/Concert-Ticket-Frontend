import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface PromptSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel: string;
  /** Không cho xác nhận khi ô nhập trống (sau khi cắt khoảng trắng). */
  required?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'sentences';
  maxLength?: number;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** Một ô nhập trong hộp thoại — `Alert.prompt` chỉ có trên iOS. */
export function PromptSheet(props: PromptSheetProps) {
  return (
    <Modal animationType="fade" transparent visible={props.visible} onRequestClose={props.onClose}>
      {/* Thân chỉ được dựng khi mở: mỗi lần mở là một ô nhập mới, bắt đầu lại từ `initialValue`. */}
      {props.visible ? <PromptBody {...props} /> : null}
    </Modal>
  );
}

function PromptBody({
  title,
  description,
  placeholder,
  initialValue = '',
  confirmLabel,
  required = false,
  autoCapitalize = 'sentences',
  maxLength,
  onSubmit,
  onClose,
}: PromptSheetProps) {
  const [value, setValue] = useState(initialValue);
  const blocked = required && value.trim().length === 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoFocus
          maxLength={maxLength}
          onChangeText={setValue}
          onSubmitEditing={() => { if (!blocked) onSubmit(value.trim()); }}
          placeholder={placeholder}
          placeholderTextColor="#6F7C73"
          returnKeyType="done"
          style={styles.input}
          value={value}
        />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>Huỷ</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={blocked}
            onPress={() => onSubmit(value.trim())}
            style={({ pressed }) => [styles.confirm, pressed && styles.pressed, blocked && styles.disabled]}>
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0, 0, 0, 0.66)' },
  sheet: { borderRadius: 12, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', padding: 18 },
  title: { color: '#F1F5F1', fontSize: 17, fontWeight: '800' },
  description: { color: '#A6B1A8', fontSize: 13, lineHeight: 19, marginTop: 6 },
  input: { minHeight: 48, marginTop: 14, borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#111713', color: '#F1F5F1', fontSize: 16, paddingHorizontal: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancel: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#3B493F' },
  cancelText: { color: '#C2CCC4', fontSize: 14, fontWeight: '700' },
  confirm: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#D5FF66' },
  confirmText: { color: '#17210D', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
