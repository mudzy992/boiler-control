import {
  Button as UiButton,
  type ButtonProps as UiButtonProps,
  type ButtonVariant,
} from '@/ui';

type LegacyVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | ButtonVariant;

const mapVariant = (variant?: LegacyVariant): ButtonVariant => {
  if (!variant || variant === 'default' || variant === 'link') {
    return 'primary';
  }
  if (variant === 'outline') {
    return 'secondary';
  }
  if (variant === 'destructive') {
    return 'danger';
  }
  return variant;
};

export type ButtonProps = Omit<UiButtonProps, 'variant' | 'size'> & {
  variant?: LegacyVariant;
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'md';
  asChild?: boolean;
};

export const Button = ({
  variant,
  size = 'md',
  asChild: _asChild,
  ...props
}: ButtonProps) => {
  const mappedSize =
    size === 'default' || size === 'icon' ? 'md' : size === 'sm' || size === 'lg' ? size : 'md';
  return <UiButton variant={mapVariant(variant)} size={mappedSize} {...props} />;
};

export { buttonVariants } from './button-variants-stub';
