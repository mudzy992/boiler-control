import React, { useRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Box, useColorModeValue } from 'native-base';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: (number | string)[];
}

/**
 * BottomSheetModal - Reusable bottom sheet component
 * Replaces Native Base Modal for modern mobile UX
 */
export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isOpen,
  onClose,
  children,
  snapPoints = ['50%', '90%'],
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const animatedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

  const bgColor = useColorModeValue('white', 'gray.800');
  const handleColor = useColorModeValue('gray.300', 'gray.600');

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop disappearsOnIndex={-1} appearsOnIndex={0} {...props} opacity={0.5} />
    ),
    []
  );

  React.useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={animatedSnapPoints}
      onClose={onClose}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        {
          backgroundColor: bgColor,
        },
        styles.buttonSheetStyle,
      ]}
      handleIndicatorStyle={{
        backgroundColor: handleColor,
      }}
      style={styles.buttonSheetStyle}
    >
      <BottomSheetView style={styles.contentContainer}>
        <Box flex={1} width="100%">
          {children}
        </Box>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonSheetStyle: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,

    elevation: 16,
  },
});
