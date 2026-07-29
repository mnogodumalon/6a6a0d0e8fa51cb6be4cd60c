/**
 * Prüfprotokoll erstellen — 4-Schritt-Wizard.
 * Steps: 1) Auftrag auswählen → 2) Positionen prüfen → 3) Protokoll ausfüllen → 4) Abschluss.
 * Reads: auftraege, positionen, kunden (via kundenMap). Writes: pruefprotokolle (createPruefprotokolleEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { EnrichedAuftraege, EnrichedPositionen } from '@/types/enriched';
import { enrichAuftraege, enrichPositionen } from '@/lib/enrich';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import {
  IconClipboardCheck,
  IconCheck,
  IconAlertTriangle,
  IconShieldCheck,
  IconShieldX,
  IconRefresh,
  IconArrowLeft,
  IconArrowRight,
  IconBox,
  IconFileText,
} from '@tabler/icons-react';

const ERGEBNIS_OPTIONS = LOOKUP_OPTIONS['pruefprotokolle']['ergebnis'] ?? [];
const PASSING_KEY = 'bestanden';

function isPassingErgebnis(key: string): boolean {
  return key === PASSING_KEY;
}

function formatCurrency(value: number | undefined): string {
  if (value == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PruefprotokollErstellenPage() {
  const { auftraege, positionen, loading, error, fetchAll, kundenMap, auftraegeMap, materialMap } = useDashboardData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- Step state ---
  const initialStep = (() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    if (urlStep >= 1 && urlStep <= 4) return urlStep;
    return 1;
  })();
  const [step, setStep] = useState(initialStep);

  // --- Step 1: selected Auftrag ---
  const [selectedAuftrag, setSelectedAuftrag] = useState<EnrichedAuftraege | null>(null);

  // Deep-link: if ?auftragId is in URL, pre-select and skip to step 2
  useEffect(() => {
    const auftragId = searchParams.get('auftragId');
    if (!auftragId || loading) return;
    if (selectedAuftrag) return; // already set
    const found = auftraege.find(a => a.record_id === auftragId);
    if (found) {
      const enriched = enrichAuftraege([found], { kundenMap });
      setSelectedAuftrag(enriched[0]);
      setStep(2);
    }
  }, [loading, auftraege, kundenMap, searchParams, selectedAuftrag]);

  // --- Step 2: positions check ---
  const [checkedPositionen, setCheckedPositionen] = useState<Set<string>>(new Set());
  const [pruefpunkteNotes, setPruefpunkteNotes] = useState('');

  // --- Step 3: form fields ---
  const [prueferVorname, setPrueferVorname] = useState('');
  const [prueferNachname, setPrueferNachname] = useState('');
  const [pruefdatum, setPruefdatum] = useState(todayIso());
  const [ergebnis, setErgebnis] = useState('');
  const [maengelbeschreibung, setMaengelbeschreibung] = useState('');
  const [freigabeErteilt, setFreigabeErteilt] = useState(false);
  const [bemerkungenPruef, setBemerkungenPruef] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Step 4: created protocol ---
  const [createdProtokollId, setCreatedProtokollId] = useState<string | null>(null);
  const [createdProtokollData, setCreatedProtokollData] = useState<{
    pruefdatum: string;
    prueferVorname: string;
    prueferNachname: string;
    ergebnis: string;
    ergebnisLabel: string;
    freigabeErteilt: boolean;
  } | null>(null);

  // Derived: enriched Auftraege list
  const enrichedAuftraege = useMemo(
    () => enrichAuftraege(auftraege, { kundenMap }),
    [auftraege, kundenMap]
  );

  // Derived: positions for selected Auftrag
  const auftragsPositionen: EnrichedPositionen[] = useMemo(() => {
    if (!selectedAuftrag) return [];
    const filtered = positionen.filter(
      p => extractRecordId(p.fields.auftrag) === selectedAuftrag.record_id
    );
    return enrichPositionen(filtered, { auftraegeMap, materialMap });
  }, [positionen, selectedAuftrag, auftraegeMap, materialMap]);

  // Auto-reset freigabe when ergebnis changes to non-passing
  useEffect(() => {
    if (ergebnis && !isPassingErgebnis(ergebnis)) {
      setFreigabeErteilt(false);
    }
  }, [ergebnis]);

  // --- Handlers ---
  function handleSelectAuftrag(id: string) {
    const found = enrichedAuftraege.find(a => a.record_id === id);
    if (found) {
      setSelectedAuftrag(found);
      setCheckedPositionen(new Set());
      setPruefpunkteNotes('');
      setStep(2);
    }
  }

  function togglePosition(id: string) {
    setCheckedPositionen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCheckAll() {
    setCheckedPositionen(new Set(auftragsPositionen.map(p => p.record_id)));
  }

  function handleStep2Weiter() {
    setStep(3);
  }

  async function handleCreateProtokoll() {
    if (!selectedAuftrag) return;
    if (!prueferVorname.trim() || !prueferNachname.trim()) {
      setSaveError('Bitte Vor- und Nachname des Prüfers eingeben.');
      return;
    }
    if (!ergebnis) {
      setSaveError('Bitte ein Ergebnis auswählen.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await LivingAppsService.createPruefprotokolleEntry({
        auftrag_pruef: createRecordUrl(APP_IDS.AUFTRAEGE, selectedAuftrag.record_id),
        pruefdatum: pruefdatum,
        pruefer_vorname: prueferVorname.trim(),
        pruefer_nachname: prueferNachname.trim(),
        pruefpunkte: pruefpunkteNotes.trim() || undefined,
        ergebnis: ergebnis,
        maengelbeschreibung: maengelbeschreibung.trim() || undefined,
        freigabe_erteilt: freigabeErteilt,
        bemerkungen_pruef: bemerkungenPruef.trim() || undefined,
      });

      const ergebnisOption = ERGEBNIS_OPTIONS.find(o => o.key === ergebnis);
      setCreatedProtokollId(result.record_id);
      setCreatedProtokollData({
        pruefdatum,
        prueferVorname: prueferVorname.trim(),
        prueferNachname: prueferNachname.trim(),
        ergebnis,
        ergebnisLabel: ergebnisOption?.label ?? ergebnis,
        freigabeErteilt,
      });
      await fetchAll();
      setStep(4);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Protokolls.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedAuftrag(null);
    setCheckedPositionen(new Set());
    setPruefpunkteNotes('');
    setPrueferVorname('');
    setPrueferNachname('');
    setPruefdatum(todayIso());
    setErgebnis('');
    setMaengelbeschreibung('');
    setFreigabeErteilt(false);
    setBemerkungenPruef('');
    setSaveError(null);
    setCreatedProtokollId(null);
    setCreatedProtokollData(null);
    setStep(1);
  }

  const step2CanProceed = checkedPositionen.size > 0 || auftragsPositionen.length === 0;

  return (
    <IntentWizardShell
      title="Prüfprotokoll erstellen"
      subtitle="Qualitätsprüfung für einen abgeschlossenen Auftrag dokumentieren"
      steps={[
        { label: 'Auftrag' },
        { label: 'Positionen' },
        { label: 'Protokoll' },
        { label: 'Abschluss' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Auftrag auswählen ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wähle den Auftrag aus, für den du ein Prüfprotokoll erstellen möchtest.
          </p>
          <EntitySelectStep
            items={enrichedAuftraege.map(a => ({
              id: a.record_id,
              title: `${a.fields.auftragsnummer ?? '–'} – ${a.fields.bezeichnung ?? '–'}`,
              subtitle: a.kundeName ? `Kunde: ${a.kundeName}` : undefined,
              status: a.fields.status
                ? { key: a.fields.status.key, label: a.fields.status.label }
                : undefined,
              stats: a.fields.fertigstellungsdatum
                ? [{ label: 'Fertigstellung', value: a.fields.fertigstellungsdatum }]
                : [],
              icon: <IconClipboardCheck size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectAuftrag}
            searchPlaceholder="Auftrag suchen..."
            emptyIcon={<IconClipboardCheck size={32} />}
            emptyText="Keine Aufträge gefunden."
          />
        </div>
      )}

      {/* ── STEP 2: Positionen prüfen ── */}
      {step === 2 && selectedAuftrag && (
        <div className="space-y-4">
          {/* Auftrag-Kontext */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconClipboardCheck size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedAuftrag.fields.auftragsnummer} – {selectedAuftrag.fields.bezeichnung}
              </p>
              {selectedAuftrag.kundeName && (
                <p className="text-xs text-muted-foreground">{selectedAuftrag.kundeName}</p>
              )}
            </div>
            {selectedAuftrag.fields.status && (
              <StatusBadge
                statusKey={selectedAuftrag.fields.status.key}
                label={selectedAuftrag.fields.status.label}
              />
            )}
          </div>

          {/* Fortschritt */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {checkedPositionen.size} von {auftragsPositionen.length} Positionen geprüft
            </p>
            {auftragsPositionen.length > 0 && checkedPositionen.size < auftragsPositionen.length && (
              <Button variant="outline" size="sm" onClick={handleCheckAll}>
                Alle abhaken
              </Button>
            )}
          </div>

          {/* Fortschrittsbalken */}
          {auftragsPositionen.length > 0 && (
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(checkedPositionen.size / auftragsPositionen.length) * 100}%`,
                }}
              />
            </div>
          )}

          {/* Positions-Karten */}
          {auftragsPositionen.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="mb-3 flex justify-center opacity-40">
                <IconBox size={32} />
              </div>
              <p className="text-sm">Keine Positionen für diesen Auftrag vorhanden.</p>
              <p className="text-xs mt-1">Du kannst trotzdem ein Protokoll erstellen.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auftragsPositionen.map(pos => {
                const checked = checkedPositionen.has(pos.record_id);
                return (
                  <button
                    key={pos.record_id}
                    onClick={() => togglePosition(pos.record_id)}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-colors overflow-hidden ${
                      checked
                        ? 'bg-primary/5 border-primary/40'
                        : 'bg-card border-border hover:bg-accent'
                    }`}
                  >
                    {/* Checkbox visual */}
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                    >
                      {checked && <IconCheck size={14} className="text-primary-foreground" stroke={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {pos.fields.positions_bezeichnung ?? '–'}
                        </span>
                        {pos.fields.positionstyp && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {pos.fields.positionstyp.label}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {pos.fields.menge != null && (
                          <span>
                            Menge:{' '}
                            <span className="font-medium text-foreground">{pos.fields.menge}</span>
                          </span>
                        )}
                        {pos.fields.einzelpreis != null && (
                          <span>
                            Einzelpreis:{' '}
                            <span className="font-medium text-foreground">
                              {formatCurrency(pos.fields.einzelpreis)}
                            </span>
                          </span>
                        )}
                        {pos.fields.gesamtpreis != null && (
                          <span>
                            Gesamt:{' '}
                            <span className="font-medium text-foreground">
                              {formatCurrency(pos.fields.gesamtpreis)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pruefpunkte Notizen */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prüfpunkte notieren (optional)</label>
            <Textarea
              value={pruefpunkteNotes}
              onChange={e => setPruefpunkteNotes(e.target.value)}
              placeholder="Allgemeine Hinweise, geprüfte Kriterien, Beobachtungen..."
              rows={3}
              className="w-full resize-none"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            {!step2CanProceed && (
              <Button
                variant="ghost"
                onClick={handleStep2Weiter}
                className="text-muted-foreground"
              >
                Alle überspringen
              </Button>
            )}
            <Button
              onClick={handleStep2Weiter}
              disabled={!step2CanProceed}
              className="gap-1.5 ml-auto"
            >
              Weiter
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Protokoll ausfüllen ── */}
      {step === 3 && selectedAuftrag && (
        <div className="space-y-5">
          {/* Auftrag-Kontext */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary border overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconFileText size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedAuftrag.fields.auftragsnummer} – {selectedAuftrag.fields.bezeichnung}
              </p>
              {selectedAuftrag.kundeName && (
                <p className="text-xs text-muted-foreground truncate">{selectedAuftrag.kundeName}</p>
              )}
            </div>
          </div>

          {/* Prüfer-Daten */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Prüfer</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Vorname <span className="text-destructive">*</span>
                </label>
                <Input
                  value={prueferVorname}
                  onChange={e => setPrueferVorname(e.target.value)}
                  placeholder="Vorname"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Nachname <span className="text-destructive">*</span>
                </label>
                <Input
                  value={prueferNachname}
                  onChange={e => setPrueferNachname(e.target.value)}
                  placeholder="Nachname"
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Prüfdatum <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={pruefdatum}
                onChange={e => setPruefdatum(e.target.value)}
                className="w-full max-w-xs"
              />
            </div>
          </div>

          {/* Ergebnis */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              Ergebnis <span className="text-destructive">*</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ERGEBNIS_OPTIONS.map(option => {
                const isSelected = ergebnis === option.key;
                const isPassing = isPassingErgebnis(option.key);
                return (
                  <button
                    key={option.key}
                    onClick={() => setErgebnis(option.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors w-full ${
                      isSelected
                        ? isPassing
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-400 bg-red-50'
                        : 'border-border bg-card hover:bg-accent'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? isPassing
                            ? 'bg-green-100'
                            : 'bg-red-100'
                          : 'bg-muted'
                      }`}
                    >
                      {isPassing ? (
                        <IconShieldCheck
                          size={18}
                          className={isSelected ? 'text-green-600' : 'text-muted-foreground'}
                        />
                      ) : (
                        <IconShieldX
                          size={18}
                          className={isSelected ? 'text-red-500' : 'text-muted-foreground'}
                        />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium leading-tight ${
                        isSelected
                          ? isPassing
                            ? 'text-green-700'
                            : 'text-red-600'
                          : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mängelbeschreibung — nur wenn nicht bestanden */}
          {ergebnis && !isPassingErgebnis(ergebnis) && (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconAlertTriangle size={16} className="text-amber-600 shrink-0" />
                <label className="text-sm font-medium text-amber-800">Mängelbeschreibung</label>
              </div>
              <Textarea
                value={maengelbeschreibung}
                onChange={e => setMaengelbeschreibung(e.target.value)}
                placeholder="Beschreibe die festgestellten Mängel..."
                rows={3}
                className="w-full resize-none bg-white"
              />
            </div>
          )}

          {/* Freigabe */}
          <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
            <button
              onClick={() => {
                if (ergebnis && isPassingErgebnis(ergebnis)) {
                  setFreigabeErteilt(prev => !prev);
                }
              }}
              disabled={!ergebnis || !isPassingErgebnis(ergebnis)}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 relative ${
                freigabeErteilt
                  ? 'bg-green-500'
                  : ergebnis && isPassingErgebnis(ergebnis)
                  ? 'bg-muted-foreground/30'
                  : 'bg-muted cursor-not-allowed opacity-50'
              }`}
              aria-label="Freigabe erteilen"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  freigabeErteilt ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium">Freigabe erteilen</p>
              <p className="text-xs text-muted-foreground">
                {!ergebnis || !isPassingErgebnis(ergebnis)
                  ? 'Nur möglich wenn Ergebnis "Bestanden"'
                  : 'Auftrag freigegeben'}
              </p>
            </div>
          </div>

          {/* Bemerkungen */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bemerkungen (optional)</label>
            <Textarea
              value={bemerkungenPruef}
              onChange={e => setBemerkungenPruef(e.target.value)}
              placeholder="Weitere Anmerkungen zum Prüfprotokoll..."
              rows={2}
              className="w-full resize-none"
            />
          </div>

          {/* Fehler */}
          {saveError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <IconAlertTriangle size={16} className="shrink-0" />
              {saveError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={handleCreateProtokoll}
              disabled={saving || !prueferVorname.trim() || !prueferNachname.trim() || !ergebnis}
              className="gap-1.5 ml-auto"
            >
              {saving ? (
                <>
                  <IconRefresh size={16} className="animate-spin" />
                  Erstelle Protokoll...
                </>
              ) : (
                <>
                  <IconClipboardCheck size={16} />
                  Protokoll erstellen
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Abschluss ── */}
      {step === 4 && selectedAuftrag && createdProtokollData && (
        <div className="space-y-5">
          {/* Banner */}
          {createdProtokollData.freigabeErteilt ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <IconShieldCheck size={22} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Freigabe erteilt</p>
                <p className="text-sm text-green-700">
                  Das Prüfprotokoll wurde erstellt und der Auftrag freigegeben.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <IconAlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">Mängel dokumentiert — keine Freigabe</p>
                <p className="text-sm text-amber-700">
                  Das Protokoll wurde gespeichert. Eine Freigabe wurde nicht erteilt.
                </p>
              </div>
            </div>
          )}

          {/* Zusammenfassung */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-secondary">
              <p className="text-sm font-semibold">Protokoll-Zusammenfassung</p>
            </div>
            <div className="divide-y">
              <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Auftrag</span>
                <span className="text-sm font-medium text-right">
                  {selectedAuftrag.fields.auftragsnummer} – {selectedAuftrag.fields.bezeichnung}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Prüfdatum</span>
                <span className="text-sm font-medium">{createdProtokollData.pruefdatum}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Prüfer</span>
                <span className="text-sm font-medium">
                  {createdProtokollData.prueferVorname} {createdProtokollData.prueferNachname}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Ergebnis</span>
                <StatusBadge
                  statusKey={createdProtokollData.ergebnis}
                  label={createdProtokollData.ergebnisLabel}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Freigabe</span>
                <div className="flex items-center gap-1.5">
                  {createdProtokollData.freigabeErteilt ? (
                    <>
                      <IconShieldCheck size={16} className="text-green-600" />
                      <span className="text-sm font-medium text-green-700">Ja</span>
                    </>
                  ) : (
                    <>
                      <IconShieldX size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Nein</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Aktionen */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {createdProtokollId && (
              <Button
                onClick={() => navigate(`/pruefprotokolle/${createdProtokollId}`)}
                className="gap-1.5"
              >
                <IconFileText size={16} />
                Zum Protokoll
              </Button>
            )}
            <Button variant="outline" onClick={handleReset} className="gap-1.5">
              <IconRefresh size={16} />
              Neues Protokoll erstellen
            </Button>
            <a href="#/" className="inline-flex">
              <Button variant="ghost" className="gap-1.5 w-full">
                <IconArrowLeft size={16} />
                Zurück zum Dashboard
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
