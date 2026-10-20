import { useEffect, useState } from 'react';
import { isLowDataNetwork } from '../../utils/network';

function cloudinaryVariant(url, width, lowData) {
  if (typeof url !== 'string' || !url.includes('/image/upload/')) return null;
  const quality = lowData ? 'q_auto:eco' : 'q_auto';
  return url.replace('/image/upload/', `/image/upload/c_limit,w_${width},f_auto,${quality}/`);
}

export default function SmartImage({
  src,
  alt,
  className = '',
  sizes = '(max-width: 600px) 100vw, 50vw',
  loading = 'lazy',
  aspectRatio,
  style,
  width,
  height,
  placeholder = true,
  onError,
  ...imageProps
}) {
  const [loadedSource, setLoadedSource] = useState('');
  const lowData = isLowDataNetwork();
  const cloudinarySrcSet = [400, 800, 1200]
    .filter((size) => !lowData || size <= 800)
    .map((size) => {
      const variant = cloudinaryVariant(src, size, lowData);
      return variant ? `${variant} ${size}w` : null;
    })
    .filter(Boolean)
    .join(', ');
  const preferredSource = cloudinaryVariant(src, lowData ? 400 : 800, lowData) || src;
  const isLoaded = loadedSource === src;

  useEffect(() => {
    setLoadedSource('');
  }, [src]);

  return (
    <>
      {placeholder && (
        <span
          className={`smart-image-placeholder${isLoaded ? ' is-loaded' : ''}`}
          style={aspectRatio ? { aspectRatio } : undefined}
          aria-hidden="true"
        />
      )}
      <img
        {...imageProps}
        className={`${className}${className ? ' ' : ''}smart-image${isLoaded ? ' is-loaded' : ''}`}
        src={preferredSource}
        srcSet={cloudinarySrcSet || undefined}
        sizes={cloudinarySrcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        style={aspectRatio ? { ...style, aspectRatio } : style}
        loading={loading}
        decoding="async"
        data-loaded={isLoaded ? 'true' : 'false'}
        onLoad={() => setLoadedSource(src)}
        onError={(event) => {
          setLoadedSource(src);
          onError?.(event);
        }}
      />
    </>
  );
}
