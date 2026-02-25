import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface BottomSheetProviderProps {
  children: React.ReactNode;
}

/**
 * BottomSheetProvider - Wraps the app with GestureHandler root view
 * and provides context for bottom-sheet components
 */
export const BottomSheetProvider: React.FC<BottomSheetProviderProps> = ({ children }) => {
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
};
