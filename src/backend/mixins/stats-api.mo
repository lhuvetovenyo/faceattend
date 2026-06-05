import List "mo:core/List";
import AttendanceTypes "../types/attendance";
import PersonTypes "../types/persons";
import AttendanceLib "../lib/attendance";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Nat "mo:core/Nat";

mixin (
  records : List.List<AttendanceTypes.AttendanceRecord>,
  persons : List.List<PersonTypes.Person>,
) {
  /// Total number of registered students — live from persons list.
  public query func getTotalStudents() : async Nat {
    persons.size()
  };

  /// Count of all non-null time slots across every record — live.
  public query func getTotalCheckIns() : async Nat {
    AttendanceLib.getTotalCheckIns(records)
  };

  /// Count of records for today that have at least one slot filled — live.
  public query func getTodayCheckIns() : async Nat {
    let nowSec : Int = Time.now() / 1_000_000_000;
    let daysSince : Nat = Int.abs(nowSec) / 86400;
    var remaining = daysSince;
    var year : Nat = 1970;
    label yLoop while (true) {
      let diy : Nat = if ((year % 4 == 0 and year % 100 != 0) or year % 400 == 0) 366 else 365;
      if (remaining < diy) { break yLoop };
      remaining -= diy;
      year += 1;
    };
    let isLeap : Bool = (year % 4 == 0 and year % 100 != 0) or year % 400 == 0;
    let dim : [Nat] = [31, if isLeap 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var month : Nat = 1;
    label mLoop for (d in dim.values()) {
      if (remaining < d) { break mLoop };
      remaining -= d;
      month += 1;
    };
    let day : Nat = remaining + 1;
    let pad2 = func(n : Nat) : Text { if (n < 10) "0" # n.toText() else n.toText() };
    let today = year.toText() # "-" # pad2(month) # "-" # pad2(day);
    AttendanceLib.getTodayCheckIns(records, today)
  };

  /// Count of distinct YYYY-MM months that have any attendance data — live.
  public query func getActiveMonths() : async Nat {
    AttendanceLib.getActiveMonths(records)
  };
};
