import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'btn';
  const cls = `${base} ${base}--${variant} ${base}--${size} ${className}`.trim();

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
