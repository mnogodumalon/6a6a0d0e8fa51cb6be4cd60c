import type { Pruefprotokolle, Auftraege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface PruefprotokolleDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Pruefprotokolle;
  /** N:1-Ziel „Auftraege": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  auftraegeList: Auftraege[];
  /** Klick auf die Auftraege-Relation → overlay.push auf dessen Detail. */
  onOpenAuftraege?: (record: Auftraege) => void;
}

export function PruefprotokolleDetails({
  record,
  auftraegeList,
  onOpenAuftraege,
}: PruefprotokolleDetailsProps) {
  const auftrag_pruefTarget = auftraegeList.find(r => r.record_id === extractRecordId(record.fields.auftrag_pruef));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Prüfdatum" value={record.fields.pruefdatum} format="date" />
        <RecordField label="Prüfer Vorname" value={record.fields.pruefer_vorname} format="text" />
        <RecordField label="Prüfer Nachname" value={record.fields.pruefer_nachname} format="text" />
        <RecordField label="Prüfpunkte" value={record.fields.pruefpunkte} format="longtext" className="md:col-span-2" />
        <RecordField label="Prüfergebnis" value={record.fields.ergebnis} format="pill" />
        <RecordField label="Mängelbeschreibung" value={record.fields.maengelbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Fotos / Dokumente" className="md:col-span-2">
          {record.fields.fotos ? (
            <MediaThumbnail src={record.fields.fotos as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label="Freigabe erteilt" value={record.fields.freigabe_erteilt} format="bool" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_pruef} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Auftrag"
          name={auftrag_pruefTarget?.fields.auftragsnummer ?? '—'}
          meta={[auftrag_pruefTarget?.fields.bezeichnung, auftrag_pruefTarget?.fields.ansprechpartner].filter(Boolean).join(' · ') || undefined}
          onClick={auftrag_pruefTarget && onOpenAuftraege ? () => onOpenAuftraege!(auftrag_pruefTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PRUEFPROTOKOLLE} recordId={record.record_id} />
    </>
  );
}
