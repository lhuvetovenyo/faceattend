import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Nat64 "mo:core/Nat64";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Blob "mo:core/Blob";
import Char "mo:core/Char";
import Iter "mo:core/Iter";
import PersonTypes "types/persons";
import AttendanceTypes "types/attendance";
import PersonsApi "mixins/persons-api";
import AttendanceApi "mixins/attendance-api";
import StatsApi "mixins/stats-api";



actor {
  let persons = List.empty<PersonTypes.Person>();
  let attendanceRecords = List.empty<AttendanceTypes.AttendanceRecord>();
  let state = { var nextPersonId = 0; var nextAttendanceId = 0 };

  include PersonsApi(persons, attendanceRecords, state);
  include AttendanceApi(attendanceRecords, persons, state);
  include StatsApi(attendanceRecords, persons);

  public shared func clearAllData() : async () {
    persons.clear();
    attendanceRecords.clear();
    state.nextPersonId := 0;
    state.nextAttendanceId := 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Google Sheets HTTP outcall logic — MUST live directly in the actor so
  // IC can locate the transform functions by reference during consensus.
  // ─────────────────────────────────────────────────────────────────────────

  let SHEET_ID = "1UJik3vxfsLJfEgiCvNSUjeyIwP-g83Qxoenl2-4LX-M";

  type HttpHeader = { name : Text; value : Text };

  type HttpResponsePayload = {
    status : Nat;
    headers : [HttpHeader];
    body : Blob;
  };

  type TransformArgs = {
    response : HttpResponsePayload;
    context : Blob;
  };

  type TransformContext = {
    function : shared query (TransformArgs) -> async HttpResponsePayload;
    context : Blob;
  };

  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?Blob;
    method : { #get; #post; #head; #put };
    transform : ?TransformContext;
    is_replicated : ?Bool;
  };

  type IC = actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  };

  // ── Transform functions — declared directly in actor for IC consensus ─────

  // Token exchange: keep body so we can extract access_token; strip headers
  public shared query func transformTokenResponse(raw : TransformArgs) : async HttpResponsePayload {
    { status = raw.response.status; headers = []; body = raw.response.body }
  };

  // Sheets write: keep status and body so errors are visible; only strip headers
  public shared query func transformSheetsResponse(raw : TransformArgs) : async HttpResponsePayload {
    { status = raw.response.status; headers = []; body = raw.response.body }
  };

  // batchUpdate (borders): strip headers, keep body for error visibility
  public shared query func transformBatchUpdateResponse(raw : TransformArgs) : async HttpResponsePayload {
    { status = raw.response.status; headers = []; body = raw.response.body }
  };

  // ── Private helpers ───────────────────────────────────────────────────────

  func findSubstring(haystack : Text, needle : Text) : Int {
    let h = haystack.chars().toArray();
    let n = needle.chars().toArray();
    let hLen = h.size();
    let nLen = n.size();
    if (nLen == 0) return 0;
    if (hLen < nLen) return -1;
    var i = 0;
    while (i + nLen <= hLen) {
      var match_ = true;
      var j = 0;
      while (j < nLen) {
        if (h[i + j] != n[j]) { match_ := false };
        j += 1;
      };
      if (match_) return i;
      i += 1;
    };
    -1
  };

  func extractAccessToken(json : Text) : ?Text {
    let markerFull = "\"access_token\":\"";
    let idx = findSubstring(json, markerFull);
    if (idx < 0) return null;
    let chars = json.chars().toArray();
    let startPos = Int.abs(idx) + markerFull.size();
    var k = startPos;
    var token = "";
    while (k < chars.size() and chars[k].toNat32() != 34) {
      token := token # chars[k].toText();
      k += 1;
    };
    if (token == "") null else ?token
  };

  func escapeJsonStr(s : Text) : Text {
    var result = "";
    for (c in s.chars()) {
      let code = c.toNat32();
      if (code == 34) { result := result # "\\\"" }
      else if (code == 92) { result := result # "\\\\" }
      else if (code == 10) { result := result # "\\n" }
      else if (code == 13) { result := result # "\\r" }
      else { result := result # c.toText() };
    };
    result
  };

  func buildValuesJson(values : [Text]) : Text {
    var inner = "";
    var first = true;
    for (v in values.vals()) {
      if (not first) { inner := inner # "," };
      inner := inner # "\"" # escapeJsonStr(v) # "\"";
      first := false;
    };
    "[" # inner # "]"
  };

  func encodeForUrl(name : Text) : Text {
    var result = "";
    for (c in name.chars()) {
      let code = c.toNat32();
      if (code == 32) { result := result # "%20" }
      else if (code == 47) { result := result # "%2F" }
      else if (code == 58) { result := result # "%3A" }
      else if (code == 40) { result := result # "%28" }
      else if (code == 41) { result := result # "%29" }
      else { result := result # c.toText() };
    };
    result
  };

  func getAccessToken(jwt : Text) : async Text {
    let reqBody = "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" # jwt;
    let request : HttpRequestArgs = {
      url = "https://oauth2.googleapis.com/token";
      max_response_bytes = ?Nat64.fromNat(3000);
      headers = [{ name = "Content-Type"; value = "application/x-www-form-urlencoded" }];
      body = ?reqBody.encodeUtf8();
      method = #post;
      transform = ?{ function = transformTokenResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    let response = await (with cycles = 230_949_972_000) ic.http_request(request);
    let responseText = switch (response.body.decodeUtf8()) {
      case (?t) { t };
      case null { "" };
    };
    switch (extractAccessToken(responseText)) {
      case (?token) { token };
      case null { "ERROR:failed_to_get_token:" # responseText };
    };
  };

  func createSheetTab(accessToken : Text, sheetName : Text) : async () {
    let bodyJson = "{\"requests\":[{\"addSheet\":{\"properties\":{\"title\":\"" # escapeJsonStr(sheetName) # "\"}}}]}";
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # ":batchUpdate";
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(2048);
      headers = [
        { name = "Authorization"; value = "Bearer " # accessToken },
        { name = "Content-Type"; value = "application/json" },
      ];
      body = ?bodyJson.encodeUtf8();
      method = #post;
      transform = ?{ function = transformSheetsResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    // ignore result — 400 means tab already exists, which is fine
    ignore await (with cycles = 230_949_972_000) ic.http_request(request);
  };

  // Append a new row to a sheet tab
  // Append a new row to a sheet tab
  func appendSheetRow(accessToken : Text, sheetName : Text, rowValues : [Text]) : async Text {
    let valuesJson = buildValuesJson(rowValues);
    let bodyJson = "{\"values\":[" # valuesJson # "]}";
    let encodedName = encodeForUrl(sheetName);
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # "/values/" # encodedName # ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(4096);
      headers = [
        { name = "Authorization"; value = "Bearer " # accessToken },
        { name = "Content-Type"; value = "application/json" },
      ];
      body = ?bodyJson.encodeUtf8();
      method = #post;
      transform = ?{ function = transformSheetsResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    let response = await (with cycles = 230_949_972_000) ic.http_request(request);
    let body = switch (response.body.decodeUtf8()) { case (?t) t; case null "" };
    if (response.status >= 200 and response.status < 300) {
      "ok:" # response.status.toText()
    } else {
      "ERROR:append_failed:status=" # response.status.toText() # ":" # body
    }
  };

  // Update an existing row at the given 1-based row number
  // Update an existing row at the given 1-based row number
  func updateSheetRow(accessToken : Text, sheetName : Text, rowNum : Nat, rowValues : [Text], numCols : Nat) : async Text {
    let valuesJson = buildValuesJson(rowValues);
    let bodyJson = "{\"values\":[" # valuesJson # "]}";
    // Convert numCols to a column letter (A=1, B=2, ..., J=10)
    let lastCol = switch (numCols) {
      case 10 { "J" };
      case 9  { "I" };
      case 8  { "H" };
      case 7  { "G" };
      case 6  { "F" };
      case 5  { "E" };
      case 4  { "D" };
      case 3  { "C" };
      case 2  { "B" };
      case _  { "A" };
    };
    let rowStr = rowNum.toText();
    let range = encodeForUrl(sheetName # "!A" # rowStr # ":" # lastCol # rowStr);
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # "/values/" # range # "?valueInputOption=USER_ENTERED";
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(4096);
      headers = [
        { name = "Authorization"; value = "Bearer " # accessToken },
        { name = "Content-Type"; value = "application/json" },
      ];
      body = ?bodyJson.encodeUtf8();
      method = #put;
      transform = ?{ function = transformSheetsResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    let response = await (with cycles = 230_949_972_000) ic.http_request(request);
    let body = switch (response.body.decodeUtf8()) { case (?t) t; case null "" };
    if (response.status >= 200 and response.status < 300) {
      "ok:" # response.status.toText()
    } else {
      "ERROR:update_failed:status=" # response.status.toText() # ":" # body
    }
  };

  // Read column A of a sheet tab to find which row a student name appears in (1-based)
  // Returns 0 if not found, or the row number (row 1 = header)
  // Read column A of a sheet tab to find which row a student name appears in (1-based)
  // Returns 0 if not found, or the row number (row 1 = header, data starts at row 2)
  func findStudentRowByName(accessToken : Text, sheetName : Text, studentName : Text) : async Nat {
    let encodedName = encodeForUrl(sheetName # "!A:A");
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # "/values/" # encodedName;
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(8192);
      headers = [{ name = "Authorization"; value = "Bearer " # accessToken }];
      body = null;
      method = #get;
      transform = ?{ function = transformSheetsResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    let response = await (with cycles = 230_949_972_000) ic.http_request(request);
    let body = switch (response.body.decodeUtf8()) { case (?t) t; case null "" };
    // Parse names from the values array in the response JSON
    // Response looks like: {"range":"...","values":[["Name"],["Alice"],["Bob"]]}
    var rowIndex = 0;
    var found = 0;
    let valuesMarker = "\"values\":";
    let markerIdx = findSubstring(body, valuesMarker);
    if (markerIdx < 0) return 0;
    let startPos = Int.abs(markerIdx) + valuesMarker.size();
    let chars = body.chars().toArray();
    let bodyLen = chars.size();
    var i = startPos;
    // iterate through [["val"],["val"],...] structure
    while (i < bodyLen and found == 0) {
      // skip to next '['
      while (i < bodyLen and chars[i].toNat32() != 91) { i += 1 };
      if (i >= bodyLen) { i := bodyLen } // exit
      else {
        i += 1; // skip '['
        rowIndex += 1;
        // skip to opening '"'
        while (i < bodyLen and chars[i].toNat32() != 34) { i += 1 };
        if (i < bodyLen) {
          i += 1; // skip '"'
          var cellValue = "";
          while (i < bodyLen and chars[i].toNat32() != 34) {
            cellValue := cellValue # chars[i].toText();
            i += 1;
          };
          if (cellValue == studentName and rowIndex > 1) {
            // row 1 is headers, data starts at row 2
            found := rowIndex;
          };
        };
        // skip to closing ']'
        while (i < bodyLen and chars[i].toNat32() != 93) { i += 1 };
        if (i < bodyLen) { i += 1 }; // skip ']'
      };
    };
    found
  };

  func _getDayLabel(_date : Text) : Text {
    let now = Time.now();
    let secondsSinceEpoch = Int.abs(now) / 1_000_000_000;
    let daysSinceEpoch = secondsSinceEpoch / 86400;
    let dayOfWeek = (daysSinceEpoch + 4) % 7;
    switch (dayOfWeek) {
      case 0 { "Sunday" };
      case 1 { "Monday" };
      case 2 { "Tuesday" };
      case 3 { "Wednesday" };
      case 4 { "Thursday" };
      case 5 { "Friday" };
      case 6 { "Saturday" };
      case _ { "Unknown" };
    }
  };


  // Extract the first quoted string from a JSON array like ["Alice","001",...]
  // Extract the first quoted string from a JSON array like ["Alice","001",...]
  func extractFirstJsonString(json : Text) : Text {
    let chars = json.chars().toArray();
    let len = chars.size();
    var i = 0;
    // skip to first '"'
    while (i < len and chars[i].toNat32() != 34) { i += 1 };
    if (i >= len) return "";
    i += 1; // skip opening quote
    var result = "";
    while (i < len and chars[i].toNat32() != 34) {
      result := result # chars[i].toText();
      i += 1;
    };
    result
  };

  // Parse a JSON array of strings ["a","b",...] into [Text]
  // Parse a JSON array of strings ["a","b",...] into [Text]
  func parseJsonStringArray(json : Text) : [Text] {
    let chars = json.chars().toArray();
    let len = chars.size();
    let results = List.empty<Text>();
    var i = 0;
    while (i < len) {
      // find next '"'
      while (i < len and chars[i].toNat32() != 34) { i += 1 };
      if (i < len) {
        i += 1; // skip opening quote
        var cell = "";
        // handle escape sequences
        while (i < len and chars[i].toNat32() != 34) {
          if (chars[i].toNat32() == 92 and i + 1 < len) {
            i += 1; // skip backslash
            let escaped = chars[i];
            let ec = escaped.toNat32();
            if (ec == 110) { cell := cell # "\n" }
            else if (ec == 114) { cell := cell # "\r" }
            else if (ec == 116) { cell := cell # "\t" }
            else { cell := cell # escaped.toText() };
          } else {
            cell := cell # chars[i].toText();
          };
          i += 1;
        };
        results.add(cell);
        if (i < len) { i += 1 }; // skip closing quote
      };
    };
    results.toArray()
  };

  // Check if header row exists by reading cell A1 directly.
  // findStudentRowByName skips row 1, so it cannot be used for header detection.
  func checkHeaderExists(accessToken : Text, sheetName : Text) : async Bool {
    let encodedRange = encodeForUrl(sheetName # "!A1:A1");
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # "/values/" # encodedRange;
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(512);
      headers = [{ name = "Authorization"; value = "Bearer " # accessToken }];
      body = null;
      method = #get;
      transform = ?{ function = transformSheetsResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    let response = await (with cycles = 230_949_972_000) ic.http_request(request);
    let body = switch (response.body.decodeUtf8()) { case (?t) t; case null "" };
    // Response contains "values" key only when A1 is non-empty
    let hasValues = findSubstring(body, "\"values\"") >= 0;
    if (not hasValues) return false;
    // Extract the cell value and check it equals "Name"
    let nameIdx = findSubstring(body, "\"Name\"");
    nameIdx >= 0
  };

  // Get the numeric sheetId for a tab name by calling spreadsheets.get
  func getNumericSheetId(accessToken : Text, tabName : Text) : async ?Nat {
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # "?fields=sheets.properties";
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(8192);
      headers = [{ name = "Authorization"; value = "Bearer " # accessToken }];
      body = null;
      method = #get;
      transform = ?{ function = transformSheetsResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    let response = await (with cycles = 230_949_972_000) ic.http_request(request);
    let body = switch (response.body.decodeUtf8()) { case (?t) t; case null "" };
    // Parse sheetId from JSON structure:
    // {"sheets":[{"properties":{"sheetId":0,"title":"..."}},{...}]}
    // We scan for "title":"<tabName>" then backtrack to find "sheetId":<number>
    let titleMarker = "\"title\":\"" # escapeJsonStr(tabName) # "\"";
    let titleIdx = findSubstring(body, titleMarker);
    if (titleIdx < 0) return null;
    // Search backwards from titleIdx for "sheetId":
    let sheetIdMarker = "\"sheetId\":";
    // Look in the slice before titleIdx for the last occurrence of sheetIdMarker
    let prefix = if (Int.abs(titleIdx) > 200) {
      // take up to 200 chars before title
      let chars = body.chars().toArray();
      var start = Int.abs(titleIdx);
      if (start > 200) { start -= 200 };
      var s = "";
      var ci = start;
      while (ci < Int.abs(titleIdx)) {
        s := s # chars[ci].toText();
        ci += 1;
      };
      s
    } else {
      let chars = body.chars().toArray();
      var s = "";
      var ci = 0;
      while (ci < Int.abs(titleIdx)) {
        s := s # chars[ci].toText();
        ci += 1;
      };
      s
    };
    let sidIdx = findSubstring(prefix, sheetIdMarker);
    if (sidIdx < 0) return null;
    let afterMarker = Int.abs(sidIdx) + sheetIdMarker.size();
    let pChars = prefix.chars().toArray();
    var numStr = "";
    var ni = afterMarker;
    while (ni < pChars.size()) {
      let code = pChars[ni].toNat32();
      if (code >= 48 and code <= 57) {
        numStr := numStr # pChars[ni].toText();
        ni += 1;
      } else { ni := pChars.size() }; // break
    };
    if (numStr == "") return null;
    Nat.fromText(numStr)
  };

  // Apply SOLID borders to a row (0-indexed rowIndex) in the given sheet (by numeric sheetId).
  // numCols is the number of columns (e.g. 10 for NSQF, 9 for JIG).
  // Errors are silently ignored so the main sync flow is not affected.
  func applyBordersToRange(accessToken : Text, numericSheetId : Nat, rowIndex : Nat, numCols : Nat) : async () {
    let sidText = numericSheetId.toText();
    let startRow = rowIndex.toText();
    let endRow = (rowIndex + 1).toText();
    let endCol = numCols.toText();
    let borderObj = "{\"style\":\"SOLID\",\"color\":{\"red\":0,\"green\":0,\"blue\":0,\"alpha\":1}}";
    let bodyJson = "{\"requests\":[{\"repeatCell\":{\"range\":{\"sheetId\":" # sidText # ",\"startRowIndex\":" # startRow # ",\"endRowIndex\":" # endRow # ",\"startColumnIndex\":0,\"endColumnIndex\":" # endCol # "},\"cell\":{\"userEnteredFormat\":{\"borders\":{\"top\":" # borderObj # ",\"bottom\":" # borderObj # ",\"left\":" # borderObj # ",\"right\":" # borderObj # "}}},\"fields\":\"userEnteredFormat.borders\"}}]}";
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # SHEET_ID # ":batchUpdate";
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(2048);
      headers = [
        { name = "Authorization"; value = "Bearer " # accessToken },
        { name = "Content-Type"; value = "application/json" },
      ];
      body = ?bodyJson.encodeUtf8();
      method = #post;
      transform = ?{ function = transformBatchUpdateResponse; context = Blob.fromArray([]) };
      is_replicated = ?false;
    };
    let ic : IC = actor "aaaaa-aa";
    ignore await (with cycles = 230_949_972_000) ic.http_request(request);
  };

  // ── Public Sheets API ─────────────────────────────────────────────────────

  // Sync a single attendance record to Google Sheets using a JWT signed by the frontend
  // Sync a row to Google Sheets. rowDataJson is a JSON array of strings.
  // sheetTabName is the target tab (e.g. "NSQF - 14/05/2026 (Thursday)").
  // Sync a row to Google Sheets. rowDataJson is a JSON array of strings.
  // sheetTabName is the target tab (e.g. "NSQF - 14/05/2026 (Thursday)").
  // On first call for a student (per day tab), writes headers then appends new row.
  // On subsequent calls, finds the student's row and updates it in place.
  public func syncAttendanceWithJwt(jwt : Text, rowDataJson : Text, sheetTabName : Text) : async Text {
    // Step 1: get access token
    let accessToken = await getAccessToken(jwt);
    if (accessToken.size() == 0 or accessToken.startsWith(#text "ERROR")) {
      return "Error at step 1 (get token): " # accessToken;
    };

    // Step 2: ensure the sheet tab exists
    await createSheetTab(accessToken, sheetTabName);

    // Step 3: determine headers based on tab name (NSQF vs JIG)
    let isNsqf = sheetTabName.startsWith(#text "NSQF");
    let headers : [Text] = if (isNsqf) {
      ["Name", "Roll No", "NSQF Level", "Semester", "Entry", "Break", "After Break", "Exit", "Date", "Day"]
    } else {
      ["Name", "Roll No", "Course", "Entry", "Break", "After Break", "Exit", "Date", "Day"]
    };
    let numCols = headers.size();

    // Step 4: parse the student name from rowDataJson (first element in the JSON array)
    let studentName = extractFirstJsonString(rowDataJson);

    // Step 5: get the numeric sheetId (needed for batchUpdate borders)
    let numericSheetIdOpt = await getNumericSheetId(accessToken, sheetTabName);

    // Step 6: check if the header row exists; if not, write it first
    let headersExist = await checkHeaderExists(accessToken, sheetTabName);
    if (not headersExist) {
      ignore await appendSheetRow(accessToken, sheetTabName, headers);
      // Apply borders to header row (row index 0)
      switch (numericSheetIdOpt) {
        case (?sid) { await applyBordersToRange(accessToken, sid, 0, numCols) };
        case null {};
      };
    };

    // Step 7: check if student already has a row — read column A
    let existingRow = await findStudentRowByName(accessToken, sheetTabName, studentName);

    // Step 8: parse the complete row values from rowDataJson
    let rowValues = parseJsonStringArray(rowDataJson);

    if (existingRow > 0) {
      // Update student's existing row in place
      let updateResult = await updateSheetRow(accessToken, sheetTabName, existingRow, rowValues, numCols);
      if (updateResult.startsWith(#text "ok:")) {
        // Apply borders to the updated row (existingRow is 1-based, rowIndex is 0-based)
        switch (numericSheetIdOpt) {
          case (?sid) { await applyBordersToRange(accessToken, sid, existingRow - 1, numCols) };
          case null {};
        };
        "ok:updated row " # existingRow.toText() # " for " # studentName # " in " # sheetTabName
      } else {
        "Error at step 8 (update row): " # updateResult
      }
    } else {
      // Append new student row
      let appendResult = await appendSheetRow(accessToken, sheetTabName, rowValues);
      if (appendResult.startsWith(#text "ok:")) {
        // New rows are appended after header; find the row we just wrote
        // Re-query to get the actual row number for border application
        let newRow = await findStudentRowByName(accessToken, sheetTabName, studentName);
        if (newRow > 0) {
          switch (numericSheetIdOpt) {
            case (?sid) { await applyBordersToRange(accessToken, sid, newRow - 1, numCols) };
            case null {};
          };
        };
        "ok:appended new row for " # studentName # " in " # sheetTabName
      } else {
        "Error at step 8 (append row): " # appendResult
      }
    }
  };

  // Send a test row to verify Google Sheets sync works end-to-end
  // Send a test row to verify Google Sheets sync works end-to-end
  // Send a test row to verify Google Sheets sync works end-to-end
  public func testGoogleSheetsSync(jwt : Text) : async Text {
    // Step 1: get access token
    let accessToken = await getAccessToken(jwt);
    if (accessToken.size() == 0 or accessToken.startsWith(#text "ERROR")) {
      return "FAILED at step 1 (get token): " # accessToken;
    };

    // Fixed permanent tab for testing — never date-suffixed
    let testTabName = "Test Sheet";

    // Step 2: create tab if needed
    await createSheetTab(accessToken, testTabName);

    // Step 3: write headers if not present
    let nsqfHeaders : [Text] = ["Name", "Roll No", "NSQF Level", "Semester", "Entry", "Break", "After Break", "Exit", "Date", "Day"];
    let headersExist = await checkHeaderExists(accessToken, testTabName);
    if (not headersExist) {
      ignore await appendSheetRow(accessToken, testTabName, nsqfHeaders);
    };

    // Step 4: write test data row
    let testRow : [Text] = ["Test Student", "001", "Level-III", "1st Semester", "08:55", "12:01", "12:27", "15:30", "(test date)", "(test day)"];
    let writeResult = await appendSheetRow(accessToken, testTabName, testRow);
    if (writeResult.startsWith(#text "ok:")) {
      "SUCCESS: test row written to Google Sheets tab: " # testTabName # " | response: " # writeResult
    } else {
      "FAILED at step 4 (write sheet): " # writeResult
    }
  };

};
