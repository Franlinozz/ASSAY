import Image from 'next/image'

type EditorialVariant =
  | 'claim-gate'
  | 'standard-strip'
  | 'studio-documentary'
  | 'tribunal-band'
  | 'verify-ghost'
  | 'recruiter-blend'
  | 'gallery-panorama'
  | 'cta-environment'

interface EditorialImageProps {
  src: string
  alt: string
  variant: EditorialVariant
  sizes: string
  className?: string
  objectPosition?: string
  priority?: boolean
}

/**
 * A shared frame for Assay's editorial photography. The image remains a real,
 * accessible image; theme-specific absorption happens in CSS overlays and masks
 * instead of flattening the photograph with a single low opacity.
 */
export function EditorialImage({
  src,
  alt,
  variant,
  sizes,
  className = '',
  objectPosition,
  priority = false,
}: EditorialImageProps) {
  return (
    <figure
      className={`editorial-image editorial-image-${variant}${className ? ` ${className}` : ''}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="editorial-image-media"
        style={objectPosition ? { objectPosition } : undefined}
      />
      <span className="editorial-image-veil" aria-hidden="true" />
    </figure>
  )
}
