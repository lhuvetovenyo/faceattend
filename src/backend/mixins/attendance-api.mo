import List "mo:core/List";
import AttendanceTypes "../types/attendance";
import PersonTypes "../types/persons";
import AttendanceLib "../lib/attendance";

mixin (
  records : List.List<AttendanceTypes.AttendanceRecord>,
  persons : List.List<PersonTypes.Person>,
  state : { var nextAttendanceId : Nat }
) {
  public func recordAttendance(personId : Text, date : Text, slot : Text, time : Text) : async { #ok : Text; #err : Text } {
    switch (AttendanceLib.recordAttendance(records, state, personId, date, slot, time)) {
      case (#ok(id))      { #ok(id) };
      case (#alreadyMarked) { #err("Already marked") };
    }
  };

  public query func getAttendance(personId : Text, date : Text) : async ?AttendanceTypes.AttendanceRecord {
    AttendanceLib.getAttendance(records, personId, date)
  };

  public func updateAttendance(id : Text, updates : AttendanceTypes.AttendanceUpdateInput) : async { #ok : AttendanceTypes.AttendanceRecord; #err : Text } {
    switch (AttendanceLib.updateAttendance(records, id, updates)) {
      case (?rec) { #ok(rec) };
      case null   { #err("Record not found: " # id) };
    }
  };

  public func deleteAttendance(id : Text) : async { #ok : (); #err : Text } {
    if (AttendanceLib.deleteAttendance(records, id)) {
      #ok(())
    } else {
      #err("Record not found: " # id)
    }
  };

  public query func listAttendance() : async [AttendanceTypes.AttendanceRecord] {
    AttendanceLib.listAttendance(records)
  };

  public query func listAttendanceByDate(date : Text) : async [AttendanceTypes.AttendanceRecord] {
    AttendanceLib.listAttendanceByDate(records, date)
  };
};
