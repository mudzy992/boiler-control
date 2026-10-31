import { escapeCsvCell, toCsv } from '../csv';

describe('csv (FEAT-6)', () => {
  it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)'])(
    'neutralizira formulu %p apostrofom',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`'${value}`);
    },
  );

  it.each([' =1+1', '\t=1+1', '\u0000=1+1', '\u007f=1+1'])(
    'neutralizira formulu nakon vodecih praznina/kontrolnih znakova %p',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`'${value}`);
    },
  );

  it('newline nakon formule ostaje citiran', () => {
    expect(escapeCsvCell('\n=1+1')).toBe('"\'\n=1+1"');
    expect(escapeCsvCell('\r=1+1')).toBe('"\'\r=1+1"');
  });

  it('negativan broj ostaje broj, a tekstualni minus se neutralizira', () => {
    expect(escapeCsvCell(-12.5)).toBe('-12.5');
    expect(escapeCsvCell('-12.5')).toBe("'-12.5");
    expect(escapeCsvCell(0)).toBe('0');
  });

  it('citira zareze, navodnike i newline po RFC 4180', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"');
    expect(escapeCsvCell(' =a,b')).toBe('"\' =a,b"');
  });

  it('null/undefined i nekonacni brojevi postaju prazna celija', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(Number.NaN)).toBe('');
    expect(escapeCsvCell(Number.POSITIVE_INFINITY)).toBe('');
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
  });

  it('toCsv koristi CRLF zadano, a legacy moze traziti LF', () => {
    const rows = [
      ['label', 'value'],
      ['a,b', -1],
    ];
    expect(toCsv(rows)).toBe('label,value\r\n"a,b",-1');
    expect(toCsv(rows, '\n')).toBe('label,value\n"a,b",-1');
    expect(toCsv([])).toBe('');
  });
});
