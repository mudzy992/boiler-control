import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import {
  Button,
  Checkbox,
  Modal,
  Switch,
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../index';

describe('instrument ui primitives', () => {
  it('Modal exposes dialog semantics and closes on Escape', async () => {
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

  it('Checkbox and Switch are operable and axe-clean', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { container } = render(
      <div>
        <label htmlFor="agree">
          Agree
          <Checkbox id="agree" />
        </label>
        <label htmlFor="notify">
          Notify
          <Switch
            id="notify"
            checked={false}
            onCheckedChange={onCheckedChange}
            aria-label="Notify"
          />
        </label>
        <Button type="button">Save</Button>
      </div>,
    );
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
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
});
