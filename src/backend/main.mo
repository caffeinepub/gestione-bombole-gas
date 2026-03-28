import Map "mo:core/Map";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Order "mo:core/Order";


actor {
  type Utilizzo = {
    data : Int;
    luogo : Text;
    apparecchiatura : Text;
    kgUsati : Float;
    tecnico : Text;
  };

  func compareUtilizzo(u1 : Utilizzo, u2 : Utilizzo) : Order.Order {
    Int.compare(u1.data, u2.data);
  };

  type Bombola = {
    codice : Text;
    produttore : Text;
    taraKg : Float;
    gasTotaleKg : Float;
    gasResiduoKg : Float;
    tipoGas : Text;
    utilizzi : [Utilizzo];
    assegnazione : Text;
  };

  func compareBombola(b1 : Bombola, b2 : Bombola) : Order.Order {
    Text.compare(b1.codice, b2.codice);
  };

  var bomboleStable : [(Text, Bombola)] = [];
  var bombole = Map.empty<Text, Bombola>();

  system func preupgrade() {
    bomboleStable := bombole.entries().toArray();
  };

  system func postupgrade() {
    for ((k, v) in bomboleStable.vals()) {
      bombole.add(k, v);
    };
  };

  public shared func addBombola(codice : Text, produttore : Text, taraKg : Float, gasTotaleKg : Float, tipoGas : Text) : async () {
    if (bombole.containsKey(codice)) { Runtime.trap("Bombola esiste già con questo codice") };
    let bombola : Bombola = {
      codice;
      produttore;
      taraKg;
      gasTotaleKg;
      gasResiduoKg = gasTotaleKg;
      tipoGas;
      utilizzi = [];
      assegnazione = "Magazzino";
    };
    bombole.add(codice, bombola);
  };

  public query func bombolaExists(codice : Text) : async Bool {
    bombole.containsKey(codice);
  };

  public query func getBombola(codice : Text) : async Bombola {
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?bombola) { bombola };
    };
  };

  public shared func registerUtilizzo(codice : Text, luogo : Text, apparecchiatura : Text, kgUsati : Float, tecnico : Text) : async () {
    if (kgUsati <= 0) { Runtime.trap("kgUsati deve essere maggiore di 0") };
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?bombola) {
        if (kgUsati > bombola.gasResiduoKg) { Runtime.trap("Gas residuo insufficiente") };
        let utilizzo : Utilizzo = {
          data = Time.now();
          luogo;
          apparecchiatura;
          kgUsati;
          tecnico;
        };
        let newGasResiduo = Float.max(0, bombola.gasResiduoKg - kgUsati);
        let allUtilizzi = bombola.utilizzi.concat([utilizzo]);
        let sortedUtilizzi = allUtilizzi.sort(compareUtilizzo);
        let updatedBombola : Bombola = {
          bombola with
          gasResiduoKg = newGasResiduo;
          utilizzi = sortedUtilizzi;
        };
        bombole.add(codice, updatedBombola);
      };
    };
  };

  public shared func assegnaBombola(codice : Text, tecnico : Text) : async () {
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?bombola) {
        let updatedBombola : Bombola = { bombola with assegnazione = tecnico };
        bombole.add(codice, updatedBombola);
      };
    };
  };

  public shared func deleteBombola(codice : Text) : async () {
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?_) { bombole.remove(codice) };
    };
  };

  public query func getAllBombole() : async [Bombola] {
    bombole.values().toArray().sort(compareBombola);
  };

  public shared func importaBombole(dati : [Bombola]) : async () {
    // Clear all existing data
    let keys = bombole.keys().toArray();
    for (k in keys.vals()) {
      bombole.remove(k);
    };
    // Re-import all bombole from backup
    for (b in dati.vals()) {
      bombole.add(b.codice, b);
    };
  };
};
