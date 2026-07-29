import type { Auftraege, Positionen, Pruefprotokolle } from './app';

export type EnrichedAuftraege = Auftraege & {
  kundeName: string;
};

export type EnrichedPositionen = Positionen & {
  auftragName: string;
  materialName: string;
};

export type EnrichedPruefprotokolle = Pruefprotokolle & {
  auftrag_pruefName: string;
};
