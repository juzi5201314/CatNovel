import type { InputHTMLAttributes } from 'react';
import { cx } from '../../lib/design/cx';

export function Input({
  className,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx('input', className)}
      type={type}
      {...props}
    />
  );
}
