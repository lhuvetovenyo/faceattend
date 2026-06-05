import List "mo:core/List";
import PersonTypes "../types/persons";
import PersonLib "../lib/persons";
import AttendanceTypes "../types/attendance";

mixin (
  persons : List.List<PersonTypes.Person>,
  attendanceRecords : List.List<AttendanceTypes.AttendanceRecord>,
  state : { var nextPersonId : Nat }
) {
  public func addPerson(input : PersonTypes.PersonInput) : async { #ok : PersonTypes.Person; #err : Text } {
    let person = PersonLib.addPerson(persons, state, input);
    #ok(person)
  };

  public query func getPerson(id : Text) : async ?PersonTypes.Person {
    PersonLib.getPerson(persons, id)
  };

  public query func listPersons() : async [PersonTypes.Person] {
    PersonLib.listPersons(persons)
  };

  public func updatePerson(id : Text, input : PersonTypes.PersonInput) : async { #ok : PersonTypes.Person; #err : Text } {
    switch (PersonLib.updatePerson(persons, id, input)) {
      case (?p) { #ok(p) };
      case null  { #err("Person not found: " # id) };
    }
  };

  public func deletePerson(id : Text) : async { #ok : (); #err : Text } {
    if (PersonLib.deletePerson(persons, attendanceRecords, id)) {
      #ok(())
    } else {
      #err("Person not found: " # id)
    }
  };

  public query func getAllFaceDescriptors() : async [(Text, [Float])] {
    PersonLib.getAllFaceDescriptors(persons)
  };
};
