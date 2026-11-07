import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../index';
import { InputNumber } from '../../../../components/InputNumber';

describe('I3 shadcn primitives', () => {
  it('Dialog exposes dialog semantics and closes on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Confirm this action</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Checkbox and Switch are operable and axe-clean', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <label htmlFor="agree">
          Agree
          <Checkbox id="agree" />
        </label>
        <label htmlFor="notify">
          Notify
          <Switch id="notify" />
        </label>
        <Button type="button">Save</Button>
      </div>,
    );
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked');
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('Table renders column headers', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reading</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>42</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Reading' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '42' })).toBeInTheDocument();
  });

  it('InputNumber emits number | null without antd', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <InputNumber
        id="temp"
        label="Temp"
        value={50}
        min={48}
        max={55}
        step={0.1}
        precision={1}
        addonAfter="°C"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Temp');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    await user.clear(input);
    expect(onChange).toHaveBeenCalledWith(null);
    await user.type(input, '51.2');
    expect(onChange).toHaveBeenLastCalledWith(51.2);
  });
});
