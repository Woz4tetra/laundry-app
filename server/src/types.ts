// Shared domain types for the laundry app. These mirror what the web client
// consumes, so keep them serializable (plain JSON).

export type DryMethod = 'machine' | 'hang' | 'rack' | 'none';
export type FillLevel = 'empty' | 'small' | 'half' | 'full';

/** A sortable laundry category (the bins in step 1). */
export interface Category {
  id: string;
  name: string;
  icon: string; // emoji
  color: string; // hex for the bin card
  order: number;
  /** Wash temperature on the 1-5 scale (5 hot ... 1 tap cold). null = not washed. */
  washTemp: number | null;
  dryMethod: DryMethod;
  /** Default machine-dry recommendation (used when dryMethod === 'machine'). */
  dryDefault: { heat: string; minutes: number } | null;
  /** If set, small amounts of this category may be merged into the named category. */
  mergeIntoId: string | null;
  /** Item tags that must NOT share a load with this category (e.g. towels vs bath mats). */
  exclusions: string[];
  meshBag: 'bra' | 'normal' | null;
  maxItems: number | null;
  /** Special delicates: not washed, routed to a cleaning service. */
  routeToService: boolean;
}

/** A prep reminder shown during a load's prep checklist. */
export interface PrepRule {
  id: string;
  text: string;
  icon: string;
  appliesTo: string[]; // category ids
}

export interface QuietHours {
  enabled: boolean;
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

/** Global wash/dry rules, all editable in the Rules editor. */
export interface GlobalSettings {
  /** Drum fill at or below this fraction is required before washing. */
  maxFillFraction: number;
  /** Fill level at/below which detergent goes to mark 1 (else mark 2). */
  detergentMark1MaxFill: FillLevel;
  extraRinseAlways: boolean;
  vinegarInSoftenerTray: boolean;
  vinegarNote: string;
  leaveDoorOpenAfter: boolean;
  emptyLintTrapBeforeDry: boolean;
  quietHours: QuietHours;
  /** Default wash/dry durations in minutes for finish-time estimates. */
  defaultWashMinutes: number;
  defaultDryMinutes: number;
  /** Remind to fold/hang once this many loads finish unacknowledged. 0 = off. */
  foldReminderEvery: number;
}

// --- Machine control-panel model (drives the SVG walkthrough) ---

export type ControlType = 'dial' | 'button' | 'display' | 'ledGroup' | 'logo' | 'text';

export interface PanelControl {
  id: string;
  type: ControlType;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  /** Dial cycle positions or LED-group rows, top-to-bottom / clockwise. */
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
  /** Control ids to highlight for this step. */
  highlight: string[];
}

export interface Machine {
  id: 'washer' | 'dryer';
  name: string;
  model: string;
  panel: MachinePanel;
  steps: MachineStep[];
  /** Maps the 1-5 temp scale to this machine's Temp button labels (washer only). */
  tempScale?: Record<string, string>;
}

// --- Session model ---

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
  /** Epoch ms when this timer fires. */
  endsAt: number;
  /** For delayed_start: which phase to begin when it fires. */
  startsPhase?: 'wash' | 'dry';
  notified: boolean;
}

export interface WashChoices {
  /** Drum fill level chosen at load time, drives detergent mark. */
  fill: FillLevel;
}

export interface DryChoices {
  heat: string;
  minutes: number;
}

export interface Load {
  id: string;
  /** Category ids combined into this load (usually one, sometimes general+socks). */
  categoryIds: string[];
  label: string;
  status: LoadStatus;
  /** Checklist completion: prep rule ids and checkpoint keys that are checked. */
  checked: Record<string, boolean>;
  wash?: WashChoices;
  dry?: DryChoices;
  timer?: Timer;
  createdAt: number;
}

export type SessionStep = 'sort' | 'build' | 'run';

export interface LaundrySession {
  id: string;
  step: SessionStep;
  /** Per-category fill chosen during sorting. */
  sort: Record<string, FillLevel>;
  loads: Load[];
  /** Set once all loads are washed, to surface the leave-door-open reminder. */
  doorOpenAcknowledged: boolean;
  /** Count of finished loads the user has confirmed folded/hung & put away. */
  foldedThrough: number;
  createdAt: number;
  updatedAt: number;
  active: boolean;
}
