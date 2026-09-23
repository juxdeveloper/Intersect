import { forwardRef } from 'react';
import { MathFieldInput, type MathFieldInputHandle } from './MathFieldInput';
import type { EquationDiagnostic } from '../contracts/expressions';
import type { SupportedLanguage } from '../i18n';

export interface EquationInputSectionProps {
  label: 'Surface F' | 'Surface G' | string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  id: string;
  diagnostic?: EquationDiagnostic | null;
  lang?: SupportedLanguage;
}

export const EquationInputSection = forwardRef<MathFieldInputHandle, EquationInputSectionProps>(
  ({ label, value, onChange, onSubmit, placeholder = 'e.g. x^2 + y^2 = 4', id, diagnostic, lang = 'es' }, ref) => {
    const isG = label.toLowerCase().includes('g');
    return (
      <MathFieldInput
        ref={ref}
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
        diagnostic={diagnostic}
        surfaceTag={isG ? 'g' : 'f'}
        lang={lang}
      />
    );
  },
);

EquationInputSection.displayName = 'EquationInputSection';
export type { MathFieldInputHandle };
