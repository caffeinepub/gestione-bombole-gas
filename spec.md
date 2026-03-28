# Gestione Bombole Gas

## Current State
App completa per gestione bombole gas con:
- Lista bombole con ricerca, filtri, assegnazione tecnici
- Dashboard KPI
- Dettaglio bombola con storico utilizzi
- Scanner QR/barcode
- Report CSV e per singola bombola
- Cancellazione bombole vuote
- Persistent storage (stable memory)

## Requested Changes (Diff)

### Add
- Backend: funzione `importaBombole(dati: [Bombola]) : async ()` che cancella tutte le bombole esistenti e reimporta quelle passate
- Frontend: sezione "Backup & Ripristino" nella vista lista, nascosta dietro un bottone discreto (icona archivio/database) per evitare attivazione involontaria
- Export JSON: scarica tutte le bombole con tutti i campi (inclusi utilizzi e assegnazione) come file `.json`
- Import JSON: carica un file `.json` precedentemente esportato e chiama `importaBombole` per ripristinare i dati; richiede conferma prima di procedere

### Modify
- Nessuna modifica a funzioni esistenti

### Remove
- Nessuna rimozione

## Implementation Plan
1. Aggiungere `importaBombole` al backend Motoko
2. Aggiornare `backend.d.ts` con la nuova firma
3. Nel frontend, aggiungere un bottone discreto (piccola icona `Database` o `Archive`) vicino ai controlli esistenti ma visivamente meno prominente
4. Il click sull'icona apre/chiude un pannello collassabile "Backup & Ripristino"
5. Nel pannello: pulsante "Esporta JSON" e pulsante "Importa JSON" (con file input nascosto)
6. L'importazione mostra un AlertDialog di conferma prima di sovrascrivere i dati
