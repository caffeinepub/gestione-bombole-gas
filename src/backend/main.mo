import Map "mo:core/Map";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
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

  module Utilizzo {
    public func compare(u1 : Utilizzo, u2 : Utilizzo) : Order.Order {
      Int.compare(u1.data, u2.data);
    };
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

  module Bombola {
    public func compare(b1 : Bombola, b2 : Bombola) : Order.Order {
      Text.compare(b1.codice, b2.codice);
    };
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

  public shared ({ caller }) func addBombola(codice : Text, produttore : Text, taraKg : Float, gasTotaleKg : Float, tipoGas : Text) : async () {
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

  public query ({ caller }) func bombolaExists(codice : Text) : async Bool {
    bombole.containsKey(codice);
  };

  public query ({ caller }) func getBombola(codice : Text) : async Bombola {
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?bombola) { bombola };
    };
  };

  public shared ({ caller }) func registerUtilizzo(codice : Text, luogo : Text, apparecchiatura : Text, kgUsati : Float, tecnico : Text) : async () {
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
        let updatedBombola : Bombola = {
          bombola with
          gasResiduoKg = newGasResiduo;
          utilizzi = allUtilizzi.sort();
        };
        bombole.add(codice, updatedBombola);
      };
    };
  };

  public shared ({ caller }) func assegnaBombola(codice : Text, tecnico : Text) : async () {
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?bombola) {
        let updatedBombola : Bombola = { bombola with assegnazione = tecnico };
        bombole.add(codice, updatedBombola);
      };
    };
  };

  public shared ({ caller }) func deleteBombola(codice : Text) : async () {
    switch (bombole.get(codice)) {
      case (null) { Runtime.trap("Bombola non trovata") };
      case (?_) { bombole.remove(codice) };
    };
  };

  public query ({ caller }) func getAllBombole() : async [Bombola] {
    bombole.values().toArray().sort();
  };

  public func addTestData() : async () {
    let testUtilizzo : Utilizzo = {
      data = 1715688409000000000;
      luogo = "Hotel";
      apparecchiatura = "Frigorifero";
      kgUsati = 10;
      tecnico = "Beppe";
    };

    let testBombola : Bombola = {
      codice = "ITALGas0934832092301238";
      produttore = "ITALGAS";
      taraKg = 230;
      gasTotaleKg = 120;
      gasResiduoKg = 110;
      tipoGas = "propano";
      utilizzi = [testUtilizzo];
      assegnazione = "Magazzino";
    };

    bombole.add(testBombola.codice, testBombola);
  };
};
