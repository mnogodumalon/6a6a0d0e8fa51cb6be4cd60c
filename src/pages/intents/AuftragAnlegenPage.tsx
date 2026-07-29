/**
 * Auftrag anlegen — 4-Schritt-Wizard.
 * Steps: 1) Kunde auswählen → 2) Auftragsdaten eingeben → 3) Positionen hinzufügen → 4) Zusammenfassung.
 * Reads: kunden, material. Writes: auftraege (createAuftraegeEntry), positionen (createPositionenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 * Deep-linking: ?kundeId=xxx springt zu Schritt 2; ?auftragId=xxx springt zu Schritt 3.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Kunden, Material } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import {
  IconUser,
  IconPlus,
  IconTrash,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClipboardList,
  IconCurrencyEuro,
  IconChevronLeft,
} from '@tabler/icons-react';

// ---- Types ----
interface PositionLocal {
  id: string; // local only (for list key)
  positionstyp: string;
  positions_bezeichnung: string;
  materialId: string | null;
  materialName: string;
  menge: number;
  einheit_position: string;
  einzelpreis: number;
  gesamtpreis: number;
}

// ---- Helpers ----
function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['auftraege']['prioritaet'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['auftraege']['status'] ?? [];
const POSITIONSTYP_OPTIONS = LOOKUP_OPTIONS['positionen']['positionstyp'] ?? [];
const EINHEIT_OPTIONS = LOOKUP_OPTIONS['positionen']['einheit_position'] ?? [];
const FIRST_STATUS = STATUS_OPTIONS[0]?.key ?? 'offen';

// ---- Main Component ----
export default function AuftragAnlegenPage() {
  const { kunden, material, loading, error, fetchAll } = useDashboardData();
  const [searchParams] = useSearchParams();

  // ---- Step state ----
  const [currentStep, setCurrentStep] = useState(1);

  // ---- Step 1: Kunde ----
  const [selectedKunde, setSelectedKunde] = useState<Kunden | null>(null);
  const [showKundeCreate, setShowKundeCreate] = useState(false);
  const [newVorname, setNewVorname] = useState('');
  const [newNachname, setNewNachname] = useState('');
  const [newTelefon, setNewTelefon] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [kundeCreateLoading, setKundeCreateLoading] = useState(false);
  const [kundeCreateError, setKundeCreateError] = useState<string | null>(null);

  // ---- Step 2: Auftragsdaten ----
  const [bezeichnung, setBezeichnung] = useState('');
  const [auftragsnummer, setAuftragsnummer] = useState('');
  const [auftragsdatum, setAuftragsdatum] = useState(todayStr());
  const [fertigstellungsdatum, setFertigstellungsdatum] = useState('');
  const [prioritaet, setPrioritaet] = useState(PRIORITAET_OPTIONS[1]?.key ?? PRIORITAET_OPTIONS[0]?.key ?? '');
  const [beschreibung, setBeschreibung] = useState('');
  const [auftragCreateLoading, setAuftragCreateLoading] = useState(false);
  const [auftragCreateError, setAuftragCreateError] = useState<string | null>(null);

  // ---- Step 3: Positionen ----
  const [createdAuftragId, setCreatedAuftragId] = useState<string | null>(null);
  const [positionen, setPositionen] = useState<PositionLocal[]>([]);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [positionstyp, setPositionstyp] = useState(POSITIONSTYP_OPTIONS[0]?.key ?? '');
  const [posBezeichnung, setPosBezeichnung] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [menge, setMenge] = useState<number>(1);
  const [einheit, setEinheit] = useState(EINHEIT_OPTIONS[0]?.key ?? '');
  const [einzelpreis, setEinzelpreis] = useState<number>(0);
  const [posCreateLoading, setPosCreateLoading] = useState(false);
  const [posCreateError, setPosCreateError] = useState<string | null>(null);

  // ---- Deep-linking: read URL params on mount ----
  useEffect(() => {
    const kundeId = searchParams.get('kundeId');
    const auftragId = searchParams.get('auftragId');
    const stepParam = parseInt(searchParams.get('step') ?? '', 10);

    if (auftragId) {
      setCreatedAuftragId(auftragId);
      setCurrentStep(3);
      return;
    }
    if (kundeId && !loading) {
      const found = kunden.find(k => k.record_id === kundeId);
      if (found) {
        setSelectedKunde(found);
        setCurrentStep(2);
        return;
      }
    }
    if (stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ---- Computed ----
  const gesamtpreis = useMemo(() => menge * einzelpreis, [menge, einzelpreis]);
  const totalPositionen = useMemo(
    () => positionen.reduce((sum, p) => sum + p.gesamtpreis, 0),
    [positionen]
  );

  const filteredMaterial = useMemo(() => {
    if (!materialSearch) return material;
    const q = materialSearch.toLowerCase();
    return material.filter(
      m =>
        (m.fields.bezeichnung ?? '').toLowerCase().includes(q) ||
        (m.fields.artikelnummer ?? '').toLowerCase().includes(q)
    );
  }, [material, materialSearch]);

  // ---- Handlers ----
  function handleSelectKunde(id: string) {
    const found = kunden.find(k => k.record_id === id) ?? null;
    setSelectedKunde(found);
    setCurrentStep(2);
  }

  async function handleCreateKunde() {
    if (!newVorname.trim() || !newNachname.trim()) {
      setKundeCreateError('Vor- und Nachname sind Pflichtfelder.');
      return;
    }
    setKundeCreateLoading(true);
    setKundeCreateError(null);
    try {
      const result = await LivingAppsService.createKundenEntry({
        vorname: newVorname.trim(),
        nachname: newNachname.trim(),
        telefon: newTelefon.trim() || undefined,
        email: newEmail.trim() || undefined,
      });
      await fetchAll();
      setNewVorname('');
      setNewNachname('');
      setNewTelefon('');
      setNewEmail('');
      setShowKundeCreate(false);
      // auto-select the newly created customer
      const newId = result.record_id;
      // We need to wait for fetchAll to finish, but we already have the id
      // Set selected from result fields
      const newKunde: Kunden = {
        record_id: newId,
        createdat: new Date().toISOString(),
        updatedat: null,
        fields: {
          vorname: newVorname.trim(),
          nachname: newNachname.trim(),
          telefon: newTelefon.trim() || undefined,
          email: newEmail.trim() || undefined,
        },
      };
      setSelectedKunde(newKunde);
      setCurrentStep(2);
    } catch (err) {
      setKundeCreateError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Kunden.');
    } finally {
      setKundeCreateLoading(false);
    }
  }

  async function handleCreateAuftrag() {
    if (!bezeichnung.trim()) {
      setAuftragCreateError('Bezeichnung ist ein Pflichtfeld.');
      return;
    }
    if (!auftragsnummer.trim()) {
      setAuftragCreateError('Auftragsnummer ist ein Pflichtfeld.');
      return;
    }
    if (!selectedKunde) {
      setAuftragCreateError('Kein Kunde ausgewählt.');
      return;
    }
    setAuftragCreateLoading(true);
    setAuftragCreateError(null);
    try {
      const result = await LivingAppsService.createAuftraegeEntry({
        bezeichnung: bezeichnung.trim(),
        auftragsnummer: auftragsnummer.trim(),
        kunde: createRecordUrl(APP_IDS.KUNDEN, selectedKunde.record_id),
        auftragsdatum: auftragsdatum,
        fertigstellungsdatum: fertigstellungsdatum || undefined,
        status: FIRST_STATUS,
        prioritaet: prioritaet || undefined,
        beschreibung: beschreibung.trim() || undefined,
      });
      setCreatedAuftragId(result.record_id);
      setCurrentStep(3);
    } catch (err) {
      setAuftragCreateError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Auftrags.');
    } finally {
      setAuftragCreateLoading(false);
    }
  }

  function handleSelectMaterial(mat: Material) {
    setSelectedMaterial(mat);
    setMaterialSearch(mat.fields.bezeichnung ?? '');
    setShowMaterialDropdown(false);
    if (mat.fields.verkaufspreis !== undefined) {
      setEinzelpreis(mat.fields.verkaufspreis);
    }
    // also set einheit from material if available
    if (mat.fields.einheit?.key) {
      const matchingEinheit = EINHEIT_OPTIONS.find(o => o.key === mat.fields.einheit?.key);
      if (matchingEinheit) setEinheit(matchingEinheit.key);
    }
  }

  function resetPositionForm() {
    setPositionstyp(POSITIONSTYP_OPTIONS[0]?.key ?? '');
    setPosBezeichnung('');
    setSelectedMaterial(null);
    setMaterialSearch('');
    setShowMaterialDropdown(false);
    setMenge(1);
    setEinheit(EINHEIT_OPTIONS[0]?.key ?? '');
    setEinzelpreis(0);
    setPosCreateError(null);
  }

  async function handleSavePosition() {
    if (!posBezeichnung.trim()) {
      setPosCreateError('Bezeichnung ist ein Pflichtfeld.');
      return;
    }
    if (!createdAuftragId) {
      setPosCreateError('Kein Auftrag vorhanden.');
      return;
    }
    setPosCreateLoading(true);
    setPosCreateError(null);
    try {
      await LivingAppsService.createPositionenEntry({
        auftrag: createRecordUrl(APP_IDS.AUFTRAEGE, createdAuftragId),
        positionstyp: positionstyp || undefined,
        positions_bezeichnung: posBezeichnung.trim(),
        material: selectedMaterial
          ? createRecordUrl(APP_IDS.MATERIAL, selectedMaterial.record_id)
          : undefined,
        menge: menge,
        einheit_position: einheit || undefined,
        einzelpreis: einzelpreis,
        gesamtpreis: gesamtpreis,
      });

      // Add to local list for display
      setPositionen(prev => [
        ...prev,
        {
          id: `pos-${Date.now()}`,
          positionstyp,
          positions_bezeichnung: posBezeichnung.trim(),
          materialId: selectedMaterial?.record_id ?? null,
          materialName: selectedMaterial?.fields.bezeichnung ?? '',
          menge,
          einheit_position: einheit,
          einzelpreis,
          gesamtpreis,
        },
      ]);

      resetPositionForm();
      setShowAddPosition(false);
    } catch (err) {
      setPosCreateError(err instanceof Error ? err.message : 'Fehler beim Speichern der Position.');
    } finally {
      setPosCreateLoading(false);
    }
  }

  function handleFinish() {
    window.location.hash = '/';
  }

  function handleReset() {
    setSelectedKunde(null);
    setBezeichnung('');
    setAuftragsnummer('');
    setAuftragsdatum(todayStr());
    setFertigstellungsdatum('');
    setPrioritaet(PRIORITAET_OPTIONS[1]?.key ?? PRIORITAET_OPTIONS[0]?.key ?? '');
    setBeschreibung('');
    setCreatedAuftragId(null);
    setPositionen([]);
    setShowAddPosition(false);
    resetPositionForm();
    setCurrentStep(1);
  }

  // ---- Render ----
  return (
    <IntentWizardShell
      title="Neuen Auftrag anlegen"
      subtitle="Schritt für Schritt zum vollständigen Auftrag"
      steps={[
        { label: 'Kunde' },
        { label: 'Auftragsdaten' },
        { label: 'Positionen' },
        { label: 'Abschluss' },
      ]}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ==============================
          STEP 1 — Kunde auswählen
      ============================== */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={kunden.map((k: Kunden) => ({
              id: k.record_id,
              title: `${k.fields.vorname ?? ''} ${k.fields.nachname ?? ''}`.trim() || '(kein Name)',
              subtitle: k.fields.firma ?? undefined,
              stats: k.fields.ort ? [{ label: 'Ort', value: k.fields.ort }] : undefined,
              icon: <IconUser size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectKunde}
            searchPlaceholder="Kunden suchen..."
            emptyText="Kein Kunde gefunden."
            createLabel="Neuen Kunden anlegen"
            onCreateNew={() => { setShowKundeCreate(v => !v); }}
            createDialog={
              showKundeCreate ? (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm text-foreground">Neuen Kunden anlegen</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Vorname *</label>
                      <Input
                        value={newVorname}
                        onChange={e => setNewVorname(e.target.value)}
                        placeholder="Max"
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Nachname *</label>
                      <Input
                        value={newNachname}
                        onChange={e => setNewNachname(e.target.value)}
                        placeholder="Mustermann"
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Telefon</label>
                      <Input
                        value={newTelefon}
                        onChange={e => setNewTelefon(e.target.value)}
                        placeholder="+49 123 456789"
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">E-Mail</label>
                      <Input
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="max@beispiel.de"
                        className="w-full"
                      />
                    </div>
                  </div>
                  {kundeCreateError && (
                    <p className="text-xs text-destructive">{kundeCreateError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateKunde}
                      disabled={kundeCreateLoading}
                      className="gap-1.5"
                    >
                      <IconPlus size={15} />
                      {kundeCreateLoading ? 'Wird angelegt...' : 'Kunden anlegen & auswählen'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowKundeCreate(false); setKundeCreateError(null); }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />
        </div>
      )}

      {/* ==============================
          STEP 2 — Auftragsdaten
      ============================== */}
      {currentStep === 2 && (
        <div className="space-y-5">
          {/* Kontext: gewählter Kunde */}
          {selectedKunde && (
            <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconUser size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Ausgewählter Kunde</p>
                <p className="font-medium text-sm truncate">
                  {`${selectedKunde.fields.vorname ?? ''} ${selectedKunde.fields.nachname ?? ''}`.trim()}
                  {selectedKunde.fields.firma ? ` — ${selectedKunde.fields.firma}` : ''}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card p-5 space-y-5">
            <h2 className="font-semibold text-base">Auftragsinformationen</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bezeichnung *</label>
                <Input
                  value={bezeichnung}
                  onChange={e => setBezeichnung(e.target.value)}
                  placeholder="z. B. Heizungsanlage Erneuerung"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Auftragsnummer *</label>
                <Input
                  value={auftragsnummer}
                  onChange={e => setAuftragsnummer(e.target.value)}
                  placeholder="z. B. A-2026-001"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Auftragsdatum</label>
                <Input
                  type="date"
                  value={auftragsdatum}
                  onChange={e => setAuftragsdatum(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fertigstellungsdatum</label>
                <Input
                  type="date"
                  value={fertigstellungsdatum}
                  onChange={e => setFertigstellungsdatum(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Priorität als Kacheln */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Priorität</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITAET_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPrioritaet(opt.key)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors text-center ${
                      prioritaet === opt.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Beschreibung (optional)</label>
              <textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder="Kurze Beschreibung des Auftrags..."
                rows={3}
                className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {auftragCreateError && (
              <p className="text-xs text-destructive">{auftragCreateError}</p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="gap-1.5"
            >
              <IconArrowLeft size={15} />
              Zurück
            </Button>
            <Button
              onClick={handleCreateAuftrag}
              disabled={auftragCreateLoading}
              className="gap-1.5"
            >
              {auftragCreateLoading ? 'Wird angelegt...' : 'Auftrag anlegen & weiter'}
              {!auftragCreateLoading && <IconArrowRight size={15} />}
            </Button>
          </div>
        </div>
      )}

      {/* ==============================
          STEP 3 — Positionen
      ============================== */}
      {currentStep === 3 && (
        <div className="space-y-4">
          {/* Gesamtbetrag-Card */}
          <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-4 overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCurrencyEuro size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Gesamtbetrag (netto)</p>
                <p className="font-bold text-xl truncate">{formatCurrency(totalPositionen)}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Positionen</p>
              <p className="font-semibold text-lg">{positionen.length}</p>
            </div>
          </div>

          {/* Positionsliste */}
          {positionen.length > 0 && (
            <div className="space-y-2">
              {positionen.map((pos, idx) => {
                const typLabel = POSITIONSTYP_OPTIONS.find(o => o.key === pos.positionstyp)?.label ?? pos.positionstyp;
                const einheitLabel = EINHEIT_OPTIONS.find(o => o.key === pos.einheit_position)?.label ?? pos.einheit_position;
                return (
                  <div key={pos.id} className="rounded-xl border bg-card p-4 flex items-start gap-3 overflow-hidden">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{pos.positions_bezeichnung}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{typLabel}</span>
                      </div>
                      {pos.materialName && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">Material: {pos.materialName}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>Menge: <span className="font-medium text-foreground">{pos.menge} {einheitLabel}</span></span>
                        <span>Einzelpreis: <span className="font-medium text-foreground">{formatCurrency(pos.einzelpreis)}</span></span>
                        <span>Gesamt: <span className="font-semibold text-foreground">{formatCurrency(pos.gesamtpreis)}</span></span>
                      </div>
                    </div>
                    <button
                      onClick={() => setPositionen(prev => prev.filter(p => p.id !== pos.id))}
                      className="shrink-0 w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      aria-label="Position entfernen"
                    >
                      <IconTrash size={15} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Position hinzufügen Button */}
          {!showAddPosition && (
            <button
              onClick={() => setShowAddPosition(true)}
              className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent transition-colors p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <IconPlus size={16} />
              Position hinzufügen
            </button>
          )}

          {/* Inline-Form: Position anlegen */}
          {showAddPosition && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm text-foreground">Neue Position</h3>

              {/* Positionstyp als Kacheln */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Positionstyp</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {POSITIONSTYP_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPositionstyp(opt.key)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors text-center ${
                        positionstyp === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bezeichnung */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bezeichnung *</label>
                <Input
                  value={posBezeichnung}
                  onChange={e => setPosBezeichnung(e.target.value)}
                  placeholder="z. B. Rohrleitungen verlegen"
                  className="w-full"
                />
              </div>

              {/* Material-Auswahl */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-medium text-muted-foreground">Material (optional)</label>
                <Input
                  value={materialSearch}
                  onChange={e => {
                    setMaterialSearch(e.target.value);
                    setShowMaterialDropdown(true);
                    if (!e.target.value) setSelectedMaterial(null);
                  }}
                  onFocus={() => setShowMaterialDropdown(true)}
                  placeholder="Material suchen..."
                  className="w-full"
                />
                {showMaterialDropdown && materialSearch && filteredMaterial.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border bg-card shadow-lg max-h-48 overflow-y-auto">
                    {filteredMaterial.slice(0, 8).map(m => (
                      <button
                        key={m.record_id}
                        type="button"
                        onClick={() => handleSelectMaterial(m)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="truncate min-w-0 font-medium">{m.fields.bezeichnung}</span>
                        {m.fields.verkaufspreis !== undefined && (
                          <span className="shrink-0 text-xs text-muted-foreground">{formatCurrency(m.fields.verkaufspreis)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {showMaterialDropdown && materialSearch && filteredMaterial.length === 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border bg-card shadow-lg p-4 text-sm text-muted-foreground text-center">
                    Kein Material gefunden.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Menge */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Menge</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={menge}
                    onChange={e => setMenge(parseFloat(e.target.value) || 0)}
                    className="w-full"
                  />
                </div>

                {/* Einheit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Einheit</label>
                  <select
                    value={einheit}
                    onChange={e => setEinheit(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {EINHEIT_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Einzelpreis */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Einzelpreis (€)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={einzelpreis}
                    onChange={e => setEinzelpreis(parseFloat(e.target.value) || 0)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Gesamtpreis (live) */}
              <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Gesamtpreis</span>
                <span className="font-bold text-lg">{formatCurrency(gesamtpreis)}</span>
              </div>

              {posCreateError && (
                <p className="text-xs text-destructive">{posCreateError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSavePosition}
                  disabled={posCreateLoading}
                  className="gap-1.5"
                >
                  <IconCheck size={15} />
                  {posCreateLoading ? 'Wird gespeichert...' : 'Position speichern'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowAddPosition(false); resetPositionForm(); }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="gap-1.5"
            >
              <IconArrowLeft size={15} />
              Zurück
            </Button>
            <div className="flex items-center gap-3">
              {positionen.length === 0 && (
                <button
                  onClick={() => setCurrentStep(4)}
                  className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Weiter ohne Positionen
                </button>
              )}
              {positionen.length > 0 && (
                <Button
                  onClick={() => setCurrentStep(4)}
                  className="gap-1.5"
                >
                  Weiter zur Zusammenfassung
                  <IconArrowRight size={15} />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          STEP 4 — Zusammenfassung
      ============================== */}
      {currentStep === 4 && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <IconClipboardList size={18} className="text-primary" />
                <h2 className="font-semibold text-base">Auftragsübersicht</h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Kunde</p>
                  <p className="font-medium text-sm">
                    {selectedKunde
                      ? `${selectedKunde.fields.vorname ?? ''} ${selectedKunde.fields.nachname ?? ''}`.trim()
                      : '—'}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Auftragsnummer</p>
                  <p className="font-medium text-sm">{auftragsnummer || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Bezeichnung</p>
                  <p className="font-medium text-sm">{bezeichnung || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Auftragsdatum</p>
                  <p className="font-medium text-sm">{auftragsdatum || '—'}</p>
                </div>
                {fertigstellungsdatum && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Fertigstellungsdatum</p>
                    <p className="font-medium text-sm">{fertigstellungsdatum}</p>
                  </div>
                )}
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Priorität</p>
                  <p className="font-medium text-sm">
                    {PRIORITAET_OPTIONS.find(o => o.key === prioritaet)?.label ?? '—'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Positionen</p>
                    <p className="font-medium text-sm">{positionen.length} Position{positionen.length !== 1 ? 'en' : ''}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-xs text-muted-foreground">Gesamtbetrag (netto)</p>
                    <p className="font-bold text-xl text-primary">{formatCurrency(totalPositionen)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Aktionen */}
          <div className="space-y-3">
            <Button
              onClick={handleFinish}
              size="lg"
              className="w-full gap-2"
            >
              <IconCheck size={18} />
              Auftrag abschliessen
            </Button>

            <Button
              variant="outline"
              onClick={() => setCurrentStep(3)}
              className="w-full gap-1.5"
            >
              <IconPlus size={15} />
              Weitere Position hinzufügen
            </Button>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconChevronLeft size={14} />
                Zurück zu Positionen
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Neuen Auftrag anlegen
                </button>
                <a href="#/" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                  Zum Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
