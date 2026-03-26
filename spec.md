# Gestione Bombole Gas

## Current State
The app has a cylinder list view showing all cylinders with columns for code, gas type, level, assignment, and action buttons (Assegna/Reso). The list displays all cylinders without any filtering capability.

## Requested Changes (Diff)

### Add
- A single text input search bar above the cylinder list table.
- Real-time filtering logic that filters cylinders as the user types.

### Modify
- The cylinder list section: wrap the table with filter state, add the search input above it.
- The filter searches across: codice (cylinder code), tipoGas (gas type), and assegnazione (assigned technician name, including "Magazzino").

### Remove
- Nothing removed.

## Implementation Plan
1. Add a `searchQuery` state variable in the cylinder list section of App.tsx.
2. Add a text input field above the cylinder list table with placeholder "Cerca per codice, tipo gas o tecnico...".
3. Filter the displayed cylinders array using the search query (case-insensitive match against codice, tipoGas, assegnazione).
4. Ensure the search is reactive (filters on every keystroke).
