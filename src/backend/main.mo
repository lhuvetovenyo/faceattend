import Array "mo:core/Array";
import Map "mo:core/Map";
import Int "mo:core/Int";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";



persistent actor {
  type PersonType = { #student; #employee };

  type Person = {
    id : Nat;
    name : Text;
    personType : PersonType;
    rollNo : Text;
    batch : Text;
    studentId : Text;
    employeeId : Text;
    faceDescriptor : [Float];
    createdAt : Time.Time;
  };

  type PersonSummary = {
    id : Nat;
    name : Text;
    personType : PersonType;
    rollNo : Text;
    batch : Text;
    studentId : Text;
    employeeId : Text;
    createdAt : Time.Time;
  };

  type DescriptorEntry = {
    id : Nat;
    personType : PersonType;
    name : Text;
    faceDescriptor : [Float];
  };

  type AttendanceRecord = {
    id : Nat;
    personId : Nat;
    name : Text;
    personType : PersonType;
    slot : Text;
    timestamp : Int;
    dateStr : Text;
    monthStr : Text;
    timeStr : Text;
    year : Int;
    month : Int;
    day : Int;
    editedAt : ?Time.Time;
  };

  type Stats = {
    totalPersons : Nat;
    totalAttendance : Nat;
    todayCheckins : Nat;
    activeMonths : [Text];
  };

  var persons : Map.Map<Nat, Person> = Map.empty<Nat, Person>();
  var attendance : Map.Map<Nat, AttendanceRecord> = Map.empty<Nat, AttendanceRecord>();
  var personIdCounter : Nat = 0;
  var attendanceIdCounter : Nat = 0;

  func allPersons() : [Person] {
    persons.toArray().map(func(kv : (Nat, Person)) : Person { kv.1 });
  };

  func allAttendance() : [AttendanceRecord] {
    attendance.toArray().map(func(kv : (Nat, AttendanceRecord)) : AttendanceRecord { kv.1 });
  };

  public shared func registerPerson(
    personTypeStr : Text,
    studentId : Text,
    employeeId : Text,
    name : Text,
    rollNo : Text,
    batch : Text,
    faceDescriptor : [Float]
  ) : async Nat {
    let pt : PersonType = if (personTypeStr == "student") #student else #employee;
    personIdCounter += 1;
    let id = personIdCounter;
    persons.add(id, {
      id; name; personType = pt; rollNo; batch;
      studentId; employeeId; faceDescriptor; createdAt = Time.now();
    });
    id;
  };

  public query func getAllPersons() : async [PersonSummary] {
    allPersons().map(func(p : Person) : PersonSummary {
      { id = p.id; name = p.name; personType = p.personType; rollNo = p.rollNo;
        batch = p.batch; studentId = p.studentId; employeeId = p.employeeId;
        createdAt = p.createdAt };
    });
  };

  public query func getAllFaceDescriptors() : async [DescriptorEntry] {
    allPersons().map(func(p : Person) : DescriptorEntry {
      { id = p.id; personType = p.personType; name = p.name; faceDescriptor = p.faceDescriptor };
    });
  };

  public query func getPerson(id : Nat) : async Person {
    switch (persons.get(id)) {
      case (null) Runtime.trap("Person not found");
      case (?p) p;
    };
  };

  public query func getPersonSummary(id : Nat) : async PersonSummary {
    switch (persons.get(id)) {
      case (null) Runtime.trap("Person not found");
      case (?p) {
        { id = p.id; name = p.name; personType = p.personType; rollNo = p.rollNo;
          batch = p.batch; studentId = p.studentId; employeeId = p.employeeId;
          createdAt = p.createdAt };
      };
    };
  };

  public shared func updatePerson(
    id : Nat, studentId : Text, employeeId : Text,
    name : Text, rollNo : Text, batch : Text
  ) : async () {
    switch (persons.get(id)) {
      case (null) Runtime.trap("Person not found");
      case (?p) {
        persons.remove(id);
        persons.add(id, {
          id = p.id;
          name = if (name == "") p.name else name;
          personType = p.personType; rollNo; batch;
          studentId = if (studentId == "") p.studentId else studentId;
          employeeId = if (employeeId == "") p.employeeId else employeeId;
          faceDescriptor = p.faceDescriptor; createdAt = p.createdAt;
        });
      };
    };
  };

  public shared func updatePersonDescriptor(id : Nat, faceDescriptor : [Float]) : async () {
    switch (persons.get(id)) {
      case (null) Runtime.trap("Person not found");
      case (?p) {
        persons.remove(id);
        persons.add(id, {
          id = p.id; name = p.name; personType = p.personType;
          rollNo = p.rollNo; batch = p.batch; studentId = p.studentId;
          employeeId = p.employeeId; faceDescriptor; createdAt = p.createdAt;
        });
      };
    };
  };

  public shared func deletePerson(id : Nat) : async () {
    switch (persons.get(id)) {
      case (null) Runtime.trap("Person not found");
      case (?_) {};
    };
    persons.remove(id);
    let toRemove = allAttendance()
      .filter(func(r : AttendanceRecord) : Bool { r.personId == id })
      .map(func(r : AttendanceRecord) : Nat { r.id });
    for (rid in toRemove.vals()) {
      attendance.remove(rid);
    };
  };

  public shared func recordAttendance(
    personId : Nat, personTypeStr : Text, name : Text, slot : Text,
    timestamp : Int, dateStr : Text, monthStr : Text, timeStr : Text,
    year : Int, month : Int, day : Int
  ) : async Nat {
    let pt : PersonType = if (personTypeStr == "student") #student else #employee;
    attendanceIdCounter += 1;
    let id = attendanceIdCounter;
    attendance.add(id, {
      id; personId; name; personType = pt; slot; timestamp;
      dateStr; monthStr; timeStr; year; month; day; editedAt = null;
    });
    id;
  };

  public query func getAttendanceRecords() : async [AttendanceRecord] {
    allAttendance().sort(
      func(a : AttendanceRecord, b : AttendanceRecord) : { #less; #equal; #greater } {
        Int.compare(b.timestamp, a.timestamp);
      }
    );
  };

  public query func getAttendanceByDate(dateStr : Text) : async [AttendanceRecord] {
    allAttendance().filter(func(r : AttendanceRecord) : Bool { r.dateStr == dateStr });
  };

  public query func getAttendanceByMonth(monthStr : Text) : async [AttendanceRecord] {
    allAttendance().filter(func(r : AttendanceRecord) : Bool { r.monthStr == monthStr });
  };

  public shared func updateAttendanceRecord(
    id : Nat, name : Text, slot : Text,
    dateStr : Text, monthStr : Text, timeStr : Text
  ) : async () {
    switch (attendance.get(id)) {
      case (null) Runtime.trap("Record not found");
      case (?r) {
        attendance.remove(id);
        attendance.add(id, {
          id = r.id; personId = r.personId;
          name = if (name == "") r.name else name;
          personType = r.personType;
          slot = if (slot == "") r.slot else slot;
          timestamp = r.timestamp;
          dateStr = if (dateStr == "") r.dateStr else dateStr;
          monthStr = if (monthStr == "") r.monthStr else monthStr;
          timeStr = if (timeStr == "") r.timeStr else timeStr;
          year = r.year; month = r.month; day = r.day;
          editedAt = ?Time.now();
        });
      };
    };
  };

  public shared func deleteAttendanceRecord(id : Nat) : async () {
    attendance.remove(id);
  };

  public query func hasAttendedSlot(personId : Nat, slot : Text, dateStr : Text) : async Bool {
    allAttendance().filter(
      func(r : AttendanceRecord) : Bool {
        r.personId == personId and r.slot == slot and r.dateStr == dateStr;
      }
    ).size() > 0;
  };

  public query func getStats() : async Stats {
    let arr = allAttendance();
    var uniqueMonths : [Text] = [];
    for (r in arr.vals()) {
      let m = r.monthStr;
      let exists = uniqueMonths.filter(func(um : Text) : Bool { um == m }).size() > 0;
      if (not exists) {
        let old = uniqueMonths;
        uniqueMonths := Array.tabulate<Text>(old.size() + 1, func(i : Nat) : Text {
          if (i < old.size()) old[i] else m;
        });
      };
    };
    {
      totalPersons = persons.size();
      totalAttendance = attendance.size();
      todayCheckins = 0;
      activeMonths = uniqueMonths;
    };
  };

  public query func getTodayCheckins(dateStr : Text) : async Nat {
    allAttendance().filter(func(r : AttendanceRecord) : Bool { r.dateStr == dateStr }).size();
  };
};
