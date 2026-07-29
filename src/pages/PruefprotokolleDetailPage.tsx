import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Pruefprotokolle, Auftraege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { PruefprotokolleDialog } from '@/components/dialogs/PruefprotokolleDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Pruefprotokolle';
import { evalComputed } from '@/config/form-enhancements/types';

export default function PruefprotokolleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Pruefprotokolle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [auftraegeList, setAuftraegeList] = useState<Auftraege[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, auftraegeData] = await Promise.all([
        LivingAppsService.getPruefprotokolle(),
        LivingAppsService.getAuftraege(),
      ]);
      setAuftraegeList(auftraegeData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Pruefprotokolle['fields']) {
    if (!record) return;
    await LivingAppsService.updatePruefprotokolleEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deletePruefprotokolleEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/pruefprotokolle');
  }

  function getAuftraegeDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return auftraegeList.find(r => r.record_id === refId)?.fields.auftragsnummer ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/pruefprotokolle')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/pruefprotokolle')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.pruefer_vorname ?? 'Prüfprotokolle'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          auftrag_pruef: auftraegeList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Auftrag" value={getAuftraegeDisplayName(record.fields.auftrag_pruef)} format="text" />
        <RecordField label="Prüfdatum" value={record.fields.pruefdatum} format="date" />
        <RecordField label="Prüfer Vorname" value={record.fields.pruefer_vorname} format="text" />
        <RecordField label="Prüfer Nachname" value={record.fields.pruefer_nachname} format="text" />
        <RecordField label="Prüfpunkte" value={record.fields.pruefpunkte} format="longtext" className="md:col-span-2" />
        <RecordField label="Prüfergebnis" value={record.fields.ergebnis} format="pill" />
        <RecordField label="Mängelbeschreibung" value={record.fields.maengelbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Freigabe erteilt" value={record.fields.freigabe_erteilt} format="bool" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_pruef} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PRUEFPROTOKOLLE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <PruefprotokolleDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        auftraegeList={auftraegeList}
        enablePhotoScan={AI_PHOTO_SCAN['Pruefprotokolle']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Pruefprotokolle']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Prüfprotokolle löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
