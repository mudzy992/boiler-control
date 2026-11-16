import type { JSX, ReactNode } from "react";

/**
 * Izbor jednog od nekoliko susjednih raspona — web verzija mobilnog `Segmented`.
 *
 * **Zašto `radiogroup`, a ne gomila `<button>`.** Sesija je označena opcija;
 * čitalac ekrana mora čuti „1 od 4" i moći strelicama mijenjati izbor. Bez toga
 * je to četiri dugmeta bez stanja i bez veze sa onim što prikazuje.
 *
 * **Zašto ne `DateRangeFilter`.** On traži dva datuma i nema pojam „tekuća
 * sedmica": korisnik mora sam izračunati da je sedmica 01.–07.11. i pogriješit
 * će pri prelasku mjeseca. Ovo je isti izbor kao na mobilnom, istim imenima.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  idPrefix,
  disabled,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Ime grupe za čitaoce ekrana; vizuelno se ne prikazuje. */
  label: string;
  idPrefix: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-secondary p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            id={`${idPrefix}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              selected
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {option.label as ReactNode}
          </button>
        );
      })}
    </div>
  );
}
