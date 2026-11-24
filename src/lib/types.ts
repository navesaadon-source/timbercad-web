export type Role = "admin" | "client";

export type OrderStatus = "submitted" | "production" | "frozen" | "done" | "billing" | "billed" | "cancelled";

export interface HingeSpec { brand?: string; plate?: string; fixation?: string; dowel_size?: string }
export interface DrawerSpec { system_type?: string; brand?: string; model?: string; model_custom?: string }
export interface HardwareSpec { connection_method?: string; hinge: HingeSpec; drawer: DrawerSpec }
export interface MaterialSpec {
  material_type?: string; importer?: string; importer_other?: string; color_code?: string; board_dim?: string;
}
export interface FrontsSpec extends MaterialSpec { same_as_carcass?: boolean }

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  role: Role;
  defaults: HardwareSpec;      // one-time standard, loaded into each new order
  notes: string;               // admin-only notes
  drive_folder: string;        // customer folder name under the Drive root (e.g. COSMEC)
  created_at: string;
}

export interface Attachment { name: string; path: string; size: number; type: string }

export interface Order {
  id: string;
  order_no: number;
  user_id: string;
  project_name: string;
  job_name: string;            // iMOS order name = folder name in CNC_FILES / Imorder
  status: OrderStatus;
  hardware: HardwareSpec;
  carcass: MaterialSpec;
  fronts: FrontsSpec;
  notes: string;
  admin_notes: string;
  attachments: Attachment[];
  sheets_count: number | null;
  hub_path: string | null;     // storage path of the job hub HTML (filled by the PC watcher)
  frozen_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Profile, "id" | "full_name" | "company_name" | "email" | "phone" | "drive_folder">;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  actor_id: string | null;
  kind: "created" | "status" | "edited" | "frozen" | "unfrozen" | "hub_ready";
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  note: string | null;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  category: string;
  key: string;
  label: string;
  parent: string | null;       // e.g. drawer model -> "complete:blum"
  sort: number;
  active: boolean;
}
