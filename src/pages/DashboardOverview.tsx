import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAuftraege, enrichPositionen, enrichPruefprotokolle } from '@/lib/enrich';
import type { EnrichedAuftraege } from '@/types/enriched';
import type { Kunden, Auftraege, Positionen, Pruefprotokolle } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { format } from 'date-fns';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
} from '@/components/widgets/RecordView';
import { AuftraegeDetails } from '@/components/details/AuftraegeDetails';
import { PositionenDetails } from '@/components/details/PositionenDetails';
import { PruefprotokolleDetails } from '@/components/details/PruefprotokolleDetails';
import { KundenDetails } from '@/components/details/KundenDetails';
import { AuftraegeDialog, type AuftraegeDialogDefaults } from '@/components/dialogs/AuftraegeDialog';
import { PositionenDialog, type PositionenDialogDefaults } from '@/components/dialogs/PositionenDialog';
import { PruefprotokolleDialog, type PruefprotokolleDialogDefaults } from '@/components/dialogs/PruefprotokolleDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { IconAlertTriangle, IconPlus, IconCircleCheck } from '@tabler/icons-react';

type OverlayItem =
  | { type: 'auftrag'; id: string }
  | { type: 'position'; id: string }
  | { type: 'pruefprotokoll'; id: string }
  | { type: 'kunde'; id: string };

const STATUS_COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['auftraege']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'abgeschlossen') return 'success';
  if (status === 'in_bearbeitung') return 'primary';
  if (status === 'storniert') return 'default';
  return 'warning'; // offen → braucht Aufmerksamkeit
}

