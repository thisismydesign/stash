import {
  AppShell,
  Box,
  Center,
  Loader,
  MantineProvider,
  useComputedColorScheme,
} from "@mantine/core";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BoardsProvider } from "./lib/boards.tsx";
import { supabase, useSession } from "./lib/supabase.ts";
import { cssVariablesResolver, theme } from "./theme.ts";
import { Stash, useHashRoute } from "./App.tsx";
import { SignIn } from "./Auth.tsx";
import { Footer } from "./Footer.tsx";
import { StashBar } from "./Header.tsx";

import "@mantine/core/styles.css";

/** Paints the installed app's system bars to match the page in either scheme. */
function useThemeColorMeta() {
  const scheme = useComputedColorScheme("dark");
  useEffect(() => {
    const color = getComputedStyle(document.body).backgroundColor;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [scheme]);
}

function Content() {
  const session = useSession();
  const route = useHashRoute();
  if (!supabase) return <SignIn />;
  if (session === undefined)
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  if (session === null) return <SignIn />;
  return <Stash route={route} />;
}

function App() {
  useThemeColorMeta();
  return (
    <AppShell header={{ height: 52 }} padding="md">
      <AppShell.Header>
        <Box h="100%" px="md">
          <StashBar />
        </Box>
      </AppShell.Header>
      {/* viewport-fit=cover draws the page under Android's gesture bar; keep the last row clear of it. */}
      <AppShell.Main
        pb="calc(var(--mantine-spacing-md) + env(safe-area-inset-bottom))"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Content />
        </Box>
        <Footer />
      </AppShell.Main>
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="dark"
      cssVariablesResolver={cssVariablesResolver}
    >
      <BoardsProvider>
        <App />
      </BoardsProvider>
    </MantineProvider>
  </StrictMode>,
);
