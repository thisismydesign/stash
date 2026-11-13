import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Center,
  CopyButton,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconUserCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@shared/api.ts";
import { AgentKeys } from "./AgentKeys.tsx";
import { Logo } from "./Logo.tsx";
import { API_BASE, signInAsDevAccount, signUp, supabase, useSession } from "./lib/supabase.ts";

type AuthMode = "signin" | "signup" | "agent";
const TITLES: Record<AuthMode, string> = {
  agent: "Welcome to Stash",
  signin: "Sign in to Stash",
  signup: "Sign up for Stash",
};

/** Asks the header's Sign in button to open. */
const OPEN_SIGN_IN = "stash:sign-in";

// Spelled out rather than "fetch this URL and follow it", so the user can read what they hand their agent.
const ONBOARD_PROMPT = `Set up a Stash account for me. Stash (${location.origin}) is my personal notepad: boards of notes, lists and ideas, which you keep for me.

1. Ask me for my email address, and whether I want to choose a password or have Stash make one.
2. Create the account: POST ${API_BASE}/signup with JSON {"email", "password" (optional)}. The API is described at ${API_BASE}/openapi.json.
3. Tell me the email and password to sign in with at ${location.origin}. Store session.refresh_token from the response somewhere durable, and tell me where.

How to keep my boards for me afterwards is at ${location.origin}/llms.txt.`;

function AgentOnboarding() {
  return (
    <Stack gap="xs">
      <Textarea
        aria-label="Instructions for your agent"
        value={ONBOARD_PROMPT}
        readOnly
        autosize
        minRows={8}
        maxRows={14}
        size="xs"
        styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 } }}
      />
      <CopyButton value={ONBOARD_PROMPT}>
        {({ copied, copy }) => (
          <Button size="xs" onClick={copy}>
            {copied ? "Copied" : "Copy instructions"}
          </Button>
        )}
      </CopyButton>
    </Stack>
  );
}

function PasswordForm({ mode }: { mode: Exclude<AuthMode, "agent"> }) {
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
          onClick={() => window.dispatchEvent(new Event(OPEN_SIGN_IN))}
        >
          Sign up to keep your own.
        </Anchor>
      </Text>
    </Alert>
  );
}

function SignInButton() {
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<AuthMode>("agent");
  const open = () => {
    setMode("agent");
    setOpened(true);
  };
  useEffect(() => {
    window.addEventListener(OPEN_SIGN_IN, open);
    return () => window.removeEventListener(OPEN_SIGN_IN, open);
  }, []);
  const choice = (value: AuthMode, label: string) => (
    <Button
      size="xs"
      fullWidth
      variant="default"
      bg={mode === value ? "var(--mantine-color-default-hover)" : undefined}
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
    >
      {label}
    </Button>
  );
  return (
    <>
      <Button variant="default" size="xs" onClick={open}>
        Sign in
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={<Text fw={700}>{TITLES[mode]}</Text>}
        size="xs"
      >
        <Stack gap="sm">
          <Stack gap={6}>
            {choice("agent", "Onboard with your AI agent")}
            <SimpleGrid cols={2} spacing={6}>
              {choice("signin", "Sign in")}
              {choice("signup", "Sign up")}
            </SimpleGrid>
          </Stack>
          {mode === "agent" ? <AgentOnboarding /> : <PasswordForm key={mode} mode={mode} />}
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
