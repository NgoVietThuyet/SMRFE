import { getInitials } from '@/utils';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({ name, color, size = 'md', ring = false }: AvatarProps) {
  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      className={`${sizeMap[size]} ${color} rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none ${
        ring ? 'ring-2 ring-white shadow-sm' : ''
      }`}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </div>
  );
}
