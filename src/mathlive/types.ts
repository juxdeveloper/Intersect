import type { MathfieldElement } from 'mathlive';

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>,
        MathfieldElement
      > & {
        ref?: React.Ref<MathfieldElement>;
        class?: string;
        'math-virtual-keyboard-policy'?: 'auto' | 'manual' | 'sandboxed';
        placeholder?: string;
      };
    }
  }
}

export type { MathfieldElement };
