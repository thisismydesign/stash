/** Mirrors public/favicon.svg: a stash of cards, the front one with its lines. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="6 6 52 52" aria-hidden="true">
      <rect
        x="22"
        y="10"
        width="30"
        height="22"
        rx="4"
        fill="var(--mantine-color-teal-5)"
        opacity=".35"
      />
      <rect
        x="16"
        y="19"
        width="30"
        height="22"
        rx="4"
        fill="var(--mantine-color-teal-5)"
        opacity=".6"
      />
      <rect x="10" y="28" width="30" height="22" rx="4" fill="var(--mantine-color-teal-5)" />
      <rect x="15" y="35" width="13" height="3" rx="1.5" fill="var(--mantine-color-body)" />
      <rect x="15" y="41" width="20" height="3" rx="1.5" fill="var(--mantine-color-body)" />
    </svg>
  );
}
