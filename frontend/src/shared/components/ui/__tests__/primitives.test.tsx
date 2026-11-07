import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, Button, Checkbox, Switch, DataTable, THead, TBody, TR, TH, TD } from '@/ui';
import { InputNumber } from '../../../../components/InputNumber';

describe('instrument primitives (compat suite)', () => {
  it('Modal closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm" description="Confirm this action">
        <Button type="button">OK</Button>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('Checkbox and Switch are operable', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <div>
        <label htmlFor="agree">
          Agree
          <Checkbox id="agree" />
        </label>
        <Switch
          checked={false}
          onCheckedChange={onCheckedChange}
          aria-label="Notify"
        />
        <Button type="button">Save</Button>
      </div>,
    );
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('Table renders column headers', () => {
    render(
      <DataTable>
        <THead>
          <TR>
            <TH>Reading</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>42</TD>
          </TR>
        </TBody>
      </DataTable>,
    );
    expect(screen.getByRole('columnheader', { name: 'Reading' })).toBeInTheDocument();
  });

  it('InputNumber emits numeric values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber id="n" label="Value" value={1} onChange={onChange} />);
    const input = screen.getByLabelText('Value');
    await user.clear(input);
    await user.type(input, '12');
    expect(onChange).toHaveBeenCalled();
  });
});
