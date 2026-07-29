import type { Positionen, Auftraege, Material } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface PositionenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Positionen;
  /** N:1-Ziel „Auftraege": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  auftraegeList: Auftraege[];
  /** Klick auf die Auftraege-Relation → overlay.push auf dessen Detail. */
  onOpenAuftraege?: (record: Auftraege) => void;
  /** N:1-Ziel „Material": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  materialList: Material[];
  /** Klick auf die Material-Relation → overlay.push auf dessen Detail. */
  onOpenMaterial?: (record: Material) => void;
}

export function PositionenDetails({
  record,
  auftraegeList,
  onOpenAuftraege,
  materialList,
  onOpenMaterial,
}: PositionenDetailsProps) {
  const auftragTarget = auftraegeList.find(r => r.record_id === extractRecordId(record.fields.auftrag));
  const materialTarget = materialList.find(r => r.record_id === extractRecordId(record.fields.material));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Positionstyp" value={record.fields.positionstyp} format="pill" />
        <RecordField label="Bezeichnung" value={record.fields.positions_bezeichnung} format="text" />
        <RecordField label="Menge" value={record.fields.menge} format="text" />
        <RecordField label="Einheit" value={record.fields.einheit_position} format="pill" />
        <RecordField label="Einzelpreis (€)" value={record.fields.einzelpreis} format="text" />
        <RecordField label="Gesamtpreis (€)" value={record.fields.gesamtpreis} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_position} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={2}>
        <RecordRelation
          label="Auftrag"
          name={auftragTarget?.fields.auftragsnummer ?? '—'}
          meta={[auftragTarget?.fields.bezeichnung, auftragTarget?.fields.ansprechpartner].filter(Boolean).join(' · ') || undefined}
          onClick={auftragTarget && onOpenAuftraege ? () => onOpenAuftraege!(auftragTarget!) : undefined}
        />
        <RecordRelation
          label="Material"
          name={materialTarget?.fields.bezeichnung ?? '—'}
          meta={[materialTarget?.fields.artikelnummer].filter(Boolean).join(' · ') || undefined}
          onClick={materialTarget && onOpenMaterial ? () => onOpenMaterial!(materialTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.POSITIONEN} recordId={record.record_id} />
    </>
  );
}
