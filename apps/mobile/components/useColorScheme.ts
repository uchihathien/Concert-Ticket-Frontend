import { useColorScheme as useColorSchemeCore } from 'react-native';

export const useColorScheme = () => {
  const coreScheme = useColorSchemeCore();
  // React Native 0.88 trả `null` khi hệ điều hành không báo chế độ màu (trước đây là 'unspecified').
  return coreScheme ?? 'light';
};
