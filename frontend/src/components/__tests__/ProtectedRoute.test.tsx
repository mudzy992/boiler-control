import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext } from '../../context/AuthContext';
import { ProtectedRoute } from '../ProtectedRoute';

/**
 * FE2-2 (FE-002): `ProtectedRoute` ne smije izbaciti prijavljenog korisnika
 * dok se sesija tiho obnavlja.
 *
 * Prije ove izmjene komponenta je gledala samo `!token`. S access tokenom u
 * memoriji (`api.ts`) reload stranice znači da tokena pri prvom renderu nema —
 * iako je httpOnly refresh cookie ispravan i `refreshSession()` upravo traje.
 * Korisnik bi bio prebačen na `/login` usred sesije.
 *
 * Nalaz FE-002 je glasio „ProtectedRoute vjeruje postojanju stringa"; pouka je
 * šira: postojanje stringa nikad nije dokaz sesije, a sada ni njegov izostanak
 * nije dokaz da sesije nema.
 */

type Ctx = React.ContextType<typeof AuthContext>;

function renderRoute(ctx: Partial<Ctx>) {
  const value = {
    user: null,
    token: null,
    isLoading: false,
    isInitializing: false,
    login: async () => undefined,
    logout: () => undefined,
    setUser: () => undefined,
    ...ctx,
  } as Ctx;

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>zasticeni-sadrzaj</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>login-stranica</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('FE2-2: ProtectedRoute i obnavljanje sesije', () => {
  it('dok traje inicijalizacija NE preusmjerava na /login', () => {
    renderRoute({ token: null, isInitializing: true });

    // Ključna asertcija: korisnik s ispravnim refresh cookie-jem ne smije biti
    // izbačen samo zato što access token još nije stigao iz memorije.
    expect(screen.queryByText('login-stranica')).not.toBeInTheDocument();
    expect(screen.queryByText('zasticeni-sadrzaj')).not.toBeInTheDocument();
  });

  it('nakon inicijalizacije bez tokena preusmjerava na /login', () => {
    renderRoute({ token: null, isInitializing: false });

    expect(screen.getByText('login-stranica')).toBeInTheDocument();
  });

  it('s tokenom prikazuje zaštićeni sadržaj', () => {
    renderRoute({ token: 'abc', isInitializing: false });

    expect(screen.getByText('zasticeni-sadrzaj')).toBeInTheDocument();
    expect(screen.queryByText('login-stranica')).not.toBeInTheDocument();
  });

  it('token uz inicijalizaciju i dalje prikazuje sadržaj (nema treperenja)', () => {
    renderRoute({ token: 'abc', isInitializing: true });

    expect(screen.getByText('zasticeni-sadrzaj')).toBeInTheDocument();
  });
});
