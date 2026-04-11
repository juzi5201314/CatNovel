import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/design/cx';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'badge';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
};

export function Button({
  children,
  className,
  variant = 'outline',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        'button',
        `button--${variant}`,
        size !== 'md' && `button--${size}`,
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
