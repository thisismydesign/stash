import {
  ActionIcon,
  Group,
  Text,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { go } from "./App.tsx";
import { ProfileMenu } from "./Auth.tsx";
import { Logo } from "./Logo.tsx";

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("dark");
  return (
    <ActionIcon
      variant="subtle"
      size="lg"
      aria-label={scheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}
    >
      {scheme === "dark" ? <IconSun size={20} /> : <IconMoon size={20} />}
    </ActionIcon>
  );
}

export function StashBar() {
  return (
    <Group h="100%" justify="space-between" wrap="nowrap">
      <UnstyledButton onClick={go.home} aria-label="All boards">
        <Group gap="xs" wrap="nowrap">
          <Logo size={26} />
          <Text fw={700} fz="lg" lts={0.5}>
            Stash
          </Text>
        </Group>
      </UnstyledButton>
      <Group gap={4} wrap="nowrap">
        <ColorSchemeToggle />
        <ProfileMenu />
      </Group>
    </Group>
  );
}
