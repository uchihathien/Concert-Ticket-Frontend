import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ALL_CITIES = 'all';

/**
 * Bảng chọn thành phố — bản app của ô "Toàn quốc ▾" trên header web (components/CityPicker.tsx
 * bên web-customer). Cùng danh sách: các thành phố có sự kiện đang bán, backend gửi kèm trong
 * `EventPage.cities`, cộng "Toàn quốc" ở đầu.
 */
export function CityPickerSheet({
  visible,
  cities,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  cities: string[];
  value: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const options = [{ value: ALL_CITIES, label: 'Toàn quốc' }, ...cities.map((city) => ({ value: city, label: city }))];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Đóng" onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>CHỌN THÀNH PHỐ</Text>
          <ScrollView style={styles.list}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                >
                  <SymbolView
                    name={option.value === ALL_CITIES ? { ios: 'globe.asia.australia.fill', android: 'public', web: 'public' } : { ios: 'mappin.circle.fill', android: 'location_on', web: 'location_on' }}
                    tintColor={selected ? '#D5FF66' : '#A6B1A8'}
                    size={18}
                  />
                  <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{option.label}</Text>
                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { maxHeight: '70%', paddingHorizontal: 14, paddingTop: 8, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#3B493F', marginBottom: 12 },
  title: { color: '#A6B1A8', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, paddingHorizontal: 6, marginBottom: 6 },
  list: { flexGrow: 0 },
  row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 10 },
  rowSelected: { backgroundColor: '#20291C' },
  rowPressed: { backgroundColor: '#212C23' },
  rowText: { flex: 1, color: '#F1F5F1', fontSize: 15, fontWeight: '700' },
  rowTextSelected: { color: '#D5FF66' },
  check: { color: '#D5FF66', fontSize: 16, fontWeight: '900' },
});
