import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Group,
  Popover,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { IconArrowBackUp, IconCheck, IconPlus } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { tabs as tabsOf, type Tab } from "../lib/todo.ts";
import { Markdown } from "./Markdown.tsx";

/** The open tab by its place among the open ones, or the list of done tabs. */
export type ActiveTab = number | "done";

/** `onDone` flips the tab whose heading is on the line; `onAdd` makes a tab. */
export type TabEdits = {
  onDone: (line: number) => void;
  onAdd: (title: string) => void;
};

const NOTHING = <Text c="dimmed">Nothing here yet.</Text>;

function AddTab({
  onAdd,
  ml,
  children,
}: {
  onAdd: (title: string) => void;
  ml?: "auto";
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <Popover opened={opened} onChange={setOpened} trapFocus position="bottom-end" withArrow>
      <Popover.Target>
        <Box component="span" ml={ml} onClick={() => setOpened((o) => !o)}>
          {children}
        </Box>
      </Popover.Target>
      <Popover.Dropdown>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onAdd(title);
            setTitle("");
            setOpened(false);
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <TextInput
              aria-label="Tab name"
              placeholder="Tab name"
              size="xs"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <Button type="submit" size="xs">
              Add
            </Button>
          </Group>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}

function TabBody({
  tab,
  onToggle,
  action,
}: {
  tab: Tab;
  onToggle?: (line: number) => void;
  action?: ReactNode;
}) {
  return (
    <Stack gap="sm">
      {tab.body.trim() === "" ? (
        NOTHING
      ) : (
        <Markdown onToggle={onToggle && ((line) => onToggle(tab.line + line))}>{tab.body}</Markdown>
      )}
      {action && <Group>{action}</Group>}
    </Stack>
  );
}

/** A todo board as read: its tabs, the done ones collected under Done. With `onToggle` boxes are live; with `edit`, tabs can be added and marked done. */
export function Todo({
  content,
  onToggle,
  edit,
  active: controlled,
}: {
  content: string;
  onToggle?: (line: number) => void;
  edit?: TabEdits;
  active?: [ActiveTab, (tab: ActiveTab) => void];
}) {
  const own = useState<ActiveTab>(0);
  const [wanted, setActive] = controlled ?? own;
  const { intro, tabs } = tabsOf(content);
  const open = tabs.filter((t) => !t.done);
  const done = tabs.filter((t) => t.done);
  const active: ActiveTab =
    done.length && (wanted === "done" || !open.length)
      ? "done"
      : Math.max(0, Math.min(wanted === "done" ? 0 : wanted, open.length - 1));
  const current = active === "done" ? undefined : open[active];
  const count = (n: number) =>
    n > 0 && (
      <Text span size="xs" c="dimmed">
        {n}
      </Text>
    );

  if (tabs.length === 0)
    return (
      <Stack gap="sm">
        {content.trim() === "" ? NOTHING : <Markdown onToggle={onToggle}>{content}</Markdown>}
        {edit && (
          <Group>
            <AddTab onAdd={edit.onAdd}>
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                leftSection={<IconPlus size={12} />}
              >
                Add tab
              </Button>
            </AddTab>
          </Group>
        )}
      </Stack>
    );

  return (
    <Stack gap="sm">
      {intro.trim() !== "" && <Markdown onToggle={onToggle}>{intro}</Markdown>}
      <Tabs
        value={String(active)}
        onChange={(value) => value && setActive(value === "done" ? "done" : Number(value))}
      >
        <Tabs.List>
          {open.map((tab, i) => (
            <Tabs.Tab key={i} value={String(i)} rightSection={count(tab.open)}>
              {tab.title}
            </Tabs.Tab>
          ))}
          {done.length > 0 && (
            <Tabs.Tab
              value="done"
              ml="auto"
              leftSection={<IconCheck size={14} />}
              rightSection={count(done.length)}
            >
              Done
            </Tabs.Tab>
          )}
          {edit && (
            <AddTab
              ml={done.length ? undefined : "auto"}
              onAdd={(title) => {
                edit.onAdd(title);
                setActive(open.length);
              }}
            >
              <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Add tab">
                <IconPlus size={16} />
              </ActionIcon>
            </AddTab>
          )}
        </Tabs.List>
        <Tabs.Panel value={String(active)} pt="sm">
          {current ? (
            <TabBody
              tab={current}
              onToggle={onToggle}
              action={
                edit && (
                  <Button
                    variant="default"
                    size="compact-sm"
                    leftSection={<IconCheck size={14} />}
                    onClick={() => edit.onDone(current.line)}
                  >
                    Mark tab done
                  </Button>
                )
              }
            />
          ) : (
            <Accordion multiple variant="separated">
              {done.map((tab, i) => (
                <Accordion.Item key={i} value={tab.title}>
                  <Accordion.Control>{tab.title}</Accordion.Control>
                  <Accordion.Panel>
                    <TabBody
                      tab={tab}
                      onToggle={onToggle}
                      action={
                        edit && (
                          <Button
                            variant="default"
                            size="compact-sm"
                            leftSection={<IconArrowBackUp size={14} />}
                            onClick={() => {
                              edit.onDone(tab.line);
                              setActive(open.filter((t) => t.line < tab.line).length);
                            }}
                          >
                            Reopen
                          </Button>
                        )
                      }
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
