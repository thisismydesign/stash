import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Center,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconUserCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@shared/api.ts";
import { AgentKeys } from "./AgentKeys.tsx";
import { Logo } from "./Logo.tsx";
import { signInAsDevAccount, signUp, supabase, useSession } from "./lib/supabase.ts";

const AUTH_MODES = [
  { value: "signin", label: "Sign in" },
  { value: "signup", label: "Sign up" },
] as const;
type AuthMode = (typeof AUTH_MODES)[number]["value"];

/** Asks the header's Sign in button to open, in the mode given as `detail`. */
const OPEN_SIGN_IN = "stash:sign-in";

function PasswordForm({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  // Locally, signing in with both fields empty means the dev account.
  const devAccount = import.meta.env.DEV && !signup && !email && !password;
  const ready = devAccount || (!!email && !!password);
  const submit = async () => {
    if (signup && password.length < MIN_PASSWORD_LENGTH)
      return setError(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    setError(undefined);
    setBusy(true);
    try {
      if (devAccount) await signInAsDevAccount();
      else if (signup) await signUp(email, password);
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
          placeholder={import.meta.env.DEV && !signup ? "Empty for the dev account" : undefined}
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Button type="submit" loading={busy} disabled={!ready} mt="xs">
          {signup ? "Create account" : "Sign in"}
        </Button>
      </Stack>
    </form>
  );
}

/** Without a project to connect to, the only page. */
export function SignIn() {
  return (
    <Center style={{ flex: 1 }}>
      <Paper withBorder p="lg" w="100%" maw={360}>
        <Stack gap={4} align="center">
          <Logo size={40} />
          <Title order={3}>Sign in to Stash</Title>
          <Text size="sm" c="dimmed" ta="center">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY to connect a project.
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}

/** What a visitor sees above the example boards. */
export function ExampleNotice() {
  return (
    <Alert variant="light" py="xs" mb="md">
      <Text size="sm" ta="center">
        You are looking at example boards.{" "}
        <Anchor
          component="button"
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SIGN_IN, { detail: "signup" }))}
        >
          Sign up to keep your own.
        </Anchor>
      </Text>
    </Alert>
  );
}

function SignInButton() {
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const open = (as: AuthMode) => {
    setMode(as);
    setOpened(true);
  };
  useEffect(() => {
    const onOpen = (e: Event) => open((e as CustomEvent<AuthMode>).detail ?? "signin");
    window.addEventListener(OPEN_SIGN_IN, onOpen);
    return () => window.removeEventListener(OPEN_SIGN_IN, onOpen);
  }, []);
  return (
    <>
      <Button variant="default" size="xs" onClick={() => open("signin")}>
        Sign in
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={<Text fw={700}>{mode === "signup" ? "Sign up for Stash" : "Sign in to Stash"}</Text>}
        size="xs"
      >
        <Stack gap="sm">
          <SegmentedControl
            fullWidth
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as AuthMode)}
            data={[...AUTH_MODES]}
          />
          <PasswordForm key={mode} mode={mode} />
        </Stack>
      </Modal>
    </>
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
  if (session === undefined) return null;
  if (session === null) return supabase ? <SignInButton /> : null;
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
