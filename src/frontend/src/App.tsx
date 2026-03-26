import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQRScanner } from "@/qr-code/useQRScanner";
import {
  ArrowLeft,
  Cylinder,
  Download,
  FlaskConical,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useActor } from "./hooks/useActor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Utilizzo {
  apparecchiatura: string;
  data: bigint;
  luogo: string;
  tecnico: string;
  kgUsati: number;
}

interface Bombola {
  gasResiduoKg: number;
  utilizzi: Array<Utilizzo>;
  taraKg: number;
  assegnazione: string;
  tipoGas: string;
  codice: string;
  gasTotaleKg: number;
  produttore: string;
}

type View =
  | { type: "lista" }
  | { type: "dettaglio"; codice: string }
  | { type: "utilizzo"; codice: string }
  | { type: "nuova" };

type Stato = "Piena" | "In Uso" | "Sotto Livello" | "Vuota";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVuota(b: Bombola): boolean {
  return b.gasResiduoKg <= 0.3;
}

function getStato(b: Bombola): Stato {
  if (b.gasResiduoKg === 0) return "Vuota";
  if (b.gasResiduoKg === b.gasTotaleKg) return "Piena";
  if (b.gasTotaleKg > 0 && b.gasResiduoKg / b.gasTotaleKg < 0.2)
    return "Sotto Livello";
  return "In Uso";
}

function getPercent(b: Bombola): number {
  if (b.gasTotaleKg === 0) return 0;
  return Math.round((b.gasResiduoKg / b.gasTotaleKg) * 100);
}

