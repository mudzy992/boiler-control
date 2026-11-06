import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { Button } from '../ui/Button';
import { Card, CardTitle, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { FieldError } from '../ui/Input';

/**
 * WCAG 2.2 AA pravila — kritične i serious kategorije.
 * axe.run prima konfiguraciju direktno, bez axe.configure.
 */
async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
  });
  expect(results.violations).toEqual([]);
}

describe('WCAG 2.2 AA — shadcn/ui komponente', () => {
  it('Button nema pristupačkih grešaka (default variant)', async () => {
    const { container } = render(<Button>Sačuvaj</Button>);
    await checkA11y(container);
  });

  it('Button disabled stanje ima aria-disabled', () => {
    render(<Button disabled>Onemogućen</Button>);
    const button = screen.getByRole('button', { name: /Onemogućen/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('Button loading stanje ima aria-busy', () => {
    render(<Button isLoading>Čuvanje…</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('Card sa naslovom ima ispravnu strukturu', async () => {
    const { container } = render(
      <Card>
        <CardTitle>Profil doma</CardTitle>
        <CardContent>Sadržaj karte.</CardContent>
      </Card>
    );
    await checkA11y(container);
  });

  it('Input sa Label-om ima vezu htmlFor/id', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="home-name">Naziv doma</Label>
        <Input id="home-name" />
      </div>
    );
    await checkA11y(container);
    const input = screen.getByLabelText('Naziv doma');
    expect(input).toBeInTheDocument();
  });

  it('Input sa error porukom ima aria-invalid i aria-describedby', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="floor-area">Podnya (m²)</Label>
        <Input id="floor-area" aria-invalid="true" aria-describedby="floor-area-error" />
        <FieldError id="floor-area-error">Unesite pozitivan broj.</FieldError>
      </div>
    );
    await checkA11y(container);
    const input = screen.getByLabelText('Podnya (m²)');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
