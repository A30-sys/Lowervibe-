import React from 'react';
import { AFRICAN_COUNTRIES } from '../../data/regions';

interface RegionSelectProps {
  value: string;
  onChange: (value: string) => void;
  includeGlobal?: boolean;
  globalLabel?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export const RegionSelect: React.FC<RegionSelectProps> = ({
  value,
  onChange,
  includeGlobal = true,
  globalLabel = 'Global',
  className = '',
  id,
  required = false,
}) => {
  const isCustomValue =
    value &&
    value !== 'Global' &&
    value !== 'Africa' &&
    value !== 'All Regions' &&
    !AFRICAN_COUNTRIES.some(r => r.name.toLowerCase() === value.toLowerCase());

  return (
    <select
      id={id}
      value={value}
      required={required}
      onChange={e => onChange(e.target.value)}
      className={
        className ||
        'w-full min-h-[48px] px-3.5 py-2.5 bg-[var(--lv-surface)] border border-[var(--lv-border-strong)] rounded-2xl text-sm text-[var(--lv-text)] focus:outline-none focus:ring-2 focus:ring-[#C6FF3D] transition cursor-pointer'
      }
    >
      <option value="Africa">All Africa</option>
      {includeGlobal && <option value="Global">{globalLabel}</option>}
      {isCustomValue && <option value={value}>{value}</option>}
      <optgroup label="African Countries">
        {AFRICAN_COUNTRIES.map(region => (
          <option key={region.code} value={region.name}>
            {region.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
};
