module {
  public type PersonType = {
    #NSQF;
    #JIG;
  };

  public type Person = {
    id : Text;
    name : Text;
    personType : PersonType;
    rollNo : ?Text;
    nsqfLevel : ?Text;
    semester : ?Text;
    course : ?Text;
    faceDescriptor : [Float];
  };

  public type PersonInput = {
    name : Text;
    personType : PersonType;
    rollNo : ?Text;
    nsqfLevel : ?Text;
    semester : ?Text;
    course : ?Text;
    faceDescriptor : [Float];
  };

  public type FaceDescriptorEntry = {
    personId : Text;
    faceDescriptor : [Float];
  };
};
