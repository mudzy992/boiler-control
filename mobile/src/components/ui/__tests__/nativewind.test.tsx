import mockReact, { type ReactNode } from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppThemeProvider } from '../../../theme/AppTheme';
import {
  Actionsheet,
  Badge,
  Box,
  Button,
  HStack,
  Modal,
  Progress,
  Select,
  Text,
  ToastProvider,
  useToast,
  VStack,
} from '../nativewind';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

async function tree(colorMode: 'light' | 'dark', children: ReactNode) {
  return render(
    <AppThemeProvider colorMode={colorMode}>
      <ToastProvider>{children}</ToastProvider>
    </AppThemeProvider>,
  );
}

function ToastTrigger() {
  const toast = useToast();
  return (
    <Button
      onPress={() =>
        toast.show({
          duration: null,
          render: () => <Text>Rendered toast</Text>,
        })
      }
    >
      Show toast
    </Button>
  );
}

describe('MO2-14 NativeWind primitives', () => {
  it.each(['light', 'dark'] as const)('renders the core kit in %s mode', async (colorMode) => {
    const result = await tree(
      colorMode,
      <Box safeArea bg={colorMode === 'dark' ? 'dark.900' : 'gray.50'} p={4}>
        <VStack space={3}>
          <HStack space={2} alignItems="center">
            <Badge colorScheme="success">Ready</Badge>
            <Text color={colorMode === 'dark' ? 'gray.100' : 'gray.800'}>Boiler</Text>
          </HStack>
          <Progress value={62.5} colorScheme="success" />
          <Button onPress={() => undefined}>Save</Button>
        </VStack>
      </Box>,
    );
    expect(result.toJSON()).toMatchSnapshot();
  });

  it('runs button and select actions', async () => {
    const onPress = jest.fn();
    const onValueChange = jest.fn();
    const result = await tree(
      'light',
      <VStack>
        <Button onPress={onPress}>Save</Button>
        <Select selectedValue="one" onValueChange={onValueChange} placeholder="Choose">
          <Select.Item label="One" value="one" />
          <Select.Item label="Two" value="two" />
        </Select>
      </VStack>,
    );

    await fireEvent.press(result.getByRole('button'));
    await fireEvent.press(result.getByRole('combobox'));
    await fireEvent.press(result.getByText('Two'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('two');
  });

  it('closes modal and actionsheet through their backdrop controls', async () => {
    const onModalClose = jest.fn();
    const onSheetClose = jest.fn();
    const result = await tree(
      'dark',
      <VStack>
        <Modal isOpen onClose={onModalClose}>
          <Modal.Content>
            <Modal.CloseButton />
            <Modal.Header>Dialog</Modal.Header>
            <Modal.Body>
              <Text>Body</Text>
            </Modal.Body>
          </Modal.Content>
        </Modal>
        <Actionsheet isOpen onClose={onSheetClose}>
          <Actionsheet.Content>
            <Actionsheet.Item>
              <Text>Action</Text>
            </Actionsheet.Item>
          </Actionsheet.Content>
        </Actionsheet>
      </VStack>,
    );

    await fireEvent.press(result.getByLabelText('Close dialog'));
    await fireEvent.press(result.getByLabelText('Close actions'));
    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(onSheetClose).toHaveBeenCalledTimes(1);
  });

  it('supports NativeBase-compatible custom toast rendering', async () => {
    const result = await tree('light', <ToastTrigger />);
    await fireEvent.press(result.getByRole('button'));
    expect(result.getByText('Rendered toast')).toBeTruthy();
  });
});
