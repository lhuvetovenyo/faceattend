import List "mo:core/List";
import Types "../types/persons";
import AttendanceTypes "../types/attendance";

module {
  public func addPerson(
    persons : List.List<Types.Person>,
    state   : { var nextPersonId : Nat },
    input   : Types.PersonInput
  ) : Types.Person {
    let id = state.nextPersonId;
    state.nextPersonId += 1;
    let person : Types.Person = {
      id           = id.toText();
      name         = input.name;
      personType   = input.personType;
      rollNo       = input.rollNo;
      nsqfLevel    = input.nsqfLevel;
      semester     = input.semester;
      course       = input.course;
      faceDescriptor = input.faceDescriptor;
    };
    persons.add(person);
    person
  };

  public func getPerson(
    persons : List.List<Types.Person>,
    id      : Text
  ) : ?Types.Person {
    persons.find(func(p) { p.id == id })
  };

  public func updatePerson(
    persons : List.List<Types.Person>,
    id      : Text,
    input   : Types.PersonInput
  ) : ?Types.Person {
    var result : ?Types.Person = null;
    persons.mapInPlace(
      func(p) {
        if (p.id == id) {
          let updated : Types.Person = {
            p with
            name           = input.name;
            personType     = input.personType;
            rollNo         = input.rollNo;
            nsqfLevel      = input.nsqfLevel;
            semester       = input.semester;
            course         = input.course;
            faceDescriptor = input.faceDescriptor;
          };
          result := ?updated;
          updated
        } else { p }
      }
    );
    result
  };

  public func deletePerson(
    persons            : List.List<Types.Person>,
    attendanceRecords  : List.List<AttendanceTypes.AttendanceRecord>,
    id                 : Text
  ) : Bool {
    let sizeBefore = persons.size();
    let kept = persons.filter(func(p) { p.id != id });
    persons.clear();
    persons.append(kept);
    // Cascade-delete all attendance records belonging to this person
    let keptAttendance = attendanceRecords.filter(func(r) { r.personId != id });
    attendanceRecords.clear();
    attendanceRecords.append(keptAttendance);
    persons.size() < sizeBefore
  };

  public func listPersons(
    persons : List.List<Types.Person>
  ) : [Types.Person] {
    persons.toArray()
  };

  public func getAllFaceDescriptors(
    persons : List.List<Types.Person>
  ) : [(Text, [Float])] {
    persons.map<Types.Person, (Text, [Float])>(
      func(p) { (p.id, p.faceDescriptor) }
    ).toArray()
  };
};
