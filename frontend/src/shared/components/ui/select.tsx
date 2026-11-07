import type { ReactNode } from 'react';
import { Select as UiSelect } from '@/ui';

export const Select = UiSelect;

/** Legacy Radix-shaped stubs — prefer native Select from `@/ui`. */
export const SelectTrigger = UiSelect;
export const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <option value="">{placeholder}</option>
);
export const SelectContent = ({ children }: { children?: ReactNode }) => <>{children}</>;
export const SelectItem = ({
  value,
  children,
}: {
  value: string;
  children?: ReactNode;
}) => <option value={value}>{children}</option>;
