import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal as RNModal, Pressable as RNPressable, View } from 'react-native';
import { useAppColorMode } from '../../theme/AppTheme';
import { resolveColor } from '../../theme/palette';
import { UiImplementationContext } from './migration';
import { Box, HStack, Icon, Pressable, Text } from './primitives';
import type { UiProps } from './styles';

const ModalContext = createContext<{ onClose?: () => void }>({});

function ModalBase(props: UiProps) {
  const { isOpen = false, onClose, children, size = 'md', ...rest } = props;
  const value = useMemo(() => ({ onClose }), [onClose]);
  return (
    <RNModal
      {...rest}
      visible={isOpen}
      transparent
      animationType={rest.animationType ?? 'fade'}
      onRequestClose={onClose}
    >
      <ModalContext.Provider value={value}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: size === 'full' ? 8 : 20,
          }}
        >
          {children}
        </View>
      </ModalContext.Provider>
    </RNModal>
  );
}

function ModalContent(props: UiProps) {
  const { colorMode } = useAppColorMode();
  return (
    <Box
      bg={colorMode === 'dark' ? 'dark.800' : 'white'}
      rounded="lg"
      w="100%"
      maxW="560px"
      maxH="90%"
      overflow="hidden"
      {...props}
    />
  );
}

function ModalCloseButton(props: UiProps) {
  const { onClose } = useContext(ModalContext);
  const { colorMode } = useAppColorMode();
  return (
    <Pressable
      accessibilityLabel="Close dialog"
      accessibilityRole="button"
      onPress={onClose}
      position="absolute"
      top="8px"
      right="8px"
      zIndex={2}
      p={2}
      {...props}
    >
      <Icon
        as={Ionicons}
        name="close"
        size={5}
        color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}
      />
    </Pressable>
  );
}

function ModalHeader(props: UiProps) {
  return (
    <Text
      fontSize="lg"
      fontWeight="700"
      px={5}
      py={4}
      borderBottomWidth={1}
      borderBottomColor="gray.200"
      {...props}
    />
  );
}

function ModalBody(props: UiProps) {
  return <Box px={5} py={4} {...props} />;
}

function ModalFooter(props: UiProps) {
  return (
    <HStack
      px={5}
      py={4}
      space={2}
      justifyContent="flex-end"
      borderTopWidth={1}
      borderTopColor="gray.200"
      {...props}
    />
  );
}

export const Modal = Object.assign(ModalBase, {
  Content: ModalContent,
  CloseButton: ModalCloseButton,
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});

const ActionsheetContext = createContext<{ onClose?: () => void }>({});

function ActionsheetBase(props: UiProps) {
  const { isOpen = false, onClose, children, _backdrop, ...rest } = props;
  const value = useMemo(() => ({ onClose }), [onClose]);
  return (
    <RNModal
      {...rest}
      visible={isOpen}
      transparent
      animationType={rest.animationType ?? 'slide'}
      onRequestClose={onClose}
    >
      <ActionsheetContext.Provider value={value}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <RNPressable
            accessibilityLabel="Close actions"
            onPress={onClose}
            onTouchEnd={_backdrop?.onTouchEnd}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: resolveColor(_backdrop?.bg ?? 'rgba(0,0,0,0.5)'),
            }}
          />
          {children}
        </View>
      </ActionsheetContext.Provider>
    </RNModal>
  );
}

function ActionsheetContent(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { style, ...rest } = props;
  return (
    <Box
      {...rest}
      bg={colorMode === 'dark' ? 'dark.800' : 'white'}
      w="100%"
      p={4}
      style={[{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }, style]}
    />
  );
}

function ActionsheetItem(props: UiProps) {
  return (
    <Pressable
      accessibilityRole="button"
      w="100%"
      px={2}
      py={3}
      rounded="md"
      {...props}
    />
  );
}

export const Actionsheet = Object.assign(ActionsheetBase, {
  Content: ActionsheetContent,
  Item: ActionsheetItem,
});

export interface ToastOptions {
  id?: number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  render?: (props: { id: number }) => React.ReactNode;
  duration?: number | null;
  placement?: 'top' | 'bottom';
  bg?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
}

interface ToastController {
  show: (options: ToastOptions) => number;
  close: (id: number) => void;
  closeAll: () => void;
  isActive: (id: number) => boolean;
}

const ToastContext = createContext<ToastController>({
  show: () => -1,
  close: () => undefined,
  closeAll: () => undefined,
  isActive: () => false,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colorMode } = useAppColorMode();
  const [toasts, setToasts] = useState<(ToastOptions & { id: number })[]>([]);
  const toastsRef = useRef(toasts);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const close = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    toastsRef.current = toastsRef.current.filter((toast) => toast.id !== id);
    setToasts(toastsRef.current);
  }, []);

  const closeAll = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    toastsRef.current = [];
    setToasts([]);
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? nextId.current++;
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      const nextToasts = [
        ...toastsRef.current.filter((toast) => toast.id !== id),
        { ...options, id },
      ];
      toastsRef.current = nextToasts;
      setToasts(nextToasts);
      if (options.duration !== null) {
        const timer = setTimeout(() => close(id), options.duration ?? 4000);
        timers.current.set(id, timer);
      }
      return id;
    },
    [close],
  );

  const controller = useMemo<ToastController>(
    () => ({
      show,
      close,
      closeAll,
      isActive: (id) => toastsRef.current.some((toast) => toast.id === id),
    }),
    [close, closeAll, show],
  );

  const top = toasts.filter((toast) => toast.placement !== 'bottom');
  const bottom = toasts.filter((toast) => toast.placement === 'bottom');

  const renderToast = (toast: ToastOptions & { id: number }) => {
    if (toast.render) {
      return (
        <UiImplementationContext.Provider key={toast.id} value="nativewind">
          {toast.render({ id: toast.id })}
        </UiImplementationContext.Provider>
      );
    }
    const scheme = toast.status === 'success'
      ? 'green.600'
      : toast.status === 'warning'
        ? 'orange.500'
        : toast.status === 'error'
          ? 'red.500'
          : toast.status === 'info'
            ? 'blue.500'
            : colorMode === 'dark'
              ? 'gray.700'
              : 'gray.800';
    return (
      <Box
        key={toast.id}
        bg={toast.bg ?? scheme}
        rounded="lg"
        p={4}
        mb={2}
        shadow={3}
        accessibilityLiveRegion="polite"
      >
        <HStack space={3} alignItems="flex-start">
          <Box flex={1}>
            {toast.title !== undefined && (
              <Text color="white" fontWeight="700" mb={toast.description !== undefined ? 1 : 0}>
                {toast.title}
              </Text>
            )}
            {toast.description !== undefined && <Text color="white">{toast.description}</Text>}
          </Box>
          <Pressable accessibilityLabel="Dismiss notification" onPress={() => close(toast.id)} p={1}>
            <Icon as={Ionicons} name="close" size={4} color="white" />
          </Pressable>
        </HStack>
      </Box>
    );
  };

  return (
    <ToastContext.Provider value={controller}>
      {children}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 48, left: 16, right: 16, zIndex: 9999 }}
      >
        {top.map(renderToast)}
      </View>
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 9999 }}
      >
        {bottom.map(renderToast)}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastController {
  return useContext(ToastContext);
}
