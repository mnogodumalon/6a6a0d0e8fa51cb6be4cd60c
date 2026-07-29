import type { Positionen, Auftraege, Material } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface PositionenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Positionen | null;
  onEdit: (record: Positionen) => void;
  auftraegeList: Auftraege[];
  materialList: Material[];
}

export function PositionenViewDialog({ open, onClose, record, onEdit, auftraegeList, materialList }: PositionenViewDialogProps) {
  function getAuftraegeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return auftraegeList.find(r => r.record_id === id)?.fields.auftragsnummer ?? '—';
  }

  function getMaterialDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return materialList.find(r => r.record_id === id)?.fields.bezeichnung ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Positionen anzeigen</DialogTitle>
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
            <p className="text-sm">{getAuftraegeDisplayName(record.fields.auftrag)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Positionstyp</Label>
            <Badge variant="secondary">{record.fields.positionstyp?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
            <p className="text-sm">{record.fields.positions_bezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Material</Label>
            <p className="text-sm">{getMaterialDisplayName(record.fields.material)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Menge</Label>
            <p className="text-sm">{record.fields.menge ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Einheit</Label>
            <Badge variant="secondary">{record.fields.einheit_position?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Einzelpreis (€)</Label>
            <p className="text-sm">{record.fields.einzelpreis ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gesamtpreis (€)</Label>
            <p className="text-sm">{record.fields.gesamtpreis ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkungen_position ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.POSITIONEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}