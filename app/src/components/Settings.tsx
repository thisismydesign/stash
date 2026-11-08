import { ActionIcon, Drawer, Indicator, Popover, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

export function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={600} c="dimmed">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

/** Display choices and filters behind one button: a side panel on phones, a popover beside the button elsewhere. */
export function SettingsMenu({
  label,
  width,
  active = false,
  icon: Icon = IconAdjustmentsHorizontal,
  children,
}: {
  label: string;
  width: number;
  /** Marks the button when a choice inside narrows what the page shows. */
  active?: boolean;
  icon?: typeof IconAdjustmentsHorizontal;
  children: ReactNode;
}) {
  const mobile = useMediaQuery("(max-width: 48em)") ?? false;
  const [opened, setOpened] = useState(false);
  const button = (
    <Indicator disabled={!active} size={8} offset={4}>
      <ActionIcon
        variant="default"
        size="input-sm"
        aria-label={label}
        title={label}
        onClick={mobile ? () => setOpened(true) : undefined}
      >
        <Icon size={18} />
      </ActionIcon>
    </Indicator>
  );
  if (mobile)
    return (
      <>
        {button}
        <Drawer
          opened={opened}
          onClose={() => setOpened(false)}
          position="right"
          size="xs"
          title={<Text fw={700}>{label}</Text>}
        >
          {children}
        </Drawer>
      </>
    );
  return (
    <Popover position="bottom-start" shadow="md" width={width} withArrow>
      <Popover.Target>{button}</Popover.Target>
      <Popover.Dropdown p="md">{children}</Popover.Dropdown>
    </Popover>
  );
}
