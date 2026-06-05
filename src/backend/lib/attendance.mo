import List "mo:core/List";
import Set  "mo:core/Set";
import AttendanceTypes "../types/attendance";

module {
  /// Record a slot for a personId+date. Creates a new record if none exists for that day.
  /// Returns "already_marked" if the slot is already filled.
  public func recordAttendance(
    records : List.List<AttendanceTypes.AttendanceRecord>,
    state   : { var nextAttendanceId : Nat },
    personId : Text,
    date     : Text,
    slot     : Text,
    time     : Text
  ) : { #ok : Text; #alreadyMarked } {
    switch (records.find(func(r) { r.personId == personId and r.date == date })) {
      case (?existing) {
        let alreadyFilled = switch (slot) {
          case "entry"      { existing.entry      != null };
          case "break"      { existing.breakTime  != null };
          case "afterBreak" { existing.afterBreak != null };
          case "exit"       { existing.exit       != null };
          case _            { false };
        };
        if (alreadyFilled) { return #alreadyMarked };
        let updated : AttendanceTypes.AttendanceRecord = switch (slot) {
          case "entry"      { { existing with entry      = ?time } };
          case "break"      { { existing with breakTime  = ?time } };
          case "afterBreak" { { existing with afterBreak = ?time } };
          case "exit"       { { existing with exit       = ?time } };
          case _            { existing };
        };
        records.mapInPlace(func(r) { if (r.id == existing.id) { updated } else { r } });
        #ok(existing.id)
      };
      case null {
        let id = state.nextAttendanceId;
        state.nextAttendanceId += 1;
        let record : AttendanceTypes.AttendanceRecord = {
          id         = id.toText();
          personId;
          date;
          entry      = if (slot == "entry")      { ?time } else { null };
          breakTime  = if (slot == "break")      { ?time } else { null };
          afterBreak = if (slot == "afterBreak") { ?time } else { null };
          exit       = if (slot == "exit")       { ?time } else { null };
        };
        records.add(record);
        #ok(id.toText())
      };
    }
  };

  public func getAttendance(
    records  : List.List<AttendanceTypes.AttendanceRecord>,
    personId : Text,
    date     : Text
  ) : ?AttendanceTypes.AttendanceRecord {
    records.find(func(r) { r.personId == personId and r.date == date })
  };

  public func getAttendanceById(
    records : List.List<AttendanceTypes.AttendanceRecord>,
    id      : Text
  ) : ?AttendanceTypes.AttendanceRecord {
    records.find(func(r) { r.id == id })
  };

  public func updateAttendance(
    records : List.List<AttendanceTypes.AttendanceRecord>,
    id      : Text,
    input   : AttendanceTypes.AttendanceUpdateInput
  ) : ?AttendanceTypes.AttendanceRecord {
    var result : ?AttendanceTypes.AttendanceRecord = null;
    records.mapInPlace(
      func(r) {
        if (r.id == id) {
          let updated : AttendanceTypes.AttendanceRecord = {
            r with
            entry      = input.entry;
            breakTime  = input.breakTime;
            afterBreak = input.afterBreak;
            exit       = input.exit;
          };
          result := ?updated;
          updated
        } else { r }
      }
    );
    result
  };

  public func deleteAttendance(
    records : List.List<AttendanceTypes.AttendanceRecord>,
    id      : Text
  ) : Bool {
    let sizeBefore = records.size();
    let kept = records.filter(func(r) { r.id != id });
    records.clear();
    records.append(kept);
    records.size() < sizeBefore
  };

  public func listAttendance(
    records : List.List<AttendanceTypes.AttendanceRecord>
  ) : [AttendanceTypes.AttendanceRecord] {
    records.toArray()
  };

  public func listAttendanceByDate(
    records : List.List<AttendanceTypes.AttendanceRecord>,
    date    : Text
  ) : [AttendanceTypes.AttendanceRecord] {
    records.filter(func(r) { r.date == date }).toArray()
  };

  // ── Stats (live, never stored) ────────────────────────────────────────────

  public func getTotalCheckIns(
    records : List.List<AttendanceTypes.AttendanceRecord>
  ) : Nat {
    records.foldLeft<Nat, AttendanceTypes.AttendanceRecord>(
      0,
      func(acc, r) {
        var slots = 0;
        if (r.entry      != null) { slots += 1 };
        if (r.breakTime  != null) { slots += 1 };
        if (r.afterBreak != null) { slots += 1 };
        if (r.exit       != null) { slots += 1 };
        acc + slots
      }
    )
  };

  public func getTodayCheckIns(
    records : List.List<AttendanceTypes.AttendanceRecord>,
    today   : Text
  ) : Nat {
    records.foldLeft<Nat, AttendanceTypes.AttendanceRecord>(
      0,
      func(acc, r) {
        if (
          r.date == today and (
            r.entry != null or r.breakTime != null or
            r.afterBreak != null or r.exit != null
          )
        ) { acc + 1 } else { acc }
      }
    )
  };

  public func getActiveMonths(
    records : List.List<AttendanceTypes.AttendanceRecord>
  ) : Nat {
    let months = Set.empty<Text>();
    records.forEach(
      func(r) {
        // date is YYYY-MM-DD, extract first 7 chars as YYYY-MM
        let parts = r.date.split(#char '-').toArray();
        if (parts.size() >= 2) {
          months.add(parts[0] # "-" # parts[1]);
        };
      }
    );
    months.size()
  };
};
