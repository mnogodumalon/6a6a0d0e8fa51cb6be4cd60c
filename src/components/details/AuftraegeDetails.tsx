import type { Auftraege, Kunden, Positionen, Pruefprotokolle } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface AuftraegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Auftraege;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** 1:N „Positionen": VOLLE Liste — der Block filtert auf diesen Record. */
  positionenList: Positionen[];
  /** Zeilen-Klick → overlay.push auf das Positionen-Detail (nie der Edit-Dialog). */
  onOpenPositionen: (record: Positionen) => void;
  /** Kontextuelles „+": öffnet den Positionen-Dialog mit diesem Record vorgesetzt. */
  onAddPositionen: () => void;
  /** 1:N „Prüfprotokolle": VOLLE Liste — der Block filtert auf diesen Record. */
  pruefprotokolleList: Pruefprotokolle[];
  /** Zeilen-Klick → overlay.push auf das Pruefprotokolle-Detail (nie der Edit-Dialog). */
  onOpenPruefprotokolle: (record: Pruefprotokolle) => void;
  /** Kontextuelles „+": öffnet den Pruefprotokolle-Dialog mit diesem Record vorgesetzt. */
  onAddPruefprotokolle: () => void;
}

export function AuftraegeDetails({
  record,
  kundenList,
  onOpenKunden,
  positionenList,
  onOpenPositionen,
  onAddPositionen,
  pruefprotokolleList,
  onOpenPruefprotokolle,
  onAddPruefprotokolle,
}: AuftraegeDetailsProps) {
  const kundeTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.kunde));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Auftragsnummer" value={record.fields.auftragsnummer} format="text" />
        <RecordField label="Auftragsbezeichnung" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Ansprechpartner beim Kunden" value={record.fields.ansprechpartner} format="text" />
        <RecordField label="Auftragsdatum" value={record.fields.auftragsdatum} format="date" />
        <RecordField label="Gewünschtes Fertigstellungsdatum" value={record.fields.fertigstellungsdatum} format="date" />
        <RecordField label="Status" value={record.fields.status} format="pill" />
        <RecordField label="Priorität" value={record.fields.prioritaet} format="pill" />
        <RecordField label="Auftragsbeschreibung" value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_auftrag} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Kunde"
          name={kundeTarget?.fields.vorname ?? '—'}
          meta={[kundeTarget?.fields.telefon, kundeTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={kundeTarget && onOpenKunden ? () => onOpenKunden!(kundeTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title="Positionen"
        items={positionenList.filter(r => extractRecordId(r.fields.auftrag) === record.record_id)}
        map={r => ({ name: r.fields.positions_bezeichnung ?? 'Positionen', meta: undefined })}
        onOpen={onOpenPositionen}
        onAdd={onAddPositionen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Prüfprotokolle"
        items={pruefprotokolleList.filter(r => extractRecordId(r.fields.auftrag_pruef) === record.record_id)}
        map={r => ({ name: r.fields.pruefer_vorname ?? 'Prüfprotokolle', meta: r.fields.pruefdatum })}
        onOpen={onOpenPruefprotokolle}
        onAdd={onAddPruefprotokolle}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.AUFTRAEGE} recordId={record.record_id} />
    </>
  );
}
