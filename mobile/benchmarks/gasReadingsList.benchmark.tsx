import React from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

// MO2-13 synthetic benchmark. Run locally with:
//   cd mobile
//   npx jest --runInBand --testMatch '**/benchmarks/*.benchmark.tsx'
//
// This is a Jest/render benchmark, not a device FPS measurement. It compares
// the legacy ScrollView+map pattern with the FlatList pattern using 500
// synthetic gas readings.

const readings = Array.from({ length: 500 }, (_, index) => ({
  id: index + 1,
  counterValue: 1000 + index * 0.5,
  readingDate: new Date(2026, 0, 1 + index).toISOString(),
}));

function ReadingRow({ id, counterValue }: { id: number; counterValue: number }) {
  return (
    <View testID="reading-row" style={{ height: 72, padding: 8 }}>
      <Text>{`Reading ${id}`}</Text>
      <Text>{`${counterValue.toFixed(2)} m3`}</Text>
    </View>
  );
}

function LegacyList() {
  return (
    <ScrollView>
      {readings.map((reading) => (
        <ReadingRow key={reading.id} id={reading.id} counterValue={reading.counterValue} />
      ))}
    </ScrollView>
  );
}

function VirtualizedList() {
  return (
    <FlatList
      data={readings}
      keyExtractor={(item) => String(item.id)}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      renderItem={({ item }) => <ReadingRow id={item.id} counterValue={item.counterValue} />}
    />
  );
}

describe('MO2-13 gas readings list benchmark', () => {
  it('renders fewer initial rows with FlatList than legacy map', async () => {
    const legacyStart = Date.now();
    const legacy = await render(<LegacyList />);
    const legacyMs = Date.now() - legacyStart;
    const legacyRows = legacy.queryAllByTestId('reading-row').length;
    await legacy.unmount();

    const flatStart = Date.now();
    const flat = await render(<VirtualizedList />);
    const flatMs = Date.now() - flatStart;
    const flatRows = flat.queryAllByTestId('reading-row').length;
    await flat.unmount();

    console.log(
      JSON.stringify({
        benchmark: 'MO2-13 gas readings list',
        syntheticRows: readings.length,
        legacy: { initialRenderMs: legacyMs, renderedRows: legacyRows },
        flatList: { initialRenderMs: flatMs, renderedRows: flatRows },
      })
    );

    expect(legacyRows).toBe(500);
    expect(flatRows).toBeLessThan(legacyRows);
  });
});
