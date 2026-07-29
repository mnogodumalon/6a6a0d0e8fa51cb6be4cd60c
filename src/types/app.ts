// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Kunden {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    firma?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    telefon?: string;
    email?: string;
    bemerkungen_kunde?: string;
  };
}

export interface Material {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    artikelnummer?: string;
    kategorie?: LookupValue;
    einheit?: LookupValue;
    einkaufspreis?: number;
    verkaufspreis?: number;
    bemerkungen_material?: string;
  };
}

export interface Auftraege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftragsnummer?: string;
    bezeichnung?: string;
    kunde?: string; // applookup -> URL zu 'Kunden' Record
    ansprechpartner?: string;
    auftragsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    fertigstellungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    prioritaet?: LookupValue;
    beschreibung?: string;
    bemerkungen_auftrag?: string;
  };
}

export interface Positionen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftrag?: string; // applookup -> URL zu 'Auftraege' Record
    positionstyp?: LookupValue;
    positions_bezeichnung?: string;
    material?: string; // applookup -> URL zu 'Material' Record
    menge?: number;
    einheit_position?: LookupValue;
    einzelpreis?: number;
    gesamtpreis?: number;
    bemerkungen_position?: string;
  };
}

export interface Pruefprotokolle {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftrag_pruef?: string; // applookup -> URL zu 'Auftraege' Record
    pruefdatum?: string; // Format: YYYY-MM-DD oder ISO String
    pruefer_vorname?: string;
    pruefer_nachname?: string;
    pruefpunkte?: string;
    ergebnis?: LookupValue;
    maengelbeschreibung?: string;
    fotos?: string;
    freigabe_erteilt?: boolean;
    bemerkungen_pruef?: string;
  };
}

export const APP_IDS = {
  KUNDEN: '6a6a0ce0a6c5f8f64f583eff',
  MATERIAL: '6a6a0ce7f0b40726bde759f9',
  AUFTRAEGE: '6a6a0ce8517276be5084b88b',
  POSITIONEN: '6a6a0ce93823729f69cb46cb',
  PRUEFPROTOKOLLE: '6a6a0ce9e665471b3ca91d4d',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'material': {
    kategorie: [{ key: "rohre_leitungen", label: "Rohre & Leitungen" }, { key: "befestigungsmaterial", label: "Befestigungsmaterial" }, { key: "elektromaterial", label: "Elektromaterial" }, { key: "daemmmaterial", label: "Dämmmaterial" }, { key: "werkzeug", label: "Werkzeug" }, { key: "sanitaer", label: "Sanitär" }, { key: "heizung", label: "Heizung" }, { key: "sonstiges", label: "Sonstiges" }],
    einheit: [{ key: "kubikmeter", label: "Kubikmeter" }, { key: "pauschal", label: "Pauschal" }, { key: "quadratmeter", label: "Quadratmeter" }, { key: "stueck", label: "Stück" }, { key: "meter", label: "Meter" }, { key: "kilogramm", label: "Kilogramm" }, { key: "liter", label: "Liter" }],
  },
  'auftraege': {
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "storniert", label: "Storniert" }],
    prioritaet: [{ key: "niedrig", label: "Niedrig" }, { key: "normal", label: "Normal" }, { key: "hoch", label: "Hoch" }, { key: "dringend", label: "Dringend" }],
  },
  'positionen': {
    positionstyp: [{ key: "arbeitsleistung", label: "Arbeitsleistung" }, { key: "material_typ", label: "Material" }, { key: "pauschale", label: "Pauschale" }, { key: "sonstiges_typ", label: "Sonstiges" }],
    einheit_position: [{ key: "stueck", label: "Stück" }, { key: "meter", label: "Meter" }, { key: "kilogramm", label: "Kilogramm" }, { key: "liter", label: "Liter" }, { key: "quadratmeter", label: "Quadratmeter" }, { key: "stunden", label: "Stunden" }, { key: "pauschal", label: "Pauschal" }],
  },
  'pruefprotokolle': {
    ergebnis: [{ key: "bestanden", label: "Bestanden" }, { key: "nicht_bestanden", label: "Nicht bestanden" }, { key: "nachbesserung_erforderlich", label: "Nachbesserung erforderlich" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kunden': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'firma': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'bemerkungen_kunde': 'string/textarea',
  },
  'material': {
    'bezeichnung': 'string/text',
    'artikelnummer': 'string/text',
    'kategorie': 'lookup/select',
    'einheit': 'lookup/select',
    'einkaufspreis': 'number',
    'verkaufspreis': 'number',
    'bemerkungen_material': 'string/textarea',
  },
  'auftraege': {
    'auftragsnummer': 'string/text',
    'bezeichnung': 'string/text',
    'kunde': 'applookup/select',
    'ansprechpartner': 'string/text',
    'auftragsdatum': 'date/date',
    'fertigstellungsdatum': 'date/date',
    'status': 'lookup/select',
    'prioritaet': 'lookup/radio',
    'beschreibung': 'string/textarea',
    'bemerkungen_auftrag': 'string/textarea',
  },
  'positionen': {
    'auftrag': 'applookup/select',
    'positionstyp': 'lookup/radio',
    'positions_bezeichnung': 'string/text',
    'material': 'applookup/select',
    'menge': 'number',
    'einheit_position': 'lookup/select',
    'einzelpreis': 'number',
    'gesamtpreis': 'number',
    'bemerkungen_position': 'string/textarea',
  },
  'pruefprotokolle': {
    'auftrag_pruef': 'applookup/select',
    'pruefdatum': 'date/date',
    'pruefer_vorname': 'string/text',
    'pruefer_nachname': 'string/text',
    'pruefpunkte': 'string/textarea',
    'ergebnis': 'lookup/radio',
    'maengelbeschreibung': 'string/textarea',
    'fotos': 'file',
    'freigabe_erteilt': 'bool',
    'bemerkungen_pruef': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKunden = StripLookup<Kunden['fields']>;
export type CreateMaterial = StripLookup<Material['fields']>;
export type CreateAuftraege = StripLookup<Auftraege['fields']>;
export type CreatePositionen = StripLookup<Positionen['fields']>;
export type CreatePruefprotokolle = StripLookup<Pruefprotokolle['fields']>;