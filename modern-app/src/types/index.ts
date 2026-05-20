export type FieldType =
  | 'parentName'
  | 'studentName'
  | 'idNumber'
  | 'signature'
  | 'date'
  | 'attachment'
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'dropdown'
  | 'yesno'
  | 'email'
  | 'phone'
  | 'initials'
  | 'radio'
  | 'stamp'
  | 'title'
  | 'company'
  | 'number'
  | 'fullName';

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';

export interface ConditionalRule {
  sourceFieldId: string;
  operator: ConditionOperator;
  value: string;
}

export interface DropdownOption {
  value: string;
  label: string;
  labelAr: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  labelAr: string;
  /** X position in PDF points (scale=1 space) */
  x: number;
  /** Y position in PDF points (scale=1 space), measured from top of page */
  y: number;
  /** Width in PDF points */
  width: number;
  /** Height in PDF points */
  height: number;
  /** Coordinate unit — always 'pt' for new templates */
  unit?: 'pt';
  page: number;
  required: boolean;
  condition?: ConditionalRule;
  options?: DropdownOption[];
  placeholder?: string;
  placeholderAr?: string;
  linkedGroup?: string;
  radioGroup?: string;
  formulaExpression?: string;
  /** Min value for number fields */
  minValue?: number;
  /** Max value for number fields */
  maxValue?: number;
}

export interface RequiredAttachment {
  id: string;
  label: string;
  labelAr: string;
  required: boolean;
  accept: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  name_ar: string;
  pdf_data: string;
  pdf_filename: string;
  fields: FormField[];
  required_attachments: RequiredAttachment[];
  excel_webhook_url: string;
  is_active: boolean;
  created_at: string;
  signing_workflow?: SigningWorkflow | null;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Storage URL (new submissions) or base64 data URL (legacy) */
  url?: string;
  /** @deprecated Use url instead. Kept for backward compat with legacy data. */
  data?: string;
}

export interface Submission {
  id: string;
  reference_number: string;
  template_id: string | null;
  template_name: string;
  form_data: Record<string, string>;
  signature_data: string | null;
  attachments: AttachmentMeta[];
  signed_pdf_data: string | null;
  excel_synced: boolean;
  created_at: string;
  status: string;
  workflow_state?: WorkflowStepState[] | null;
  signer_email?: string;
}

export type Language = 'en' | 'ar';

export interface SignerStep {
  /** Unique key for this step, e.g. "parent", "admin" */
  key: string;
  label: string;
  labelAr: string;
  /** Whether this step requires a signature */
  requiresSignature: boolean;
  /** Order (1-based) */
  order: number;
}

export interface SigningWorkflow {
  enabled: boolean;
  steps: SignerStep[];
}

export interface WorkflowStepState {
  key: string;
  completedAt: string | null;
  signerName?: string;
  signerEmail?: string;
  signatureData?: string | null;
}
