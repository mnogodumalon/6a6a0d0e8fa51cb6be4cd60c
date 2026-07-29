import type { Pruefprotokolle, Auftraege } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface PruefprotokolleViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Pruefprotokolle | null;
  onEdit: (record: Pruefprotokolle) => void;
  auftraegeList: Auftraege[];
}

export function PruefprotokolleViewDialog({ open, onClose, record, onEdit, auftraegeList }: PruefprotokolleViewDialogProps) {
  function getAuftraegeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return auftraegeList.find(r => r.record_id === id)?.fields.auftragsnummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prüfprotokolle anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftrag</Label>
            <p className="text-sm">{getAuftraegeDisplayName(record.fields.auftrag_pruef)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prüfdatum</Label>
            <p className="text-sm">{formatDate(record.fields.pruefdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prüfer Vorname</Label>
            <p className="text-sm">{record.fields.pruefer_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prüfer Nachname</Label>
            <p className="text-sm">{record.fields.pruefer_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prüfpunkte</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.pruefpunkte ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prüfergebnis</Label>
            <Badge variant="secondary">{record.fields.ergebnis?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mängelbeschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.maengelbeschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fotos / Dokumente</Label>
            {record.fields.fotos ? (
              <MediaThumbnail src={record.fields.fotos} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Freigabe erteilt</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.freigabe_erteilt ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.freigabe_erteilt ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkungen_pruef ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.PRUEFPROTOKOLLE} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}