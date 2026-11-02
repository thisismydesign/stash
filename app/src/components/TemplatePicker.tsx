import { Group, Radio, SimpleGrid, Text } from "@mantine/core";
import {
  IconChefHat,
  IconFile,
  IconListCheck,
  IconPhoto,
  IconTable,
  IconTimeline,
} from "@tabler/icons-react";
import { TEMPLATES, type TemplateId } from "../lib/templates/index.ts";

import "./template-picker.css";

const TEMPLATE_ICON: Record<TemplateId, typeof IconFile> = {
  blank: IconFile,
  todo: IconListCheck,
  "mood-board": IconPhoto,
  comparison: IconTable,
  recipe: IconChefHat,
  timeline: IconTimeline,
};

/** What a new page starts as; one of the templates is always chosen. */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}) {
  return (
    <Radio.Group label="Template" value={value} onChange={(v) => onChange(v as TemplateId)}>
      <SimpleGrid cols={2} spacing="xs" mt={4}>
        {TEMPLATES.map((t) => {
          const Icon = TEMPLATE_ICON[t.id];
          return (
            <Radio.Card key={t.id} value={t.id} p="xs" radius="md" className="template">
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Icon size={18} className="template-icon" />
                <div>
                  <Text size="sm" fw={600} lh={1.3}>
                    {t.name}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.3}>
                    {t.description}
                  </Text>
                </div>
              </Group>
            </Radio.Card>
          );
        })}
      </SimpleGrid>
    </Radio.Group>
  );
}
