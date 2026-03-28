# Gestione Bombole Gas

## Current State
App funzionante con backend Motoko e frontend React. Problema ricorrente: "errore nel caricamento bombole" causato da chiamate `.sort()` senza comparatore nel backend.

## Requested Changes (Diff)

### Add
- Import `Array "mo:core/Array"` nel backend

### Modify
- `registerUtilizzo`: sostituire `allUtilizzi.sort()` con `Array.sort(allUtilizzi, compareUtilizzo)`
- `getAllBombole`: sostituire `bombole.values().toArray().sort()` con `Array.sort(..., compareBombola)`
- Spostare `compare` da moduli interni a funzioni locali per compatibilità
- Rimuovere `addTestData` dal backend (non più necessario)

### Remove
- Funzione `addTestData` dal backend
- Moduli `Bombola` e `Utilizzo` con `.compare` sostituiti da funzioni locali

## Implementation Plan
- Backend già riscritto con fix
- Frontend: nessuna modifica necessaria, mantieni tutto com'è
