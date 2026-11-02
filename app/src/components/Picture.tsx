import { Box, Image, type MantineRadius } from "@mantine/core";

/** A board's picture, wide and cropped to a band; the title beside it says what it is. Without a source yet, the band's space. */
export function Picture({
  src,
  height,
  radius,
}: {
  src: string | undefined;
  height: number;
  radius?: MantineRadius;
}) {
  if (!src) return <Box h={height} />;
  return <Image src={src} alt="" h={height} fit="cover" radius={radius} loading="lazy" />;
}
