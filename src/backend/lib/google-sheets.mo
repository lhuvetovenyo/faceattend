import Cycles "mo:base/ExperimentalCycles";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Blob "mo:base/Blob";
import Char "mo:base/Char";
import Iter "mo:base/Iter";
import Int "mo:base/Int";

module GoogleSheets {

  public type HttpHeader = {
    name : Text;
    value : Text;
  };

  public type HttpResponsePayload = {
    status : Nat;
    headers : [HttpHeader];
    body : Blob;
  };

  public type TransformArgs = {
    response : HttpResponsePayload;
    context : Blob;
  };

  public type TransformContext = {
    function : shared query (TransformArgs) -> async HttpResponsePayload;
    context : Blob;
  };

  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?Blob;
    method : { #get; #post; #head };
    transform : ?TransformContext;
  };

  type IC = actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  };

  let ic : IC = actor "aaaaa-aa";

  func findSubstring(haystack : Text, needle : Text) : Int {
    let h = Iter.toArray(haystack.chars());
    let n = Iter.toArray(needle.chars());
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
    let chars = Iter.toArray(json.chars());
    var k = 0;
    let startPos = Int.abs(idx) + markerFull.size();
    k := startPos;
    var token = "";
    while (k < chars.size() and Char.toNat32(chars[k]) != 34) {
      token := token # Char.toText(chars[k]);
      k += 1;
    };
    if (token == "") null else ?token
  };

  func escapeJsonStr(s : Text) : Text {
    var result = "";
    for (c in s.chars()) {
      let code = Char.toNat32(c);
      if (code == 34) { result := result # "\\\"" }
      else if (code == 92) { result := result # "\\\\" }
      else if (code == 10) { result := result # "\\n" }
      else if (code == 13) { result := result # "\\r" }
      else { result := result # Char.toText(c) };
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
      let code = Char.toNat32(c);
      if (code == 32) { result := result # "%20" }
      else if (code == 47) { result := result # "%2F" }
      else if (code == 58) { result := result # "%3A" }
      else if (code == 40) { result := result # "%28" }
      else if (code == 41) { result := result # "%29" }
      else { result := result # Char.toText(c) };
    };
    result
  };

  public func getAccessToken(
    jwt : Text,
    transformFn : shared query (TransformArgs) -> async HttpResponsePayload
  ) : async Text {
    let reqBody = "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" # jwt;
    let request : HttpRequestArgs = {
      url = "https://oauth2.googleapis.com/token";
      max_response_bytes = ?Nat64.fromNat(3000);
      headers = [{ name = "Content-Type"; value = "application/x-www-form-urlencoded" }];
      body = ?Text.encodeUtf8(reqBody);
      method = #post;
      transform = ?{ function = transformFn; context = Text.encodeUtf8("") };
    };
    Cycles.add<system>(230_949_972_000);
    let response = await ic.http_request(request);
    let responseText = switch (Text.decodeUtf8(response.body)) {
      case (?t) { t };
      case null { "" };
    };
    switch (extractAccessToken(responseText)) {
      case (?token) { token };
      case null { "ERROR:failed_to_get_token:" # responseText };
    };
  };

  public func writeSheetRow(
    accessToken : Text,
    sheetId : Text,
    sheetName : Text,
    rowValues : [Text],
    transformFn : shared query (TransformArgs) -> async HttpResponsePayload
  ) : async Text {
    let valuesJson = buildValuesJson(rowValues);
    let bodyJson = "{\"values\":[" # valuesJson # "]}";
    let encodedName = encodeForUrl(sheetName);
    let url = "https://sheets.googleapis.com/v4/spreadsheets/" # sheetId # "/values/" # encodedName # ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(2000);
      headers = [
        { name = "Authorization"; value = "Bearer " # accessToken },
        { name = "Content-Type"; value = "application/json" },
      ];
      body = ?Text.encodeUtf8(bodyJson);
      method = #post;
      transform = ?{ function = transformFn; context = Text.encodeUtf8("") };
    };
    Cycles.add<system>(230_949_972_000);
    let response = await ic.http_request(request);
    if (response.status >= 200 and response.status < 300) {
      "ok"
    } else {
      let respText = switch (Text.decodeUtf8(response.body)) {
        case (?t) { t };
        case null { "(no body)" };
      };
      "ERROR:sheets_write_failed:status=" # Nat.toText(response.status) # ":" # respText
    };
  };
};