export default function DashboardOverview() {
  const clock = useClock();

  const {
    kunden, material, auftraege, positionen, pruefprotokolle,
    kundenMap, materialMap, auftraegeMap,
    setAuftraege,
    loading, error, fetchAll,
  } = useDashboardData();

  // ALL hooks BEFORE early returns
  const enrichedAuftraege = enrichAuftraege(auftraege, { kundenMap });
  const enrichedPositionen = enrichPositionen(positionen, { auftraegeMap, materialMap });
  const enrichedPruefprotokolle = enrichPruefprotokolle(pruefprotokolle, { auftraegeMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  const [auftraegeDialogOpen, setAuftraegeDialogOpen] = useState(false);
  const [auftraegeDefaults, setAuftraegeDefaults] = useState<AuftraegeDialogDefaults | undefined>();
  const [editingAuftragId, setEditingAuftragId] = useState<string | undefined>();

  const [positionenDialogOpen, setPositionenDialogOpen] = useState(false);
  const [positionenDefaults, setPositionenDefaults] = useState<PositionenDialogDefaults | undefined>();
  const [editingPositionId, setEditingPositionId] = useState<string | undefined>();

  const [pruefprotokolleDialogOpen, setPruefprotokolleDialogOpen] = useState(false);
  const [pruefprotokolleDefaults, setPruefprotokolleDefaults] = useState<PruefprotokolleDialogDefaults | undefined>();
  const [editingPruefprotokollId, setEditingPruefprotokollId] = useState<string | undefined>();

  // KPI-Daten
  const offene = useMemo(() => enrichedAuftraege.filter(a => lookupKey(a.fields.status) === 'offen'), [enrichedAuftraege]);
  const inBearbeitung = useMemo(() => enrichedAuftraege.filter(a => lookupKey(a.fields.status) === 'in_bearbeitung'), [enrichedAuftraege]);
  const dringend = useMemo(() => enrichedAuftraege.filter(a => lookupKey(a.fields.prioritaet) === 'dringend'), [enrichedAuftraege]);
  const abgeschlossen = useMemo(() => enrichedAuftraege.filter(a => lookupKey(a.fields.status) === 'abgeschlossen'), [enrichedAuftraege]);
  const ohneProtokoll = useMemo(() => abgeschlossen.filter(a => !pruefprotokolle.some(p => extractRecordId(p.fields.auftrag_pruef) === a.record_id)), [abgeschlossen, pruefprotokolle]);

  // Fälligkeiten heute
  const heute = new Date(clock);
  const heuteDatum = format(heute, 'yyyy-MM-dd');

  const faelligHeute = useMemo(() => enrichedAuftraege.filter(a => {
    if (!a.fields.fertigstellungsdatum) return false;
    return a.fields.fertigstellungsdatum.slice(0, 10) === heuteDatum && lookupKey(a.fields.status) !== 'abgeschlossen' && lookupKey(a.fields.status) !== 'storniert';
  }), [enrichedAuftraege, heuteDatum]);

  const ueberfaellig = useMemo(() => enrichedAuftraege.filter(a => {
    if (!a.fields.fertigstellungsdatum) return false;
    return a.fields.fertigstellungsdatum.slice(0, 10) < heuteDatum && lookupKey(a.fields.status) !== 'abgeschlossen' && lookupKey(a.fields.status) !== 'storniert';
  }), [enrichedAuftraege, heuteDatum]);

  // KPI-Filter
  const [activeFilter, setActiveFilter] = useState<'dringend' | 'offen' | null>(null);

  // Kanban-Karten
  const cards = useMemo<KanbanCard[]>(() =>
    enrichedAuftraege.map(a => {
      const status = lookupKey(a.fields.status) ?? STATUS_COLUMNS[0]?.key ?? '';
      return {
        id: `auftrag:${a.record_id}`,
        column: status,
        title: a.fields.bezeichnung ?? a.fields.auftragsnummer ?? 'Auftrag',
        subtitle: a.kundeName ? `${a.kundeName}${a.fields.fertigstellungsdatum ? ' · ' + formatDate(a.fields.fertigstellungsdatum) : ''}` : (a.fields.fertigstellungsdatum ? formatDate(a.fields.fertigstellungsdatum) : undefined),
        tone: toneForStatus(status),
      };
    }).filter(c => {
      if (activeFilter === 'dringend') return dringend.some(a => `auftrag:${a.record_id}` === c.id);
      if (activeFilter === 'offen') return offene.some(a => `auftrag:${a.record_id}` === c.id);
      return true;
    }),
    [enrichedAuftraege, activeFilter, dringend, offene],
  );

  // Status-Wechsel via Drag
  const moveCard = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const auftrag = auftraege.find(a => a.record_id === rid);
    if (!auftrag) return;
    const oldStatus = lookupKey(auftrag.fields.status);
    if (oldStatus === newColumn) return;
    const prevFields = auftrag.fields;
    // Optimistisch
    setAuftraege(prev => prev.map(a =>
      a.record_id === rid
        ? { ...a, fields: { ...a.fields, status: { key: newColumn, label: newColumn } } }
        : a,
    ));
    const newLabel = STATUS_COLUMNS.find(c => c.key === newColumn)?.label ?? newColumn;
    undoToast(`Status geändert: ${newLabel}`, async () => {
      setAuftraege(prev => prev.map(a =>
        a.record_id === rid ? { ...a, fields: { ...a.fields, ...prevFields } } : a,
      ));
      await LivingAppsService.updateAuftraegeEntry(rid, { status: oldStatus ?? newColumn });
    });
    try {
      await LivingAppsService.updateAuftraegeEntry(rid, { status: newColumn });
    } catch {
      fetchAll();
    }
  }, [auftraege, setAuftraege, fetchAll]);

  // Status-Vorschritt (Advance-Helper)
  const advanceStatus = useCallback(async (auftrag: EnrichedAuftraege) => {
    const statusOrder: Record<string, string> = { offen: 'in_bearbeitung', in_bearbeitung: 'abgeschlossen' };
    const current = lookupKey(auftrag.fields.status);
    const next = current ? statusOrder[current] : 'in_bearbeitung';
    if (!next) return;
    const prevFields = auftrag.fields;
    const nextLabel = STATUS_COLUMNS.find(c => c.key === next)?.label ?? next;
    setAuftraege(prev => prev.map(a =>
      a.record_id === auftrag.record_id
        ? { ...a, fields: { ...a.fields, status: { key: next, label: nextLabel } } }
        : a,
    ));
    undoToast(`${auftrag.fields.bezeichnung ?? 'Auftrag'} → ${nextLabel}`, async () => {
      setAuftraege(prev => prev.map(a =>
        a.record_id === auftrag.record_id ? { ...a, fields: { ...a.fields, ...prevFields } } : a,
      ));
      await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, { status: lookupKey(prevFields.status) ?? 'offen' });
    });
    try {
      await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, { status: next });
    } catch {
      fetchAll();
    }
  }, [auftraege, setAuftraege, fetchAll]);

  const getNextStatusLabel = (a: EnrichedAuftraege) => {
    const cur = lookupKey(a.fields.status);
    if (cur === 'offen') return '▶ In Bearbeitung';
    if (cur === 'in_bearbeitung') return '✓ Abschließen';
    return null;
  };

  // WorkList-Items für Fällige & Überfällige
  const workItems = useMemo(() => {
    const items = [...ueberfaellig, ...faelligHeute].map(a => ({
      id: a.record_id,
      title: a.fields.bezeichnung ?? a.fields.auftragsnummer ?? 'Auftrag',
      secondLine: (
        <>
          {ueberfaellig.includes(a)
            ? <span className="font-medium text-destructive">Überfällig</span>
            : <span className="font-medium text-warning">Heute fällig</span>
          }
          {a.kundeName && <span className="text-muted-foreground"> · {a.kundeName}</span>}
          {a.fields.fertigstellungsdatum && <span className="text-muted-foreground"> · {formatDate(a.fields.fertigstellungsdatum)}</span>}
        </>
      ),
      action: getNextStatusLabel(a) ? {
        label: getNextStatusLabel(a)!,
        onClick: () => void advanceStatus(a),
      } : undefined,
    }));
    return items;
  }, [ueberfaellig, faelligHeute, advanceStatus]);

  // Kontext-Zeile
  const kontextZeile = useMemo(() => {
    if (enrichedAuftraege.length === 0) return 'Noch keine Aufträge — lege deinen ersten an.';
    const namen_dringend = namen(dringend.map(a => a.kundeName ?? a.fields.bezeichnung ?? '').filter(Boolean));
    if (ueberfaellig.length > 0) {
      return `${ueberfaellig.length} ${ueberfaellig.length === 1 ? 'Auftrag überfällig' : 'Aufträge überfällig'}${ueberfaellig[0].kundeName ? ` — ${namen(ueberfaellig.map(a => a.kundeName ?? ''))}` : ''}.`;
    }
    if (dringend.length > 0) return `${namen_dringend} ${dringend.length === 1 ? 'hat' : 'haben'} dringenden Bedarf.`;
    if (inBearbeitung.length > 0) return `${inBearbeitung.length} ${inBearbeitung.length === 1 ? 'Auftrag' : 'Aufträge'} in Bearbeitung — alles im Zeitplan.`;
    return `${offene.length} offene ${offene.length === 1 ? 'Auftrag' : 'Aufträge'} warten auf den Start.`;
  }, [enrichedAuftraege, ueberfaellig, dringend, inBearbeitung, offene]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Overlay-Record-Lookup-Helfer
  const getAuftragById = (id: string) => auftraege.find(a => a.record_id === id);
  const getPositionById = (id: string) => positionen.find(p => p.record_id === id);
  const getPruefprotokollById = (id: string) => pruefprotokolle.find(p => p.record_id === id);
  const getKundeById = (id: string) => kunden.find(k => k.record_id === id);

  const nextStatusLabel = overlay.top?.type === 'auftrag'
    ? getNextStatusLabel(enrichedAuftraege.find(a => a.record_id === overlay.top!.id)!)
    : null;

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{gruss(clock)}</h1>
            <p className="text-muted-foreground mt-1">{kontextZeile}</p>
          </div>
          <button
            onClick={() => { setAuftraegeDefaults(undefined); setEditingAuftragId(undefined); setAuftraegeDialogOpen(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <IconPlus size={16} className="shrink-0" />
            Neuer Auftrag
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaellig.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: '▶ In Bearbeitung',
              onClick: () => void advanceStatus(ueberfaellig[0]),
            }}
          >
            <b>{namen(ueberfaellig.map(a => a.kundeName ?? a.fields.bezeichnung ?? '').filter(Boolean))}</b>
            {' '}{ueberfaellig.length === 1 ? 'ist überfällig' : 'sind überfällig'} — Fertigstellung war{' '}
            {formatDate(ueberfaellig[0].fields.fertigstellungsdatum)}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Offen"
              value={offene.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={offene.length > 0 ? 'warning' : 'default'}
              onClick={() => setActiveFilter(f => f === 'offen' ? null : 'offen')}
              active={activeFilter === 'offen'}
            />
            <StatStripItem
              title="In Bearbeitung"
              value={inBearbeitung.length}
              tone={inBearbeitung.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Dringend"
              value={dringend.length}
              tone={dringend.length > 0 ? 'destructive' : 'default'}
              onClick={() => setActiveFilter(f => f === 'dringend' ? null : 'dringend')}
              active={activeFilter === 'dringend'}
            />
            <StatStripItem
              title="Abgeschlossen"
              value={abgeschlossen.length}
              icon={<IconCircleCheck size={16} className="shrink-0" />}
              tone="success"
            />
            {ohneProtokoll.length > 0 && (
              <StatStripItem
                title="Ohne Prüfprotokoll"
                value={ohneProtokoll.length}
                tone="warning"
              />
            )}
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={STATUS_COLUMNS}
            defaultCollapsed={['storniert']}
            onCardClick={card => overlay.replace({ type: 'auftrag', id: card.id.split(':')[1] ?? '' })}
            onCardMove={moveCard}
            onAddCard={column => {
              setAuftraegeDefaults({ status: column });
              setEditingAuftragId(undefined);
              setAuftraegeDialogOpen(true);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Fällig & überfällig"
              items={workItems}
              onItemClick={id => overlay.replace({ type: 'auftrag', id })}
              empty={{
                text: faelligHeute.length === 0 && ueberfaellig.length === 0
                  ? 'Keine Fristen heute — nächster Termin aus dem Board'
                  : undefined,
                action: { label: 'Neuer Auftrag', onClick: () => { setAuftraegeDefaults(undefined); setEditingAuftragId(undefined); setAuftraegeDialogOpen(true); } },
              }}
            />
            <WorkList
              title="Abgeschlossen ohne Protokoll"
              items={ohneProtokoll.map(a => ({
                id: a.record_id,
                title: a.fields.bezeichnung ?? a.fields.auftragsnummer ?? 'Auftrag',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{a.kundeName}</span>
                    {a.fields.fertigstellungsdatum && <span className="text-muted-foreground"> · {formatDate(a.fields.fertigstellungsdatum)}</span>}
                  </>
                ),
                action: {
                  label: '+ Protokoll',
                  onClick: () => {
                    setPruefprotokolleDefaults({ auftrag_pruef: a.record_id });
                    setEditingPruefprotokollId(undefined);
                    setPruefprotokolleDialogOpen(true);
                  },
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'auftrag', id })}
              empty={{
                text: 'Alle Aufträge haben ein Prüfprotokoll — super!',
              }}
            />
          </>
        }
      />

      {/* Overlay-Stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'auftrag') {
            const a = getAuftragById(top.id);
            if (!a) return null;
            return (
              <>
                <RecordHeader
                  title={a.fields.bezeichnung ?? a.fields.auftragsnummer ?? 'Auftrag'}
                  subtitle={[a.fields.status?.label, enrichedAuftraege.find(ea => ea.record_id === a.record_id)?.kundeName].filter(Boolean).join(' · ')}
                />
                <AuftraegeDetails
                  record={a}
                  kundenList={kunden}
                  onOpenKunden={k => overlay.push({ type: 'kunde', id: k.record_id })}
                  positionenList={positionen}
                  onOpenPositionen={p => overlay.push({ type: 'position', id: p.record_id })}
                  onAddPositionen={() => {
                    setPruefprotokolleDefaults(undefined);
                    setPositionenDefaults({ auftrag: a.record_id });
                    setEditingPositionId(undefined);
                    setPositionenDialogOpen(true);
                  }}
                  pruefprotokolleList={pruefprotokolle}
                  onOpenPruefprotokolle={p => overlay.push({ type: 'pruefprotokoll', id: p.record_id })}
                  onAddPruefprotokolle={() => {
                    setPruefprotokolleDefaults({ auftrag_pruef: a.record_id });
                    setEditingPruefprotokollId(undefined);
                    setPruefprotokolleDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'position') {
            const p = getPositionById(top.id);
            if (!p) return null;
            return (
              <>
                <RecordHeader
                  title={p.fields.positions_bezeichnung ?? 'Position'}
                  subtitle={p.fields.positionstyp?.label}
                />
                <PositionenDetails
                  record={p}
                  auftraegeList={auftraege}
                  onOpenAuftraege={a => overlay.push({ type: 'auftrag', id: a.record_id })}
                  materialList={material}
                />
              </>
            );
          }
          if (top.type === 'pruefprotokoll') {
            const p = getPruefprotokollById(top.id);
            if (!p) return null;
            return (
              <>
                <RecordHeader
                  title={`Prüfprotokoll ${p.fields.pruefdatum ? formatDate(p.fields.pruefdatum) : ''}`}
                  subtitle={[p.fields.pruefer_vorname, p.fields.pruefer_nachname].filter(Boolean).join(' ')}
                />
                <PruefprotokolleDetails
                  record={p}
                  auftraegeList={auftraege}
                  onOpenAuftraege={a => overlay.push({ type: 'auftrag', id: a.record_id })}
                />
              </>
            );
          }
          if (top.type === 'kunde') {
            const k = getKundeById(top.id);
            if (!k) return null;
            return (
              <>
                <RecordHeader
                  title={[k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || 'Kunde'}
                  subtitle={k.fields.firma}
                />
                <KundenDetails
                  record={k}
                  auftraegeList={auftraege}
                  onOpenAuftraege={a => overlay.push({ type: 'auftrag', id: a.record_id })}
                  onAddAuftraege={() => {
                    setAuftraegeDefaults({ kunde: k.record_id });
                    setEditingAuftragId(undefined);
                    setAuftraegeDialogOpen(true);
                  }}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => top.type === 'auftrag' && nextStatusLabel ? {
          label: nextStatusLabel,
          onClick: () => {
            const a = enrichedAuftraege.find(a => a.record_id === top.id);
            if (a) void advanceStatus(a);
          },
        } : undefined}
        onEdit={top => {
          if (top.type === 'auftrag') {
            const a = getAuftragById(top.id);
            if (a) {
              setAuftraegeDefaults(a.fields as AuftraegeDialogDefaults);
              setEditingAuftragId(a.record_id);
              setAuftraegeDialogOpen(true);
            }
          }
        }}
      />

      {/* Dialoge */}
      <AuftraegeDialog
        open={auftraegeDialogOpen}
        onClose={() => setAuftraegeDialogOpen(false)}
        onSubmit={async fields => {
          if (editingAuftragId) {
            await LivingAppsService.updateAuftraegeEntry(editingAuftragId, fields);
          } else {
            await LivingAppsService.createAuftraegeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={auftraegeDefaults}
        recordId={editingAuftragId}
        kundenList={kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Auftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Auftraege']}
      />

      <PositionenDialog
        open={positionenDialogOpen}
        onClose={() => setPositionenDialogOpen(false)}
        onSubmit={async fields => {
          if (editingPositionId) {
            await LivingAppsService.updatePositionenEntry(editingPositionId, fields);
          } else {
            await LivingAppsService.createPositionenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={positionenDefaults}
        recordId={editingPositionId}
        auftraegeList={auftraege}
        materialList={material}
        enablePhotoScan={AI_PHOTO_SCAN['Positionen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Positionen']}
      />

      <PruefprotokolleDialog
        open={pruefprotokolleDialogOpen}
        onClose={() => setPruefprotokolleDialogOpen(false)}
        onSubmit={async fields => {
          if (editingPruefprotokollId) {
            await LivingAppsService.updatePruefprotokolleEntry(editingPruefprotokollId, fields);
          } else {
            await LivingAppsService.createPruefprotokolleEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={pruefprotokolleDefaults}
        recordId={editingPruefprotokollId}
        auftraegeList={auftraege}
        enablePhotoScan={AI_PHOTO_SCAN['Pruefprotokolle']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Pruefprotokolle']}
      />
    </>
  );
}
