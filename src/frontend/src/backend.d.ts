import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Utilizzo {
    apparecchiatura: string;
    data: bigint;
    luogo: string;
    tecnico: string;
    kgUsati: number;
}
export interface Bombola {
    gasResiduoKg: number;
    utilizzi: Array<Utilizzo>;
    taraKg: number;
    assegnazione: string;
    tipoGas: string;
    codice: string;
    gasTotaleKg: number;
    produttore: string;
}
export interface backendInterface {
    addBombola(codice: string, produttore: string, taraKg: number, gasTotaleKg: number, tipoGas: string): Promise<void>;
    assegnaBombola(codice: string, tecnico: string): Promise<void>;
    bombolaExists(codice: string): Promise<boolean>;
    deleteBombola(codice: string): Promise<void>;
    getAllBombole(): Promise<Array<Bombola>>;
    getBombola(codice: string): Promise<Bombola>;
    importaBombole(dati: Array<Bombola>): Promise<void>;
    registerUtilizzo(codice: string, luogo: string, apparecchiatura: string, kgUsati: number, tecnico: string): Promise<void>;
}
