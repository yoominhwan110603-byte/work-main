type ListingImageSource = {
  images?: unknown;
  coverImageDataUrl?: unknown;
  recordImageDataUrl?: unknown;
  extraImages?: unknown;
};

const imageList = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((image): image is string => typeof image === 'string' && Boolean(image))
  : [];

export function readListingImageSlots(source: ListingImageSource | null | undefined) {
  const images = Array.isArray(source?.images) ? source.images : [];
  const legacyImage = (index: number) => typeof images[index] === 'string' ? images[index] as string : '';
  const hasNamedSlots = typeof source?.coverImageDataUrl === 'string' || typeof source?.recordImageDataUrl === 'string';
  // An empty named slot is intentional; a compacted gallery cannot identify its role.
  const cover = typeof source?.coverImageDataUrl === 'string' ? source.coverImageDataUrl : hasNamedSlots ? '' : legacyImage(0);
  const record = typeof source?.recordImageDataUrl === 'string' ? source.recordImageDataUrl : hasNamedSlots ? '' : legacyImage(1);
  const extras = Array.isArray(source?.extraImages)
    ? imageList(source.extraImages)
    : hasNamedSlots ? imageList(images).filter(image => image !== cover && image !== record) : imageList(images.slice(2));
  return { cover, record, extras: extras.slice(0, 3) };
}
