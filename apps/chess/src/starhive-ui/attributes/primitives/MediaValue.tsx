import { Group, Image, Text } from '@mantine/core'

import { formatFileSize } from '../format'
import type { Density, MediaView } from '../model'
import { Chip } from './Chip'

const THUMB: Record<Density, number> = { default: 40, table: 28, compact: 20 }

/**
 * A media value: a thumbnail when the host resolved a URL, otherwise the filename and its size.
 *
 * The filename fallback is the common case in an app iframe, where media URLs are auth-scoped and no
 * `resolveMediaUrl` slot was supplied — and it is still useful, which is the point.
 */
export function MediaValue({
  media,
  url,
  density = 'default',
}: {
  media: MediaView
  url?: string
  density?: Density
}) {
  const size = THUMB[density]
  const resolved = url ?? media.thumbnailUrl

  if (resolved && media.contentType.startsWith('image/')) {
    return (
      <Image
        src={resolved}
        alt={media.fileName}
        w={size}
        h={size}
        radius="sm"
        fit="cover"
        title={media.fileName}
      />
    )
  }

  return (
    <Group component="span" display="inline-flex" gap="xs" wrap="nowrap">
      <Chip label={media.fileName} density={density} />
      {density === 'default' && media.fileSize > 0 ? (
        <Text component="span" size="xs" c="dimmed">
          {formatFileSize(media.fileSize)}
        </Text>
      ) : null}
    </Group>
  )
}