function formatNanos(ns: bigint): string {
  const ms = Number(ns / BigInt(1_000_000));
  const d = new Date(ms);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadReport(b: Bombola): void {
  let report = "=== REPORT BOMBOLA ===\n";
  report += `Codice: ${b.codice}\n`;
  report += `Produttore: ${b.produttore}\n`;
  report += `Tipo Gas: ${b.tipoGas}\n`;
  report += `Tara (kg): ${b.taraKg.toFixed(2)}\n`;
  report += `Gas iniziale (kg): ${b.gasTotaleKg.toFixed(2)}\n`;
  report += `Gas residuo (kg): ${b.gasResiduoKg.toFixed(2)}\n`;
  report += "\n--- UTILIZZI ---\n";
  for (const u of b.utilizzi) {
    report += `\nData: ${formatNanos(u.data)}\n`;
    report += `Tecnico: ${u.tecnico}\n`;
    report += `Luogo: ${u.luogo}\n`;
    report += `Apparecchiatura: ${u.apparecchiatura}\n`;
    report += `Kg usati: ${u.kgUsati.toFixed(2)}\n`;
    report += "----------------------\n";
  }
  const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${b.codice}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatoBadge({ stato }: { stato: Stato }) {
  const cls =
    stato === "In Uso" || stato === "Piena"
      ? "bg-teal/20 text-teal border-teal/30"
      : stato === "Sotto Livello"
        ? "bg-amber/20 text-amber border-amber/30"
        : "bg-danger/20 text-danger border-danger/30";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {stato}
    </span>
  );
}

// ─── Assegnazione Badge ────────────────────────────────────────────────────────

function AssegnazioneBadge({ assegnazione }: { assegnazione: string }) {
  const isMagazzino = !assegnazione || assegnazione === "Magazzino";
  return (
    <span
      className={
        isMagazzino
          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/50 text-muted-foreground border-border"
          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-teal/10 text-teal border-teal/30"
      }
    >
      {!isMagazzino && <UserCheck className="h-3 w-3" />}
      {isMagazzino ? "Magazzino" : assegnazione}
    </span>
  );
}

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────

function QRScannerModal({
  onResult,
  onClose,
}: {
  onResult: (val: string) => void;
  onClose: () => void;
}) {
  const {
    qrResults,
    isScanning,
    isLoading,
    canStartScanning,
    error,
    startScanning,
    stopScanning,
    videoRef,
    canvasRef,
  } = useQRScanner({ facingMode: "environment", scanInterval: 150 });

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, [startScanning, stopScanning]);

  useEffect(() => {
    if (qrResults.length > 0) {
      onResult(qrResults[0].data);
    }
  }, [qrResults, onResult]);

  const isPermissionError = error?.type === "permission";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      data-ocid="qr_scanner.modal"
    >
      <div className="relative w-full max-w-sm mx-4 rounded-xl overflow-hidden border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-semibold text-foreground">
            Scansiona QR Code
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-ocid="qr_scanner.close_button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative bg-black aspect-square">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-teal rounded-lg opacity-70" />
          </div>
        </div>
        <div className="p-4">
          {error &&
            (isPermissionError ? (
              <div className="mb-3 rounded-lg border border-amber/40 bg-amber/10 p-3">
                <p className="text-amber text-sm font-semibold mb-2">
                  Accesso alla fotocamera negato
                </p>
                <p className="text-amber/80 text-xs leading-relaxed">
                  Per utilizzare lo scanner QR:
                </p>
                <ol className="text-amber/80 text-xs leading-relaxed mt-1 space-y-0.5 list-decimal list-inside">
                  <li>
                    Clicca sull&apos;icona del lucchetto nella barra degli
                    indirizzi del browser
                  </li>
                  <li>Abilita l&apos;accesso alla fotocamera</li>
                  <li>Ricarica la pagina e riprova</li>
                </ol>
              </div>
            ) : (
              <p className="text-danger text-sm mb-2">{error.message}</p>
            ))}
          {isLoading && (
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Avvio fotocamera...
            </p>
          )}
          {isScanning && !isLoading && (
            <p className="text-muted-foreground text-sm">
              Punta la fotocamera sul QR code
            </p>
          )}
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={onClose}
            data-ocid="qr_scanner.cancel_button"
          >
            Annulla
          </Button>
          {(!isScanning && canStartScanning) || isPermissionError ? (
            <Button
              className="w-full mt-2 bg-teal text-primary-foreground hover:bg-teal/90"
              onClick={() => startScanning()}
              data-ocid="qr_scanner.retry_button"
            >
              Riprova
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ─── Residual Bar ─────────────────────────────────────────────────────────────

function ResiduoBar({ bombola }: { bombola: Bombola }) {
  const pct = getPercent(bombola);
  const low = isVuota(bombola);
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${low ? "bg-danger" : "bg-teal"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium text-right whitespace-nowrap ${low ? "text-danger" : "text-teal"}`}
      >
        {bombola.gasResiduoKg.toFixed(2)} kg
      </span>
    </div>
  );
}

// ─── View: Lista Bombole ──────────────────────────────────────────────────────

function ListaBombole({
  onNavigate,
}: {
  onNavigate: (v: View) => void;
}) {
  const { actor } = useActor();
  const [bombole, setBombole] = useState<Bombola[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState("tutti");
  const [gasFilter, setGasFilter] = useState("tutti");
  const [addingTest, setAddingTest] = useState(false);
  const [deletingEmpty, setDeletingEmpty] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bomboleDaEliminare, setBomboleDaEliminare] = useState<Bombola[]>([]);
  const [reportScaricato, setReportScaricato] = useState(false);

  // Assegna dialog state
  const [assegnaOpen, setAssegnaOpen] = useState(false);
  const [assegnaCodice, setAssegnaCodice] = useState("");
  const [nomeTecnico, setNomeTecnico] = useState("");
  const [assegnando, setAssegnando] = useState(false);

  // Reso dialog state
  const [resoOpen, setResoOpen] = useState(false);
  const [resoCodice, setResoCodice] = useState("");
  const [resando, setResando] = useState(false);

  useEffect(() => {
    if (showDeleteDialog) {
      setReportScaricato(false);
    }
  }, [showDeleteDialog]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!actor) return;
      const data = await actor.getAllBombole();
      setBombole(data);
    } catch {
      toast.error("Errore nel caricamento delle bombole");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddTest = async () => {
    setAddingTest(true);
    try {
      if (!actor) return;
      await actor.addTestData();
      await load();
      toast.success("Dati di test aggiunti");
    } catch {
      toast.error("Errore nell'aggiunta dei dati di test");
    } finally {
      setAddingTest(false);
    }
  };

  const handleClickDeleteEmpty = () => {
    const empty = bombole.filter(isVuota);
    if (empty.length === 0) {
      toast.info("Nessuna bombola vuota da eliminare");
      return;
    }
    setBomboleDaEliminare(empty);
    setShowDeleteDialog(true);
  };

  const handleDeleteEmpty = async () => {
    setDeletingEmpty(true);
    try {
      if (!actor) return;
      await Promise.all(
        bomboleDaEliminare.map((b) => actor.deleteBombola(b.codice)),
      );
      await load();
      toast.success(`${bomboleDaEliminare.length} bombole vuote eliminate`);
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingEmpty(false);
      setShowDeleteDialog(false);
      setBomboleDaEliminare([]);
    }
  };

  const openAssegnaDialog = (codice: string) => {
    setAssegnaCodice(codice);
    setNomeTecnico("");
    setAssegnaOpen(true);
  };

  const handleAssegna = async () => {
    if (!nomeTecnico.trim()) return;
    setAssegnando(true);
    try {
      if (!actor) return;
      await actor.assegnaBombola(assegnaCodice, nomeTecnico.trim());
      await load();
      toast.success(
        `Bombola ${assegnaCodice} assegnata a ${nomeTecnico.trim()}`,
      );
      setAssegnaOpen(false);
    } catch {
      toast.error("Errore durante l'assegnazione");
    } finally {
      setAssegnando(false);
    }
  };

  const openResoDialog = (codice: string) => {
    setResoCodice(codice);
    setResoOpen(true);
  };

  const handleReso = async () => {
    setResando(true);
    try {
      if (!actor) return;
      await actor.assegnaBombola(resoCodice, "Magazzino");
      await load();
      toast.success(`Bombola ${resoCodice} restituita al magazzino`);
      setResoOpen(false);
    } catch {
      toast.error("Errore durante il reso");
    } finally {
      setResando(false);
    }
  };

  const gasTypes = Array.from(new Set(bombole.map((b) => b.tipoGas)));

  const filtered = bombole.filter((b) => {
    const matchSearch =
      search === "" ||
      b.codice.toLowerCase().includes(search.toLowerCase()) ||
      b.produttore.toLowerCase().includes(search.toLowerCase()) ||
      b.tipoGas.toLowerCase().includes(search.toLowerCase()) ||
      (b.assegnazione ?? "Magazzino")
        .toLowerCase()
        .includes(search.toLowerCase());
    const stato = getStato(b);
    const matchStato = statoFilter === "tutti" || stato === statoFilter;
    const matchGas = gasFilter === "tutti" || b.tipoGas === gasFilter;
    return matchSearch && matchStato && matchGas;
  });

  const totale = bombole.length;
  const inUso = bombole.filter((b) => {
    const s = getStato(b);
    return s === "In Uso" || s === "Piena";
  }).length;
  const vuote = bombole.filter(isVuota).length;

  return (
    <div className="space-y-6">
      {/* Confirm delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-ocid="delete_empty.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  Stai per eliminare{" "}
                  <span className="font-semibold text-danger">
                    {bomboleDaEliminare.length} bombole vuote
                  </span>{" "}
                  (con ≤ 0,3 kg di gas residuo). Questa azione è irreversibile.
                </p>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {bomboleDaEliminare.map((b) => (
                    <li
                      key={b.codice}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
                    >
                      <span className="font-mono font-semibold text-foreground">
                        {b.codice}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-danger text-xs">
                          {b.gasResiduoKg.toFixed(2)} kg
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            downloadReport(b);
                            setReportScaricato(true);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Report
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ Ricordati di inviare il report all&apos;ufficio acquisti
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingEmpty}
              data-ocid="delete_empty.cancel_button"
            >
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmpty}
              disabled={deletingEmpty || !reportScaricato}
              className="bg-danger hover:bg-danger/90 text-white"
              data-ocid="delete_empty.confirm_button"
            >
              {deletingEmpty ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assegna dialog */}
      <Dialog open={assegnaOpen} onOpenChange={setAssegnaOpen}>
        <DialogContent data-ocid="assegna.dialog">
          <DialogHeader>
            <DialogTitle>Assegna Bombola</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Bombola:{" "}
              <span className="font-mono font-semibold text-foreground">
                {assegnaCodice}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Nome Tecnico *</Label>
              <Input
                value={nomeTecnico}
                onChange={(e) => setNomeTecnico(e.target.value)}
                placeholder="Es. Mario Rossi"
                className="bg-muted border-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAssegna();
                }}
                autoFocus
                data-ocid="assegna.input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssegnaOpen(false)}
              disabled={assegnando}
              data-ocid="assegna.cancel_button"
            >
              Annulla
            </Button>
            <Button
              onClick={handleAssegna}
              disabled={assegnando || !nomeTecnico.trim()}
              className="bg-teal text-primary-foreground hover:bg-teal/90"
              data-ocid="assegna.confirm_button"
            >
              {assegnando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Assegna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reso dialog */}
      <AlertDialog open={resoOpen} onOpenChange={setResoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reso Bombola</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler restituire la bombola{" "}
              <span className="font-mono font-semibold">{resoCodice}</span> al
              magazzino? L&apos;assegnazione verrà rimossa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={resando}
              data-ocid="reso.cancel_button"
            >
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReso}
              disabled={resando}
              className="bg-amber-500 text-white hover:bg-amber-600"
              data-ocid="reso.confirm_button"
            >
              {resando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Conferma Reso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiTile label="Totale Bombole" value={totale} color="text-teal" />
        <div className="flex flex-col gap-2">
          <KpiTile label="In Uso" value={inUso} color="text-cyan" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleClickDeleteEmpty}
            className="border-danger text-danger hover:bg-danger/10 gap-2 w-full"
            data-ocid="lista.delete_empty_button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Cancella Vuote
          </Button>
        </div>
        <KpiTile label="Vuote" value={vuote} color="text-danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per codice, tipo gas o tecnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
            data-ocid="lista.search_input"
          />
        </div>
        <Select value={statoFilter} onValueChange={setStatoFilter}>
          <SelectTrigger
            className="w-40 bg-card border-border"
            data-ocid="lista.stato_select"
          >
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            <SelectItem value="Piena">Piena</SelectItem>
            <SelectItem value="In Uso">In Uso</SelectItem>
            <SelectItem value="Sotto Livello">Sotto Livello</SelectItem>
            <SelectItem value="Vuota">Vuota</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gasFilter} onValueChange={setGasFilter}>
          <SelectTrigger
            className="w-40 bg-card border-border"
            data-ocid="lista.gas_select"
          >
            <SelectValue placeholder="Tipo Gas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i gas</SelectItem>
            {gasTypes.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={load}
            className="border-border"
            data-ocid="lista.refresh_button"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => onNavigate({ type: "nuova" })}
            className="bg-teal text-primary-foreground hover:bg-teal/90 gap-2"
            data-ocid="lista.nuova_button"
          >
            <Plus className="h-4 w-4" />
            Nuova Bombola
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div
            className="flex items-center justify-center h-40 text-muted-foreground gap-2"
            data-ocid="lista.loading_state"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Caricamento...</span>
          </div>
        ) : bombole.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-4"
            data-ocid="lista.empty_state"
          >
            <FlaskConical className="h-10 w-10 opacity-40" />
            <p>Nessuna bombola registrata</p>
            <Button
              variant="outline"
              onClick={handleAddTest}
              disabled={addingTest}
              className="border-border"
              data-ocid="lista.add_test_button"
            >
              {addingTest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Aggiungi dati di test
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Codice
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tipo Gas
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Livello Residuo
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Assegnazione
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Produttore
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Stato
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Azioni
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-10"
                    data-ocid="lista.filtered_empty_state"
                  >
                    Nessuna bombola corrisponde ai filtri
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b, i) => (
                  <TableRow
                    key={b.codice}
                    className="border-border hover:bg-muted/30"
                    data-ocid={`lista.item.${i + 1}`}
                  >
                    <TableCell className="font-mono font-semibold text-foreground">
                      {b.codice}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {b.tipoGas}
                    </TableCell>
                    <TableCell>
                      <ResiduoBar bombola={b} />
                    </TableCell>
                    <TableCell>
                      <AssegnazioneBadge
                        assegnazione={b.assegnazione ?? "Magazzino"}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.produttore}
                    </TableCell>
                    <TableCell>
                      <StatoBadge stato={getStato(b)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onNavigate({ type: "dettaglio", codice: b.codice })
                          }
                          className="border-border text-foreground hover:bg-muted"
                          data-ocid={`lista.dettagli_button.${i + 1}`}
                        >
                          Dettagli
                        </Button>
                        {b.assegnazione && b.assegnazione !== "Magazzino" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openResoDialog(b.codice)}
                            className="border-amber-400/60 text-amber-600 hover:bg-amber-50 gap-1"
                            data-ocid={`lista.reso_button.${i + 1}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reso
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssegnaDialog(b.codice)}
                            className="border-teal/40 text-teal hover:bg-teal/10 gap-1"
                            data-ocid={`lista.assegna_button.${i + 1}`}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Assegna
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── View: Dettaglio Bombola ───────────────────────────────────────────────────

function DettaglioBombola({
  codice,
  onNavigate,
}: {
  codice: string;
  onNavigate: (v: View) => void;
}) {
  const { actor } = useActor();
  const [bombola, setBombola] = useState<Bombola | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    setLoading(true);
    actor
      .getBombola(codice)
      .then(setBombola)
      .catch(() => toast.error("Errore nel caricamento"))
      .finally(() => setLoading(false));
  }, [codice, actor]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-40 text-muted-foreground gap-2"
        data-ocid="dettaglio.loading_state"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Caricamento...
      </div>
    );
  }

  if (!bombola) {
    return (
      <div
        className="text-danger text-center py-10"
        data-ocid="dettaglio.error_state"
      >
        Bombola non trovata
      </div>
    );
  }

  const pct = getPercent(bombola);
  const stato = getStato(bombola);

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => onNavigate({ type: "lista" })}
          className="gap-2 text-muted-foreground hover:text-foreground"
          data-ocid="dettaglio.back_button"
        >
          <ArrowLeft className="h-4 w-4" />
          Lista Bombole
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadReport(bombola)}
            className="gap-2 border-border"
            data-ocid="dettaglio.download_report_button"
          >
            <Download className="h-4 w-4" />
            Scarica Report
          </Button>
          <Button
            onClick={() => onNavigate({ type: "utilizzo", codice })}
            className="bg-teal text-primary-foreground hover:bg-teal/90 gap-2"
            data-ocid="dettaglio.registra_utilizzo_button"
          >
            <Plus className="h-4 w-4" />
            Registra Utilizzo
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground font-mono">
              {bombola.codice}
            </h2>
            <p className="text-muted-foreground mt-1">{bombola.tipoGas}</p>
          </div>
          <div className="flex items-center gap-2">
            <AssegnazioneBadge
              assegnazione={bombola.assegnazione ?? "Magazzino"}
            />
            <StatoBadge stato={stato} />
          </div>
        </div>

        {/* Gas Level */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Gas Residuo</span>
            <span
              className={`font-semibold ${pct < 20 ? "text-danger" : "text-teal"}`}
            >
              {bombola.gasResiduoKg.toFixed(1)} kg /{" "}
              {bombola.gasTotaleKg.toFixed(1)} kg
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct < 20 ? "bg-danger" : "bg-teal"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Produttore
            </p>
            <p className="text-foreground font-medium mt-0.5">
              {bombola.produttore}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Tara
            </p>
            <p className="text-foreground font-medium mt-0.5">
              {bombola.taraKg.toFixed(1)} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Gas Totale
            </p>
            <p className="text-foreground font-medium mt-0.5">
              {bombola.gasTotaleKg.toFixed(1)} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Utilizzi
            </p>
            <p className="text-foreground font-medium mt-0.5">
              {bombola.utilizzi.length}
            </p>
          </div>
        </div>
      </div>

      {/* Utilizzi Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Storico Utilizzi
          </h3>
        </div>
        {bombola.utilizzi.length === 0 ? (
          <div
            className="text-center text-muted-foreground py-10"
            data-ocid="dettaglio.utilizzi_empty_state"
          >
            Nessun utilizzo registrato
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Data
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Luogo
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Apparecchiatura
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Kg Usati
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tecnico
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...bombola.utilizzi].reverse().map((u, i) => (
                <TableRow
                  key={String(u.data)}
                  className="border-border hover:bg-muted/30"
                  data-ocid={`dettaglio.utilizzi.item.${i + 1}`}
                >
                  <TableCell className="text-muted-foreground text-xs">
                    {formatNanos(u.data)}
                  </TableCell>
                  <TableCell className="text-foreground">{u.luogo}</TableCell>
                  <TableCell className="text-foreground">
                    {u.apparecchiatura}
                  </TableCell>
                  <TableCell className="text-amber font-semibold">
                    {u.kgUsati.toFixed(2)} kg
                  </TableCell>
                  <TableCell className="text-foreground">{u.tecnico}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── View: Registra Utilizzo ───────────────────────────────────────────────────

function RegistraUtilizzo({
  codice,
  onNavigate,
}: {
  codice: string;
  onNavigate: (v: View) => void;
}) {
  const [bombola, setBombola] = useState<Bombola | null>(null);
  const [luogo, setLuogo] = useState("");
  const [apparecchiatura, setApparecchiatura] = useState("");
  const [kgUsati, setKgUsati] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { actor } = useActor();
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!actor) return;
    actor
      .getBombola(codice)
      .then((b) => {
        setBombola(b);
        if (b?.assegnazione !== undefined && b.assegnazione !== "Magazzino") {
          setTecnico(b.assegnazione);
        }
      })
      .catch(() => toast.error("Errore nel caricamento"));
  }, [codice, actor]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!luogo.trim()) e.luogo = "Campo obbligatorio";
    if (!apparecchiatura.trim()) e.apparecchiatura = "Campo obbligatorio";
    if (!tecnico.trim()) e.tecnico = "Campo obbligatorio";
    const kg = Number.parseFloat(kgUsati);
    if (Number.isNaN(kg) || kg <= 0)
      e.kgUsati = "Inserire un valore maggiore di 0";
    else if (bombola && kg > bombola.gasResiduoKg)
      e.kgUsati = `Massimo ${bombola.gasResiduoKg.toFixed(2)} kg disponibili`;
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      if (!actor) return;
      await actor.registerUtilizzo(
        codice,
        luogo,
        apparecchiatura,
        Number.parseFloat(kgUsati),
        tecnico,
      );
      toast.success("Utilizzo registrato con successo");
      onNavigate({ type: "dettaglio", codice });
    } catch {
      toast.error("Errore nella registrazione");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <Button
        variant="ghost"
        onClick={() => onNavigate({ type: "dettaglio", codice })}
        className="gap-2 text-muted-foreground hover:text-foreground"
        data-ocid="utilizzo.back_button"
      >
        <ArrowLeft className="h-4 w-4" />
        Dettaglio Bombola
      </Button>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Registra Utilizzo
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Bombola:{" "}
          <span className="font-mono text-teal font-semibold">{codice}</span>
          {bombola && (
            <span className="ml-2 text-xs">
              (Residuo: {bombola.gasResiduoKg.toFixed(2)} kg)
            </span>
          )}
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-ocid="utilizzo.form"
        >
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Luogo *</Label>
            <Input
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              placeholder="Es. Cantiere Via Roma 10"
              className="bg-muted border-border"
              data-ocid="utilizzo.luogo_input"
            />
            {errors.luogo && (
              <p
                className="text-danger text-xs"
                data-ocid="utilizzo.luogo_error"
              >
                {errors.luogo}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Apparecchiatura *</Label>
            <Input
              value={apparecchiatura}
              onChange={(e) => setApparecchiatura(e.target.value)}
              placeholder="Es. Condizionatore Numero Marca"
              className="bg-muted border-border"
              data-ocid="utilizzo.apparecchiatura_input"
            />
            {errors.apparecchiatura && (
              <p
                className="text-danger text-xs"
                data-ocid="utilizzo.apparecchiatura_error"
              >
                {errors.apparecchiatura}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Kg Utilizzati *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={kgUsati}
              onChange={(e) => setKgUsati(e.target.value)}
              placeholder="Es. 2.50"
              className="bg-muted border-border"
              data-ocid="utilizzo.kg_input"
            />
            {errors.kgUsati && (
              <p className="text-danger text-xs" data-ocid="utilizzo.kg_error">
                {errors.kgUsati}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Tecnico *</Label>
            <Input
              value={tecnico}
              readOnly
              placeholder="Es. Mario Rossi"
              className="bg-muted border-border opacity-70 cursor-not-allowed"
              data-ocid="utilizzo.tecnico_input"
            />
            {errors.tecnico && (
              <p
                className="text-danger text-xs"
                data-ocid="utilizzo.tecnico_error"
              >
                {errors.tecnico}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal text-primary-foreground hover:bg-teal/90"
            data-ocid="utilizzo.submit_button"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {submitting ? "Registrazione..." : "Registra Utilizzo"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── View: Nuova Bombola ───────────────────────────────────────────────────────

function NuovaBombola({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [codice, setCodice] = useState("");
  const [produttore, setProduttore] = useState("");
  const [taraKg, setTaraKg] = useState("");
  const [gasTotaleKg, setGasTotaleKg] = useState("");
  const [tipoGas, setTipoGas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { actor } = useActor();
  const [showQR, setShowQR] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!codice.trim()) e.codice = "Campo obbligatorio";
    if (!produttore.trim()) e.produttore = "Campo obbligatorio";
    if (!tipoGas.trim()) e.tipoGas = "Campo obbligatorio";
    const tara = Number.parseFloat(taraKg);
    if (Number.isNaN(tara) || tara <= 0)
      e.taraKg = "Inserire un valore positivo";
    const gas = Number.parseFloat(gasTotaleKg);
    if (Number.isNaN(gas) || gas <= 0)
      e.gasTotaleKg = "Inserire un valore positivo";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      if (!actor) return;
      const exists = await actor.bombolaExists(codice);
      if (exists) {
        setErrors({ codice: "Bombola già esistente con questo codice" });
        setSubmitting(false);
        return;
      }
      await actor.addBombola(
        codice,
        produttore,
        Number.parseFloat(taraKg),
        Number.parseFloat(gasTotaleKg),
        tipoGas,
      );
      toast.success("Bombola registrata con successo");
      onNavigate({ type: "lista" });
    } catch {
      toast.error("Errore nella registrazione");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {showQR && (
        <QRScannerModal
          onResult={(val) => {
            setCodice(val);
            setShowQR(false);
            toast.success("Codice acquisito dal QR");
          }}
          onClose={() => setShowQR(false)}
        />
      )}

      <Button
        variant="ghost"
        onClick={() => onNavigate({ type: "lista" })}
        className="gap-2 text-muted-foreground hover:text-foreground"
        data-ocid="nuova.back_button"
      >
        <ArrowLeft className="h-4 w-4" />
        Lista Bombole
      </Button>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">
          Nuova Bombola
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-ocid="nuova.form"
        >
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Codice Bombola *</Label>
            <div className="flex gap-2">
              <Input
                value={codice}
                onChange={(e) => setCodice(e.target.value)}
                placeholder="Es. BOM-2024-001"
                className="bg-muted border-border flex-1"
                data-ocid="nuova.codice_input"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowQR(true)}
                className="border-border shrink-0"
                data-ocid="nuova.qr_scan_button"
                title="Scansiona QR"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
            {errors.codice && (
              <p className="text-danger text-xs" data-ocid="nuova.codice_error">
                {errors.codice}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Produttore *</Label>
            <Input
              value={produttore}
              onChange={(e) => setProduttore(e.target.value)}
              placeholder="Es. Linde Italia"
              className="bg-muted border-border"
              data-ocid="nuova.produttore_input"
            />
            {errors.produttore && (
              <p
                className="text-danger text-xs"
                data-ocid="nuova.produttore_error"
              >
                {errors.produttore}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Tipo Gas *</Label>
            <Input
              value={tipoGas}
              onChange={(e) => setTipoGas(e.target.value)}
              placeholder="Es. CO2, Argon, Acetilene"
              className="bg-muted border-border"
              data-ocid="nuova.tipo_gas_input"
            />
            {errors.tipoGas && (
              <p
                className="text-danger text-xs"
                data-ocid="nuova.tipo_gas_error"
              >
                {errors.tipoGas}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Tara (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={taraKg}
                onChange={(e) => setTaraKg(e.target.value)}
                placeholder="Es. 14.0"
                className="bg-muted border-border"
                data-ocid="nuova.tara_input"
              />
              {errors.taraKg && (
                <p className="text-danger text-xs" data-ocid="nuova.tara_error">
                  {errors.taraKg}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">
                Gas Totale (kg) *
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={gasTotaleKg}
                onChange={(e) => setGasTotaleKg(e.target.value)}
                placeholder="Es. 10.0"
                className="bg-muted border-border"
                data-ocid="nuova.gas_totale_input"
              />
              {errors.gasTotaleKg && (
                <p
                  className="text-danger text-xs"
                  data-ocid="nuova.gas_totale_error"
                >
                  {errors.gasTotaleKg}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal text-primary-foreground hover:bg-teal/90"
            data-ocid="nuova.submit_button"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {submitting ? "Registrazione..." : "Registra Bombola"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── App Root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>({ type: "lista" });

  const pageTitle =
    view.type === "lista"
      ? "Lista Bombole"
      : view.type === "dettaglio"
        ? "Dettaglio Bombola"
        : view.type === "utilizzo"
          ? "Registra Utilizzo"
          : "Nuova Bombola";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Cylinder className="h-6 w-6 text-teal shrink-0" />
          <span className="font-bold text-foreground tracking-tight">
            Gestione Bombole Gas
          </span>
          <span className="ml-3 text-muted-foreground text-sm hidden sm:block">
            / {pageTitle}
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view.type}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {view.type === "lista" && <ListaBombole onNavigate={setView} />}
            {view.type === "dettaglio" && (
              <DettaglioBombola codice={view.codice} onNavigate={setView} />
            )}
            {view.type === "utilizzo" && (
              <RegistraUtilizzo codice={view.codice} onNavigate={setView} />
            )}
            {view.type === "nuova" && <NuovaBombola onNavigate={setView} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()}. Realizzato con ❤️ usando{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal hover:underline"
        >
          caffeine.ai
        </a>
      </footer>

      <Toaster richColors theme="dark" />
    </div>
  );
}
