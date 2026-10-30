import {
  ActionIcon,
  Button,
  Center,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconUserCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { AgentKeys } from "./AgentKeys.tsx";
import { Logo } from "./Logo.tsx";
import { signInAsDevAccount, supabase, useSession } from "./lib/supabase.ts";

/** No reset by email, so a new one must be worth keeping. */
const MIN_PASSWORD_LENGTH = 8;

function PasswordForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Locally, signing in with both fields empty means the dev account.
  const devAccount = import.meta.env.DEV && !email && !password;
  const ready = devAccount || (!!email && !!password);
  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      if (devAccount) await signInAsDevAccount();
      else {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    // A real form with named fields is what browsers and password managers key autofill on.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Stack gap="xs">
        <TextInput
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={import.meta.env.DEV ? "Empty for the dev account" : undefined}
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Button type="submit" loading={busy} disabled={!ready} mt="xs">
          Sign in
        </Button>
      </Stack>
    </form>
  );
}

export function SignIn() {
  return (
    <Center style={{ flex: 1 }}>
      <Paper withBorder p="lg" w="100%" maw={360}>
        <Stack gap="md">
          <Stack gap={4} align="center">
            <Logo size={40} />
            <Title order={3}>Sign in to Stash</Title>
            <Text size="sm" c="dimmed" ta="center">
              {supabase
                ? "Your boards, kept by you and your agent."
                : "Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY to connect a project."}
            </Text>
          </Stack>
          {supabase && <PasswordForm />}
        </Stack>
      </Paper>
    </Center>
  );
}

function ChangePassword() {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});
  const save = async () => {
    if (password.length < MIN_PASSWORD_LENGTH)
      return setState({ error: `The password needs at least ${MIN_PASSWORD_LENGTH} characters.` });
    setState({ busy: true });
    const { error } = await supabase!.auth.updateUser({ password });
    setState(error ? { error: error.message } : { done: true });
    if (!error) setPassword("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Stack gap="xs" maw={320}>
        <PasswordInput
          size="xs"
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.currentTarget.value);
            setState({});
          }}
        />
        {state.error && (
          <Text size="xs" c="red">
            {state.error}
          </Text>
        )}
        {state.done && <Text size="xs">Password changed.</Text>}
        <Button size="xs" type="submit" loading={state.busy} disabled={!password}>
          Change password
        </Button>
      </Stack>
    </form>
  );
}

const SETTINGS = [
  { value: "keys", label: "Agent keys" },
  { value: "password", label: "Password" },
] as const;
type SettingsTab = (typeof SETTINGS)[number]["value"];

function SettingsModal({ tab, onClose }: { tab: SettingsTab | null; onClose: () => void }) {
  const [active, setActive] = useState<SettingsTab>("keys");
  useEffect(() => {
    if (tab) setActive(tab);
  }, [tab]);
  return (
    <Modal opened={tab !== null} onClose={onClose} title="Settings" size="lg">
      <Tabs value={active} onChange={(v) => v && setActive(v as SettingsTab)}>
        <Tabs.List mb="md">
          {SETTINGS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="keys">
          <AgentKeys />
        </Tabs.Panel>
        <Tabs.Panel value="password">
          <ChangePassword />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

export function ProfileMenu() {
  const session = useSession();
  const [settings, setSettings] = useState<SettingsTab | null>(null);
  if (!session) return null;
  return (
    <>
      <Menu position="bottom-end" shadow="md" width={220}>
        <Menu.Target>
          <ActionIcon variant="subtle" aria-label="Account" size="lg">
            <IconUserCheck size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{session.user.email}</Menu.Label>
          <Menu.Label>Settings</Menu.Label>
          {SETTINGS.map((t) => (
            <Menu.Item key={t.value} onClick={() => setSettings(t.value)}>
              {t.label}
            </Menu.Item>
          ))}
          <Menu.Divider />
          {/* This browser only: agents hold sessions of their own. */}
          <Menu.Item onClick={() => void supabase!.auth.signOut({ scope: "local" })}>
            Sign out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <SettingsModal tab={settings} onClose={() => setSettings(null)} />
    </>
  );
}
