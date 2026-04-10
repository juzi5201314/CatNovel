import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/design/cx';

type ButtonVariant = 'primary' | 'ghost' | 'badge';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  variant = 'ghost',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx('button', `button--${variant}`, className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
