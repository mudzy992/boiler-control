import type { JSX } from 'react';
import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Field,
  GaugeBar,
  HeroPanel,
  IconButton,
  Led,
  LogoMark,
  NumberInput,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Readout,
  Select,
  Stack,
  Switch,
  TextInput,
  Textarea,
} from '@/ui';
import { Moon } from 'lucide-react';
import { useState } from 'react';

export const DesignGalleryPage = (): JSX.Element => {
  const [on, setOn] = useState(true);
  return (
    <Stack gap="page" className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Instrument UI"
        description="Design system gallery — every primitive in every core state."
      />
      <Panel>
        <PanelHeader>
          <PanelTitle>Actions</PanelTitle>
          <Led state="on" className="mt-0" />
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button isLoading loadingLabel="Saving">
            Save
          </Button>
          <IconButton aria-label="Theme" variant="ghost">
            <Moon className="h-4 w-4" />
          </IconButton>
          <LogoMark size="md" />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>
          <PanelTitle>Fields</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <Field id="g-name" label="Name" hint="Operator name">
            <TextInput id="g-name" placeholder="Mudžahid" />
          </Field>
          <Field id="g-num" label="Flow" error="Out of range">
            <NumberInput id="g-num" invalid defaultValue={99} />
          </Field>
          <Field id="g-sel" label="Mode">
            <Select id="g-sel" defaultValue="auto">
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </Select>
          </Field>
          <Field id="g-area" label="Notes">
            <Textarea id="g-area" placeholder="Notes" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <Checkbox defaultChecked /> Acknowledge
          </label>
          <div className="flex items-center gap-2 text-sm text-ink">
            <Switch checked={on} onCheckedChange={setOn} aria-label="Toggle" />
            Heating aid
          </div>
        </PanelBody>
      </Panel>
      <HeroPanel>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-start gap-3">
            <Led state="on" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Status
              </p>
              <h2 className="text-display font-semibold text-ink">Heating Active</h2>
            </div>
          </div>
          <Readout label="Current Temp" value="21.4" unit="°C" />
        </div>
        <div className="mt-5">
          <GaugeBar
            ratio={0.72}
            label="18 / 25 min"
            detail="72%"
          />
        </div>
      </HeroPanel>
      <div className="grid gap-3 sm:grid-cols-2">
        <Banner tone="ok" message="Temperature saved." />
        <Banner tone="fault" message="Overtime detected." />
        <Badge tone="warn">Anomaly</Badge>
        <Badge tone="info">Advisory</Badge>
      </div>
    </Stack>
  );
};
