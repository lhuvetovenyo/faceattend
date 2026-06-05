module {
  public type AttendanceRecord = {
    id : Text;
    personId : Text;
    date : Text;         // YYYY-MM-DD
    entry : ?Text;       // HH:MM
    breakTime : ?Text;   // HH:MM
    afterBreak : ?Text;  // HH:MM
    exit : ?Text;        // HH:MM
  };

  public type AttendanceUpdateInput = {
    entry : ?Text;
    breakTime : ?Text;
    afterBreak : ?Text;
    exit : ?Text;
  };
};
