import type { Material, Positionen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface MaterialDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Material;
  /** 1:N „Positionen": VOLLE Liste — der Block filtert auf diesen Record. */
  positionenList: Positionen[];
  /** Zeilen-Klick → overlay.push auf das Positionen-Detail (nie der Edit-Dialog). */
  onOpenPositionen: (record: Positionen) => void;
  /** Kontextuelles „+": öffnet den Positionen-Dialog mit diesem Record vorgesetzt. */
  onAddPositionen: () => void;
}

export function MaterialDetails({
  record,
  positionenList,
  onOpenPositionen,
  onAddPositionen,
}: MaterialDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Bezeichnung" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Artikelnummer" value={record.fields.artikelnummer} format="text" />
        <RecordField label="Kategorie" value={record.fields.kategorie} format="pill" />
        <RecordField label="Einheit" value={record.fields.einheit} format="pill" />
        <RecordField label="Einkaufspreis (€)" value={record.fields.einkaufspreis} format="text" />
        <RecordField label="Verkaufspreis (€)" value={record.fields.verkaufspreis} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_material} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Positionen"
        items={positionenList.filter(r => extractRecordId(r.fields.material) === record.record_id)}
        map={r => ({ name: r.fields.positions_bezeichnung ?? 'Positionen', meta: undefined })}
        onOpen={onOpenPositionen}
        onAdd={onAddPositionen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.MATERIAL} recordId={record.record_id} />
    </>
  );
}
