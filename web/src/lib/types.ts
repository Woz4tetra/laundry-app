// Client-side mirror of the server domain types (kept in sync manually).

export type DryMethod = 'machine' | 'hang' | 'rack' | 'none';
export type FillLevel = 'empty' | 'small' | 'half' | 'full';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  washTemp: number | null;
  dryMethod: DryMethod;
  dryDefault: { heat: string; minutes: number } | null;
  mergeIntoId: string | null;
  exclusions: string[];
  meshBag: 'bra' | 'normal' | null;
  maxItems: number | null;
  routeToService: boolean;
}

export interface PrepRule {
  id: string;
  text: string;
  icon: string;
  appliesTo: string[];
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface GlobalSettings {
  maxFillFraction: number;
  detergentMark1MaxFill: FillLevel;
  extraRinseAlways: boolean;
  vinegarInSoftenerTray: boolean;
  vinegarNote: string;
  leaveDoorOpenAfter: boolean;
  emptyLintTrapBeforeDry: boolean;
  quietHours: QuietHours;
  defaultWashMinutes: number;
  defaultDryMinutes: number;
}

export type ControlType = 'dial' | 'button' | 'display' | 'ledGroup' | 'logo' | 'text';

export interface PanelControl {
  id: string;
  type: ControlType;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  labels?: string[];
}

export interface MachinePanel {
  width: number;
  height: number;
  controls: PanelControl[];
}

export interface MachineStep {
  id: string;
  title: string;
  instruction: string;
  highlight: string[];
}

export interface Machine {
  id: 'washer' | 'dryer';
  name: string;
  model: string;
  panel: MachinePanel;
  steps: MachineStep[];
  tempScale?: Record<string, string>;
}

export type LoadStatus =
  | 'queued'
  | 'prepping'
  | 'ready_to_wash'
  | 'washing'
  | 'wash_done'
  | 'drying'
  | 'dry_done'
  | 'done';

export interface Timer {
  kind: 'wash' | 'dry' | 'delayed_start';
  endsAt: number;
  startsPhase?: 'wash' | 'dry';
  notified: boolean;
}

export interface Load {
  id: string;
  categoryIds: string[];
  label: string;
  status: LoadStatus;
  checked: Record<string, boolean>;
  wash?: { fill: FillLevel };
  dry?: { heat: string; minutes: number };
  timer?: Timer;
  createdAt: number;
}

export type SessionStep = 'sort' | 'build' | 'run';

export interface LaundrySession {
  id: string;
  step: SessionStep;
  sort: Record<string, FillLevel>;
  loads: Load[];
  doorOpenAcknowledged: boolean;
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

export interface AppConfig {
  categories: Category[];
  prepRules: PrepRule[];
  settings: GlobalSettings;
  machines: Machine[];
  dryerMemory: Record<string, { heat: string; minutes: number }>;
}
