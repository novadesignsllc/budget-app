import { Dropdown } from './dropdown';

export type SelectOption<T extends string> = { value: T; label: string };

/** Kept for older screens: a labeled dropdown field. New code uses Dropdown directly. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  return <Dropdown label={label} value={value} options={options} onChange={onChange} />;
}
