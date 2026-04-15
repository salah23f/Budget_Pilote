'use client';

import React from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, fallback, size = 'md', className = '', ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const showImage = src && !imgError;

    return (
      <div
        ref={ref}
        className={[
          'relative shrink-0 overflow-hidden rounded-lg',
          sizeClasses[size],
          !showImage ? 'flex items-center justify-center font-bold text-white bg-gradient-to-br from-accent-light to-accent-dark' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || ''}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span>{fallback || '?'}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
