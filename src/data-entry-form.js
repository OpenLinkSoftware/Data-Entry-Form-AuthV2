// --------------------------------------------------------------------------
// Globals

var gAppState;
var solidClient; // an alias for solidClientAuthentication
var limit;
var offset;
var tableSize;
var resultMode;

// --------------------------------------------------------------------------
// class AppState: Start

class AppState {
  constructor() {
    this.solid_storage = null;
    this.is_solid_id = false;
    this.webid = null;
    this.initialTab = "";
    this.initialSubject = "";
    this.initialPredicate = "";
    this.initialObject = "";
    this.initialDocumentName = "";
    this.initialEndpoint = "";
    this.lastState = { tab: "ap", documentName: "" };
  }

  async updateLoginState() {
    console.log('AppState#updateLoginState...');
    const loginButton = DOC.iSel('loginID');
    const logoutButton = DOC.iSel('logoutID');
    const elUserIconAnc = DOC.iSel('loggedin_user_icon_anc');

    // getDefaultSession:
    // See https://docs.inrupt.com/developer-tools/api/javascript/solid-client-authn-browser/functions.html#getdefaultsession
    const session = await solidClient.getDefaultSession()
    const loggedIn = (session && session.info && session.info.isLoggedIn);
    console.log('AppState#updateLoginState: session:', session);
    console.log('AppState#updateLoginState: loggedIn:', loggedIn);

    loginButton.classList.toggle('hidden', loggedIn)
    logoutButton.classList.toggle('hidden', !loggedIn)
    if (loggedIn) {
      var webid = session.info.webId;
      if (webid) {
        this.webid = webid;

        // Show user icon to indicate user is logged in
        elUserIconAnc.classList.remove('hidden')
        elUserIconAnc.href = webid
        elUserIconAnc.title = webid

        // Load user's profile data from their WebID
        var rc = await loadProfile(webid);
        if (rc) {
          this.solid_storage = rc.store;
          this.is_solid_id = rc.is_solid_id;
        } else {
          this.solid_storage = null;
          this.is_solid_id = false;
        }
        sessionStorage.setItem('solid_storage', this.solid_storage);
        this.docNameValue();
        resolveOutBox();
      }
    } else {
      this.webid = null;

      // Hide user icon as user is not logged in
      elUserIconAnc.classList.add('hidden')
      elUserIconAnc.href = ''
      elUserIconAnc.title = ''

      this.solid_storage = null;
      this.is_solid_id = false;
      sessionStorage.removeItem('solid_storage');
    }
    click_updateTable();
  }

  loadPermalink() {
    this.resetPermalink();

    try {
      var lastState = JSON.parse(sessionStorage.getItem('lastState'))
      if (lastState)
        this.lastState = lastState;

      if (!this.lastState.tab && (this.lastState.tab !== "dbms" || this.lastState.tab !== "fs" || this.lastState.tab !== "ap"))
        this.lastState.tab = "ap";

      if (this.lastState.endpoint)
        DOC.iSel("sparql_endpoint").value = this.lastState.endpoint;

    } catch (e) {
      console.log('Error restoring last state from session storage');
    }

    var queryString = window.location.search;
    var params = new URLSearchParams(queryString);
    var setInputs = params.get("setInputs");

    if (setInputs == "true") {
      this.initialTab = decodeURIComponent(params.get("tab"));
      this.initialSubject = decodeURIComponent(params.get("subject"));
      this.initialPredicate = decodeURIComponent(params.get("predicate"));
      this.initialObject = decodeURIComponent(params.get("object"));
      this.initialDocumentName = decodeURIComponent(params.get("documentName"));
      this.initialEndpoint = decodeURIComponent(params.get("endpoint"));
      this.handlePermalink();

      if (this.initialTab === "ap")
        $('a[href="#apID"]').tab('show');
      else if (this.initialTab === "dbms")
        $('a[href="#dbmsID"]').tab('show');
      else if (this.initialTab === "fs")
        $('a[href="#fsID"]').tab('show');
    }
    else {
      var documentName;
      DOC.iSel('apObjectID').innerHTML =
            '{\n' +
            '  "@context": "https://www.w3.org/ns/activitystreams",\n' +
            '  "type": "Note",\n' +
            '  "summary":null,\n' +
            '  "content": ""\n' +
            '}';
      document.getElementById('login_custom_idp').value = globals.host;
      document.getElementById('docNameID2').value = globals.dav_link;
      document.getElementById('sparql_endpoint').value = globals.sparql_endpoint;
      if (this.getCurTab() === "fs") {
        $('a[href="#fsID"]').tab('show');
      if (this.lastState.documentName)
          document.getElementById('docNameID2').value = this.lastState.documentName;
      } else if (this.getCurTab() === "dbms") {
        $('a[href="#dbmsID"]').tab('show');
        if (this.lastState.documentName)
          document.getElementById('docNameID').value = this.lastState.documentName;
      } else {
        $('a[href="#apID"]').tab('show');
      }
    }

    this.updateLoginState();
  }

  resetPermalink() {
    var permalink = DOC.iSel("permalinkID");
    permalink.href = window.location.href;
  }

  updatePermalink() {
    if (DOC.iSel('dbmsTabID').getAttribute('class') === "active") {
      this.lastState.tab = tab = "dbms";
    } else if (DOC.iSel('fsTabID').getAttribute('class') === "active") {
      this.lastState.tab = tab = "fs";
    } else if (DOC.iSel('apTabID').getAttribute('class') === "active") {
      this.lastState.tab = tab = "ap";
    }

    var permalink = DOC.iSel("permalinkID");
    var subject = this.checkId("subjectID", "subjectID2");
    var predicate = this.checkId("predicateID", "predicateID2");
    var object = this.checkId("objectID", "objectID2");
    var documentName = this.checkId("docNameID", "docNameID2");
    var endpoint = DOC.iSel('sparql_endpoint');
    var tab = "";

    if (endpoint.value)
      this.lastState.endpoint = endpoint.value;

    this.lastState.documentName = documentName.value;
    sessionStorage.setItem('lastState', JSON.stringify(this.lastState));

    var href = window.location.origin + window.location.pathname;
    href += "?setInputs=true&";
    href += "tab=" + encodeURIComponent(tab) + "&";
    href += "subject=" + encodeURIComponent(subject.value) + "&";
    href += "predicate=" + encodeURIComponent(predicate.value) + "&";
    href += "object=" + encodeURIComponent(object.value) + "&";
    href += "documentName=" + encodeURIComponent(documentName.value) + "&";
    href += "endpoint=" + encodeURIComponent(endpoint.value);
    permalink.href = href;
  }


  // Handle the permalink parameters
  handlePermalink() {
    var subject = this.checkPermalinkTab("subjectID", "subjectID2");
    var predicate = this.checkPermalinkTab("predicateID", "predicateID2");
    var object = this.checkPermalinkTab("objectID", "objectID2");
    var documentName = this.checkPermalinkTab("docNameID", "docNameID2");
    var endpoint = DOC.iSel("sparql_endpoint");

    if (this.initialSubject) {
      subject.value = this.initialSubject;
      this.initialSubject = "";
    }
    if (this.initialPredicate) {
      predicate.value = this.initialPredicate;
      this.initialPredicate = "";
    }
    if (this.initialObject) {
      object.value = this.initialObject;
      this.initialObject = "";
    }
    if (this.initialDocumentName) {
      documentName.value = this.initialDocumentName;
      //this.initialDocumentName = "";
    }
    if (this.initialEndpoint) {
      endpoint.value = this.initialEndpoint;
      this.initialEndpoint = "";
    }
  }

  checkPermalinkTab(id1, id2) {
    if (this.initialTab === 'fs')
      return DOC.iSel(id2);
    else
      return DOC.iSel(id1);
  }


  // Gets the Solid storage from window > application > session storage.
  // so it can be used as the document name for functions.
  // The function is called when the page is loaded/reloaded.
  docNameValue() {
    this.solid_storage = sessionStorage.getItem("solid_storage")
    var solid_storage_value = this.solid_storage;

    if (DOC.iSel("cmdID").checked == true) {
      console.log('solid storage: ' + this.solid_storage);
    }

    if (this.solid_storage && this.solid_storage !== "null") {
      DOC.iSel("docNameID").value = solid_storage_value;
      DOC.iSel("docNameID2").value = solid_storage_value;
    } else {
      DOC.iSel("docNameID").value = "urn:records:test";
      DOC.iSel("docNameID2").value = globals.dav_link;
    }

    // value from permalink
    if (this.initialDocumentName !== "" && this.initialTab !== "") {
      var documentName = this.checkPermalinkTab("docNameID", "docNameID2");
      documentName.value = initialDocumentName;
    }
  }

  // Checks which tab the user is in to determine focus of functions
  checkValue(id1, id2) {
    if (this.getCurTab() === "dbms")
      return DOC.iSel(id1).value;
    else
      return DOC.iSel(id2).value;
  }


  // Checks which tab the user is in to determine table to display data (different because of .value)
  checkId(id1, id2) {
    if (this.getCurTab() === "dbms")
      return DOC.iSel(id1);
    else
      return DOC.iSel(id2);
  }


  // Clears subject, predicate, object input fields
  clearInput() {
    if (this.getCurTab() === "dbms") {
      var curDocName = DOC.iSel("docNameID").value; // Stores current value of docName
      DOC.iSel("dbmsFormID").reset(); // Resets entire form
      DOC.iSel("docNameID").value = curDocName; // Added so docname is not reset
    } else if (this.getCurTab() === "fs") {
      var curDocName = DOC.iSel("docNameID2").value;
      DOC.iSel("fsFormID").reset();
      DOC.iSel("docNameID2").value = curDocName;
    }
  }

  getCurTab() {
    return this.lastState.tab;
  }

}

// class AppState: End
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// class DOC: Start

class DOC {
  static qSel(sel) { return document.querySelector(sel) }
  static qSelAll(sel) { return document.querySelectorAll(sel) }
  static iSel(id) { return document.getElementById(id) }
  static qShow(sel) { DOM.qSel(sel).classList.remove('hidden') }
  static qHide(sel) { DOM.qSel(sel).classList.add('hidden') }
  static elShow(sel) { el.classList.remove('hidden') }
  static elHide(sel) { el.classList.add('hidden') }

  static qGetValue(sel) { return DOM.qSel(sel).value }
  static qSetValue(sel, val) { DOM.qSel(sel).value = val }

  static iGetValue(sel) { return DOM.iSel(sel).value }
  static iSetValue(sel, val) { DOM.iSel(sel).value = val }
}

// class DOC: End
// --------------------------------------------------------------------------

//
// These Functions are Used to Display Validation Errors
//

// Function is used to remove input field border color
function setInputColor(id) {
  DOC.iSel(id).className = DOC.iSel(id).className + " error";  // this adds the error class
}

// Function is used to remove input field border color
function removeInputColor(id) {
  DOC.iSel(id).className = "form-control"; // removes error class
}

// Function is used to display error message
function errorMessage(id, error) {
  DOC.iSel(id).innerHTML = error;
}

//
// These Functions Handle the Form Validation
//

// Regular Expression for URIs
const regexp = /(https|http|mailto|tel|dav|ftp|ftps|urn)[:^/s]/i;

function docNameValidation() {
  var str = DOC.iSel("docNameID2").value;

  try {
    if (regexp.test(str)) { //removes error for valid uri
      errorMessage("docNameErrorID2", "");
      removeInputColor('docNameID2');
    } else {
      setInputColor("docNameID2");
      errorMessage("docNameErrorID2", "Document name must be a full uri for patch method");
      throw new Error("Document Name must be a full uri for patch method"); // Throws error because input is not a valid uri
    }
  } catch (e) {
    console.error('Invalid uri', e);
  }
}

// Function checks if input is a blank node
function isBlankNode(str) {
  str = str.trim();
  if (str.charAt(0) == "_" && str.charAt(1) == ":") {
    return str;
  } else if (str.charAt(0) == "[" && str.charAt(str.length - 1) == "]") {
    return str;
  } else {
    return false;
  }
}

// Function checks if input contains a language tag
function langTag(str) {
  const langexp = /@[a-zA-Z][a-zA-Z]/; // regexp for languge tag ex. @en
  if (langexp.test(str)) {
    return true;
  } else {
    return false;
  }
}

// Function formats literal inputs
function formatLiteral(str) {
  if (langTag(str)) { // str has lang tag
    strArray = str.split('@'); // split string at @ so the langtag is removed from string
    str = strArray[0].trim();
    langtag = '@' + strArray[1].trim(); // need to add @ because it is removed by split
    if (str.charAt(0) != '"' && str.charAt(0) != "'") {
      return '"' + str + '"' + langtag
    } else {
      return str + langtag
    }
  } else { // str does not have lang tag
    if (isBlankNode(str)) {
      return str;
    } else if (str.charAt(0) == "'" && str.charAt(str.length - 1) == "'") {
      return str // If string begins and ends with single quote return it as is
    } else if (str.charAt(0) == '"' && str.charAt(str.length - 1) == '"') {
      return str;
    } else if (str.indexOf(' ') >= 0) {
      if (str.charAt(0) != '"' && str.charAt(0) != "'") {
        return '"' + str + '"';
      } else {
        return str;
      }
    } else {
      return '"' + str + '"';
    }
  }
}

// This function formats the Subject input. Comments are inline
function formatSubject() {
  if (gAppState.getCurTab() === "dbms") {
    var str = DOC.iSel("subjectID").value;
  } else if (gAppState.getCurTab() === "fs") {
    var str = DOC.iSel("subjectID2").value;
  }

  if (str.charAt(0) == '<' && str.charAt(str.length - 1) == '>') {
    return str;
  } else if (regexp.test(str) && !isBlankNode(str)) {
    return '<' + str + '>'; // Case: input is a uri. Solution: quote it
  } else if (str.charAt(0) == "#") {
    return '<' + str + '>'; // Case: input is an unquoted relative uri. Solution: quote it
  } else if (str.charAt(0) == '<' && str.charAt(1) == '#' && str.charAt(str.length - 1) == '>') {
    return str; // Case: input is already a relative uri. Solution: return it as is
  } else if (str.includes(":") || str.includes("<#")) {
    return str; // Case: input is a curie. Solution: return it as is
  } else if (str.charAt(0) == "?") {
    return str; // checks if input is a variable for deletion
  }
  else {
    if (isBlankNode(str)) {
      return isBlankNode(str); // Case: input is a blank node. Solution: return it as is
    } else {
      return ':' + str; // Case: input is not a uri or a blank node. Solution: make it a relative uri
    }
  }
}

function validateSubject() {
  var str = gAppState.checkValue("subjectID", "subjectID2");

  try {
    if (gAppState.getCurTab() === "dbms") {
      if (isBlankNode(str)) { // removes error message for complete blank node
        errorMessage("subjectErrorID", "");
        removeInputColor('subjectID');
        return formatSubject();
      } else if (str.includes('"') || str.includes("'")) {
        setInputColor("subjectID");
        errorMessage("subjectErrorID", "Subject cannot contain a literal value unless it is a blank node");
        throw new Error("Subject cannot be a literal value"); // Throws error because input is a literal value
      } else if (str.indexOf(' ') >= 0) {
        setInputColor('subjectID');
        errorMessage("subjectErrorID", "Subject cannot contain spaces unless it is a blank node");
        throw new Error("Subject cannot contain spaces");
      }
      else {
        errorMessage("subjectErrorID", "");
        removeInputColor("subjectID");
        return formatSubject(); // Returns formatted subject because it is valid
      }
    } else if (gAppState.getCurTab() === "fs") {
      if (isBlankNode(str)) { // removes error message for complete blank node
        errorMessage("subjectErrorID2", "");
        removeInputColor('subjectID2');
        return formatSubject();
      } else if (str.includes('"') || str.includes("'")) {
        setInputColor("subjectID2");
        errorMessage("subjectErrorID2", "Subject cannot contain a literal value unless it is a blank node");
        throw new Error("Subject cannot be a literal value"); // Throws error because input is a literal value
      } else if (str.indexOf(' ') >= 0) {
        setInputColor('subjectID2');
        errorMessage("subjectErrorID2", "Subject cannot contain spaces unless it is a blank node");
        throw new Error("Subject cannot contain spaces");
      }
      else {
        errorMessage("subjectErrorID2", "");
        removeInputColor("subjectID2");
        return formatSubject(); // Returns formatted subject because it is valid
      }
    }
  } catch (e) {
    console.error('Invalid Subject', e);
  }

}

// This function formats the Predicate input. Comments are inline
function formatPredicate() {
  var str = gAppState.checkValue("predicateID", "predicateID2");
  if (regexp.test(str) && !isBlankNode(str)) {
    return '<' + str + '>'; // Case: input is a uri. Solution: quote it
  } else if (str.charAt(0) == "#") {
    return '<' + str + '>'; // Case: input is an unquoted relative uri. Solution: quote it
  } else if (str.charAt(0) == '<' && str.charAt(1) == '#' && str.charAt(str.length - 1) == '>') {
    return str; // Case: input is already a relative uri. Solution: return it as is
  } else if (str.includes(":") || str.includes("<#")) {
    return str; // Case: input is a curie. Solution: return it as is
  } else if (str.charAt(0) == "?") {
    return str; // checks if input is a variable for deletion
  }
  else {
    if (str.charAt(0) == '<' && str.charAt(str.length - 1) == '>') {
      var newStr = str.slice(1, -1); // Case: input is quoted uri. Solution: must be unquotted to be recognize as a uri by regexp
      return formatPredicate(newStr);
    } else {
      return ':' + str; // Case: input is not a uri or a blank node. Solution: make it a relative uri
    }
  }
}

function validatePredicate() {
  var str = gAppState.checkValue("predicateID", "predicateID2");

  try {
    if (gAppState.getCurTab() === "dbms") {
      if (str.includes('"') || str.includes("'")) {
        setInputColor('predicateID');
        errorMessage("predicateErrorID", "Predicate cannot be a literal value");
        throw new Error("Predicate cannot be a literal value"); // Throws error because input is a literal value
      } else if (str.indexOf(' ') >= 0) {
        setInputColor('predicateID');
        errorMessage("predicateErrorID", "Predicate cannot contain spaces");
        throw new Error("Predicate cannot contain spaces"); // Throws error because input subject can't contain spaces
      } else {
        removeInputColor('predicateID');
        errorMessage("predicateErrorID", "");
        return formatPredicate(); // Returns formatted subject because it is valid
      }
    } else if (gAppState.getCurTab() === "fs") {
      if (str.includes('"') || str.includes("'")) {
        setInputColor('predicateID2');
        errorMessage("predicateErrorID2", "Predicate cannot be a literal value");
        throw new Error("Predicate cannot be a literal value"); // Throws error because input is a literal value
      } else if (str.indexOf(' ') >= 0) {
        setInputColor('predicateID2');
        errorMessage("predicateErrorID2", "Predicate cannot contain spaces");
        throw new Error("Predicate cannot contain spaces"); // Throws error because input subject can't contain spaces
      } else {
        removeInputColor('predicateID2');
        errorMessage("predicateErrorID2", "");
        return formatPredicate(); // Returns formatted subject because it is valid
      }
    }
  } catch (e) {
    console.error('Invalid Predicate', e);
  }
}

// This function formats the Object input. Comments are inline
async function validateObject(str) {
  var range = await predicateRange(); // function waits until range is a value rather than a promise
  var str = gAppState.checkValue("objectID", "objectID2");

  if (str.includes('"') || str.includes("'")) {
    range = true;
  }

  if (!range) {
    if (str.charAt(0) == '<' && str.charAt(str.length - 1) == '>') { //Case: input is already qutoed uri. Return as is
      return str
    } else if (regexp.test(str) && !isBlankNode(str)) {
      return '<' + str + '>'; // Case: input is a uri. Solution: quote it
    } else if (str.charAt(0) == "#") {
      return '<' + str + '>'; // Case: input is an unquoted relative uri. Solution: quote it
    } else if (str.charAt(0) == '<' && str.charAt(1) == '#' && str.charAt(str.length - 1) == '>') {
      return str; // Case: input is already a relative uri. Solution: return it as is
    } else if (str.includes(":") || str.includes("<#")) {
      return str; // Case: input is a curie. Solution: return it as is
    }
    else {
      return ':' + str; // Case: input is not a uri or a blank node. Solution: make it a relative uri
    }
  }
  if (isBlankNode(str)) {
    return str; // Case : blank node
  } else {
    return formatLiteral(str);
  }
}

// This function formats the Object input. Comments are inline
function nonvalidatedObject() {
  var str = gAppState.checkValue("objectID", "objectID2");

  if (regexp.test(str) && !isBlankNode(str)) {
    return '<' + str + '>'; // Case: input is a uri. Solution: quote it
  } else if (str.charAt(0) == "#") {
    return '<' + str + '>'; // Case: input is an unquoted relative uri. Solution: quote it
  } else if (str.charAt(0) == '<' && str.charAt(1) == '#' && str.charAt(str.length - 1) == '>') {
    return str; // Case: input is already a relative uri. Solution: return it as is
  } else if (str.includes(":") || str.includes("<#")) {
    return str; // Case: input is a curie. Solution: return it as is
  } else if (str.charAt(0) == "?") {
    return str; // checks if input is a variable for deletion
  } else if (str.charAt(0) == '<' && str.charAt(str.length - 1) == '>') {
    var newStr = str.slice(1, -1); // Case: input is quoted uri. Solution: must be unquotted to be recognize as a uri by regexp
    return nonvalidatedObject(newStr);
  } else if (str.includes('"') || str.includes("'") || str.indexOf(' ') >= 0) {
    return formatLiteral(str); // Case: input is a quoted literal value
  } else if (isBlankNode(str)) {
    return str; // Case : blank node
  }
  else {
    return ':' + str; // Case: input is not a uri or a blank node. Solution: make it a relative uri
  }
}

//
// These functions handle the data table
//

function makeLink(link) {
  var href = link;
  if (DOC.iSel("fctID").checked == true) { //if fct checkbox is checked
      href = globals.describe + link;
  }
  link = '<a target="_blank" href="' + href + '">' + link + '</a>';
  return link;
}

// This function allows hyperlinks to be used in the table
function tableFormat(str) {
  // Regular Expression for URIs in table specifically
  const tableexp = /(https|http|mailto|tel|dav|ftp|ftps)[:^/s]/i;
  var graph = gAppState.checkValue("docNameID", "docNameID2");
  var strLabel = str; // variable for what is show on screen in the href

  if (str.includes(globals.describe)) {// of str is in fct format
    strLabel = strLabel.replace(globals.describe, "");
    strLabel = strLabel.replace("%23", "#");
  }


  if (DOC.iSel("uriID").checked == true) { //if user wants short URIs
    if (strLabel.includes(graph)) { //if str is in fct format it still includes the docname
      strLabel = strLabel.replace(graph, ""); //remove the docName from string
    }
    if (strLabel.includes("nodeID://")) {
      strLabel = strLabel.replace("nodeID://", "_:");
    } else if (strLabel.includes("#")) {
      strLabel = strLabel.split('#')[1];
    } else if (strLabel.includes("/")) {
      var strList = strLabel.split("/");
      strLabel = strList.pop();
    }
  }

  if (tableexp.test(str)) { // if str is an absolute or relative uri
    str = '<a href="' + str + '">' + strLabel + '</a>'
    return str
  }
  else {
    return strLabel
  }
}

// This function is used to referesh the table when view data is clicked
function refreshTable() {
  var table = gAppState.checkId("dbmsTableID", "fsTableID");

  for (var i = DOC.iSel(table.id).rows.length; i > 0; i--) {
    DOC.iSel(table.id).deleteRow(i - 1);
  }
}

// This function is used to create header row of table
function createHeader() {
  var table = gAppState.checkId("dbmsTableID", "fsTableID");

  var header = table.createTHead(); // creates empty tHead
  var row = header.insertRow(0); // inserts row into tHead

  var cell0 = row.insertCell(0); // inserts new cell at position 0 in the row
  var cell1 = row.insertCell(1); // inserts new cell at position 1 in the row
  var cell2 = row.insertCell(2); // inserts new cell at position 2 in the row

  cell0.innerHTML = "<b>Subject</b>"; // adds bold text
  cell1.innerHTML = "<b>Predicate</b>";
  cell2.innerHTML = "<b>Object</b>";
}

// This function sets the limit based on input and adjusts offset accordingly
function setLimit() { // reset offset when limit is changed
  if (limit != DOC.iSel("resultsID").value) {
    offset = Number("0");
  }
  limit = Number(DOC.iSel("resultsID").value);
}

// this function hides or shows buttons
function buttonDisplay() {
  var firstButton = gAppState.checkId("firstBtnID", "firstBtnID2");
  var nextButton = gAppState.checkId("nextBtnID", "nextBtnID2");
  var prevButton = gAppState.checkId("prevBtnID", "prevBtnID2");
  var lastButton = gAppState.checkId("lastBtnID", "lastBtnID2");
  var remainder = tableSize - limit;

  if (offset < remainder) { // if there is a next page
    if (nextButton.classList.contains('disabled')) { // show next button
      nextButton.classList.remove('disabled');
    }
    if (lastButton.classList.contains('disabled')) { // show last button
      lastButton.classList.remove('disabled');
    }
  } else { // if there is not a next page
    if (!nextButton.classList.contains('disabled')) { // hide next button
      nextButton.classList.add('disabled');
    }
    if (!lastButton.classList.contains('disabled')) { // hide last button
      lastButton.classList.add('disabled');
    }
  }

  if (offset > 0) { // if there is a previous page
    if (prevButton.classList.contains('disabled')) { // show prev button
      prevButton.classList.remove('disabled');
    }
    if (firstButton.classList.contains('disabled')) { // show first button
      firstButton.classList.remove('disabled');
    }
  } else { // if there is not a previous page
    if (!prevButton.classList.contains('disabled')) { // hide prev button
      prevButton.classList.add('disabled');
    }
    if (!firstButton.classList.contains('disabled')) { // hide first button
      firstButton.classList.add('disabled');
    }
  }
}

// This function goes to next page in table
function next() {
  var nextButton = gAppState.checkId("nextBtnID", "nextBtnID2");
  var prevButton = gAppState.checkId("prevBtnID", "prevBtnID2");
  var remainder = tableSize - limit;

  if (nextButton.classList.contains('disabled')) { // stop action if button is disabled
    return false;
  }

  if (offset < remainder) { // if there is a next page
    offset += parseInt(limit);
    buttonDisplay();
  }

  // refresh table
  if (resultMode == "bn") {
    bnQueryGen();
  } else if (resultMode == "query") {
    queryGen();
  } else {
    updateTable();
  }
}

// this function goes to previous page in table
function previous() {
  var nextButton = gAppState.checkId("nextBtnID", "nextBtnID2");
  var prevButton = gAppState.checkId("prevBtnID", "prevBtnID2");
  var remainder = tableSize - limit;

  if (prevButton.classList.contains('disabled')) { // stop action if button is disabled
    return false;
  }

  if (offset > 0) { // if there is a previous page
    offset -= parseInt(limit);
    buttonDisplay();
  }

  // refresh table
  if (resultMode == "bn") {
    bnQueryGen();
  } else if (resultMode == "query") {
    queryGen();
  } else {
    updateTable();
  }
}

// this function goes to the first page
function first() {
  var firstButton = gAppState.checkId("firstBtnID", "firstBtnID2");
  var prevButton = gAppState.checkId("prevBtnID", "prevBtnID2");

  if (firstButton.classList.contains('disabled')) { // stop action if button is disabled
    return false;
  }

  if (offset > 0) {
    offset = Number("0");

    // refresh table
    if (resultMode == "bn") {
      bnQueryGen();
    } else if (resultMode == "query") {
      queryGen();
    } else {
      updateTable();
    }

    buttonDisplay();
  } else {
    if (!firstButton.classList.contains('disabled')) { // hide first button
      firstButton.classList.add('disabled');
    }
  }
}

function last() {
  var lastButton = gAppState.checkId("lastBtnID", "lastBtnID2");
  var nextButton = gAppState.checkId("nextBtnID", "nextBtnID2");
  var div = Math.floor(tableSize / limit);
  var mod = Math.floor(tableSize % limit);

  if (lastButton.classList.contains('disabled')) { // stop action if button is disabled
    return false;
  }

  if (mod != 0) {
    console.log("CASE 1")
    var remainder = tableSize - mod;
  } else { // if limit even divides into tableSize
    console.log("CASE 2")
    var remainder = (div - 1) * limit
  }

  if (offset < remainder) {
    offset = Number(remainder);

    // refresh table
    if (resultMode == "bn") {
      bnQueryGen();
    } else if (resultMode == "query") {
      queryGen();
    } else {
      updateTable();
    }

    buttonDisplay();
  } else {
    if (!lastButton.classList.contains('disabled')) { // hide last button
      lastButton.classList.add('disabled');
    }
  }
}

// This sets the size of the current table
async function setTableSize() {
  var graph = gAppState.checkValue("docNameID", "docNameID2");
  if (gAppState.getCurTab() === "ap")
    return;
  if (gAppState.getCurTab() === "dbms") {
    var query =
      "SELECT DISTINCT COUNT(*) AS ?count FROM <" + graph + "> WHERE {?subject ?predicate ?object}"
  } else if (gAppState.getCurTab() === "fs") {
    // Use of Sponger Pragma to force document reload during query evaluation
    var query =
      "DEFINE get:refresh" + " " + '"clean"' + "\n"
      + "DEFINE get:soft" + " " + '"replace"' + "\n"
      + "SELECT DISTINCT COUNT(*) AS ?count FROM <" + graph + "> WHERE {?subject ?predicate ?object}"
  }

  if (DOC.iSel("riID").checked == true) {// if reasoning and inference is on
    query = "DEFINE input:same-as" + '"yes" \n' + query;
  } else if (DOC.iSel("ruleNameID").checked == true) {
    query = "DEFINE input:inference" + ' ' + "'" + DOC.iSel("infRuleNameID").value + "'" + ' \n' + query;
  }

  var endpoint = DOC.iSel("sparql_endpoint").value + "?default-graph-uri=&query=";
  let url = endpoint + encodeURIComponent(query) + "&should-sponge=&format=application%2Fsparql-results%2Bjson";

  if (DOC.iSel("cmdID").checked == true) {
    console.log("Retrieving Table Length From: " + url);
    console.log("Query: " + query);
  }

  const options = {
    method: 'GET',
    headers: {
      'Content-type': 'application/sparql-results+json; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options)

    if (resp.ok && resp.status == 200) {
      var data = await resp.json();

      if (data.results.bindings.length > 0) {
        tableSize = Number(data.results.bindings[0].count.value);
      } else {
        console.log("Table size is 0");
      }

    } else {
      var msg = await resp.text();
      hideSpinner();
      console.error("Error: " + resp.status)
      await showSnackbar('Table Size Failed', `SPARQL endpoint Error: ${resp.status} ${resp.statusText}`);
    }

  } catch (e) {
    hideSpinner();
    console.error('Table Size Failed', e);
    await showSnackbar('Table Size Failed', `SPARQL endpoint Error: ${resp.status} ${resp.statusText}`);
  }
}

//
// These Functions Handle the Functionality of the Page
//

async function resolveOutBox() {
  if (!gAppState.webid)
    {
      showSnackbar('Not logged-in');
      errorMessage("outboxErrorID", "Not logged-in");
      return;
    }
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var url = gAppState.webid;
  var resp;
  showSpinner();
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.ok) {
      var body = await resp.text();
      var profile = JSON.parse (body);
      DOC.iSel("outboxID").value = profile.outbox;
      console.log(resp.status + " - " + resp.statusText);
      hideSpinner();
    } else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
      hideSpinner();
    }
  } catch (e) {
    hideSpinner();
    console.error('Fetch Failed', e);
    showSnackbar('Outbox Fetch Failed', '' + e);
  }
}

async function sendActivity() {
  showSpinner();
  var activity = DOC.iSel("apObjectID").value;

  console.log (gAppState.webid);
  if (!gAppState.webid) {
      showSnackbar('Not logged-in');
      errorMessage("outboxErrorID", "Not logged-in");
      hideSpinner();
      return;
    }
  var endpoint = DOC.iSel("outboxID").value;
  let url = endpoint;
  if (url.length < 1 || (!url.startsWith('https://') && !url.startsWith('http://'))) {
      showSnackbar('OutBox URI not fetched or invalid');
      hideSpinner();
      return;
    }
  errorMessage("outboxErrorID", "");

  try {
     var ap = JSON.parse(activity);
     if (ap['@context'] != 'https://www.w3.org/ns/activitystreams')
       {
           errorMessage("apObjectErrorID", "Not an ActivityStreams Object, check @context value");
           hideSpinner();
           return;
       }
     if ((!ap.content && !ap.object)  || (ap.content && ap.content.length < 1))
       {
           errorMessage("apObjectErrorID", "ActivityStreams Object must have `content` or `object`");
           hideSpinner();
           return;
       }
     if (!ap.type)
       {
           errorMessage("apObjectErrorID", "ActivityStreams Object must have a `type`");
           hideSpinner();
           return;
       }
  }
  catch (e) {
    showSnackbar('Invalid JSON', '' + e);
    hideSpinner();
    return;
  }

  errorMessage("apObjectErrorID","");

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/activity+json',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
    body: activity,
  };

  var resp;
  var activity_url = null;
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.ok) {
      console.log(resp.status + " - " + resp.statusText);
      activity_url = resp.headers.get('location');
      DOC.iSel("sendResultID").innerHTML = makeLink(activity_url);
      hideSpinner();
      DOC.iSel("apObjectID").value =
            '{\n' +
            '  "@context": "https://www.w3.org/ns/activitystreams",\n' +
            '  "type": "Note",\n' +
            '  "summary":null,\n' +
            '  "content": ""\n' +
            '}';
      showSnackbar('Posted');
      showActivtyDetails (activity_url);
    } else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
      console.error('Send Failed', e);
      hideSpinner();
    }
  } catch (e) {
    hideSpinner();
    console.error('Send Failed', e);
    showSnackbar('Send Failed', '' + e);
  }
}

async function showActivtyDetails (activity_url) {
  let url = activity_url;
  console.log (url);
  if (!activity_url)
    return;
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.ok) {
      var body = await resp.text();
      var activity = JSON.parse (body);
      if (activity.object)
        DOC.iSel("apPostID").innerHTML = makeLink(activity.object.id);
      else
        DOC.iSel("apPostID").innerHTML = 'N/A';
    } else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
    }
  } catch (e) {
    console.error('Fetch Failed', e);
    showSnackbar('Fetch Failed', '' + e);
  }
}

//updateTable(); //Table is always shown when page is loaded


//SPARQL INSERT SCRIPT
async function recordGen() {
  await setLimit();
  showSpinner();
  var subject = validateSubject();
  var predicate = validatePredicate();
  var object = await validateObject(); // insert function awaits object value before proceeding
  var graph = DOC.iSel("docNameID").value;

  //SPARQL INSERT Query Generator
  var insert_cmd =
    "PREFIX schema: <http://schema.org/>\n"
    + "PREFIX : <" + graph + "#>\n"
    + "PREFIX foaf: <http://xmlns.com/foaf/0.1/>\n"
    + "INSERT INTO GRAPH <" + graph + "> \n{\n"
    + subject + ' ' + predicate + ' ' + object + " . \n"
    + "}";

  var endpoint = DOC.iSel("sparql_endpoint").value;
  let url = endpoint;

  if (DOC.iSel("cmdID").checked == true) {
    console.log("endpoint for Target SPARUL Service: " + endpoint);
    console.log(insert_cmd);
  }

  const options = {
    method: 'POST',
    headers: {
      'Content-type': 'application/sparql-update; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
    body: insert_cmd,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.status >= 200 && resp.status <= 300) {
      console.log(resp.status + " - " + resp.statusText);
      updateTable();
      hideSpinner();
    } else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
      hideSpinner();
    }
  } catch (e) {
    hideSpinner();
    console.error('Insert Failed', e);
    showSnackbar('Insert Failed', '' + e);
  }
  await setTableSize();
  await buttonDisplay();
}

//SPARQL DELETE SCRIPT
async function recordDel() {
  await setLimit();
  showSpinner();
  var subject = validateSubject();
  var predicate = validatePredicate();
  var object = nonvalidatedObject();
  var graph = DOC.iSel("docNameID").value;

  //SPARQL DELETE Query Generator
  var delete_cmd =
    "PREFIX : <" + graph + "#>\n"
    + "DELETE { GRAPH <" + graph + "> {\n"
    + subject + ' ' + predicate + ' ' + object + "."
    + "\n }"
    + "\n }"
    + "WHERE { GRAPH <" + graph + "> { \n"
    + subject + ' ' + predicate + ' ' + object + "."
    + "} \n };"

  var endpoint = DOC.iSel("sparql_endpoint").value;
  let url = endpoint;

  if (DOC.iSel("cmdID").checked == true) {
    console.log("endpoint for Target SPARUL Service: " + endpoint);
    console.log(delete_cmd);
  }

  const options = {
    method: 'POST',
    headers: {
      'Content-type': 'application/sparql-update; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
    body: delete_cmd,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.status >= 200 && resp.status <= 300) {
      console.log(resp.status + " - " + resp.statusText);
      updateTable();
      hideSpinner();
    }
    else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
      hideSpinner();
    }
  } catch (e) {
    hideSpinner();
    console.error('Delete Failed', e);
    showSnackbar('Delete Failed', '' + e);
  }
  await setTableSize();
  await buttonDisplay();
}

// function used to return data as CSV or XML
function downloadResults() {
  resultMode = "csv";
  var graph = gAppState.checkValue("docNameID", "docNameID2");

  if (gAppState.getCurTab() === "dbms") {
    var data_query =
      "SELECT DISTINCT * FROM <" + graph + "> WHERE {?subject ?predicate ?object}"
  } else if (gAppState.getCurTab() === "fs") {
    // Use of Sponger Pragma to force document reload during query evaluation
    var data_query =
      "DEFINE get:soft" + " " + '"soft"' + "\n" + "SELECT DISTINCT * FROM <" + graph + "> WHERE {?subject ?predicate ?object}"
  }

  if (limit >= 1) { // if results per page is active
    data_query = data_query + "\n" + "OFFSET " + offset + "\n" + "LIMIT " + limit;
  }

  if (DOC.iSel("riID").checked == true) {// if reasoning and inference is on
    data_query = "DEFINE input:same-as" + '"yes" \n' + data_query;
  } else if (DOC.iSel("ruleNameID").checked == true) {
    data_query = "DEFINE input:inference" + ' ' + "'" + DOC.iSel("infRuleNameID").value + "'" + ' \n' + data_query;
  }

  var endpoint = DOC.iSel("sparql_endpoint").value + "?default-graph-uri=&query=";
  if (DOC.iSel("csvID").checked == true) {
    var downloadURL = endpoint + encodeURIComponent(data_query) + "&should-sponge=&format=text%2Fcsv";
  } else if (DOC.iSel("xmlID").checked == true) {
    var downloadURL = endpoint + encodeURIComponent(data_query) + "&should-sponge=&format=application%2Fsparql-results%2Bxml";
  }


  if (DOC.iSel("cmdID").checked == true) {
    console.log("Retrieving CSV From: " + downloadURL);
    console.log("Query: " + data_query);
  }

  window.open(downloadURL);
}

/* Generates blank node queries and displays table reflecting them.
This function is required because blank node queries can
require n number of columns. */
async function bnQueryGen() {
  resultMode = "bn";
  await setLimit();
  showSpinner();
  var subject = validateSubject();
  var predicate = validatePredicate();
  var object = nonvalidatedObject();
  var graph = gAppState.checkValue("docNameID", "docNameID2");


  if (gAppState.getCurTab() === "dbms") {
    var query =
      "PREFIX : <" + graph + "#>\n"
      + "SELECT DISTINCT * \n"
      + "FROM <" + graph + "> \n"
      + "WHERE {" + " " + subject + " " + predicate + " " + object + " " + "}"
  } else if (gAppState.getCurTab() === "fs") {
    var query =
      "DEFINE get:soft" + " " + '"soft"' + "\n"
      + "PREFIX : <" + graph + "#>\n"
      + "SELECT DISTINCT * \n"
      + "FROM <" + graph + "> \n"
      + "WHERE {" + " " + subject + " " + predicate + " " + object + " " + "}"
  }

  if (limit >= 1) { // if results per page is active
    query = query + "\n" + "OFFSET " + offset + "\n" + "LIMIT " + limit;
  }

  if (DOC.iSel("riID").checked == true) {// if reasoning and inference is on
    query = "DEFINE input:same-as" + '"yes" \n' + query;
  } else if (DOC.iSel("ruleNameID").checked == true) {
    query = "DEFINE input:inference" + ' ' + "'" + DOC.iSel("infRuleNameID").value + "'" + ' \n' + query;
  }

  // CSV download
  if (DOC.iSel("csvID").checked == true || DOC.iSel("xmlID").checked == true) {
    await downloadResults();
  }

  var endpoint = DOC.iSel("sparql_endpoint").value + "?default-graph-uri=&query=";
  let url = endpoint + encodeURIComponent(query) + "&should-sponge=&format=application%2Fsparql-results%2Bjson";

  if (DOC.iSel("cmdID").checked == true) {
    console.log("SPARQL Query: " + query);
    console.log("Query URL: " + url)
  }

  const options = {
    method: 'GET',
    headers: {
      'Content-type': 'application/sparql-results+json; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options)
    if (resp.ok && resp.status == 200) {
      var data = await resp.json();

      refreshTable();

      /*
        Dynamic Table for processing JSON Structured Data (via "application/sparql-results+json" document content type)
        that enables INSERT to be handled via a 3-tuple subject, predicate, object graph (relation) while query results
        are handled via an N-Tuple structured table (relation).
      */
      if (data.results.bindings.length > 0) {
        var table = gAppState.checkId("dbmsTableID", "fsTableID"); // creates table for header
        var header = table.createTHead(); // creates empty tHead
        var headRow = header.insertRow(0); // inserts row into tHead
        var bindings = data.results.bindings;
        for (var col = 0; col < data.head.vars.length; col++) { // for each column
          var headCell = headRow.insertCell(col); // inserts new cell at position i in thead
          headCell.innerHTML = "<b>" + data.head.vars[col] + "</b>"; // adds bold text to thead cell
        }
        for (i in bindings) {
          var curr = 0; // curr is used to keep track of correct cell position
          var binding = bindings[i];
          var bodyRow = table.insertRow(-1); // create new row
          for (n in binding) {
            var bodyCell = bodyRow.insertCell(curr); // create new cell in row
            bodyCell.innerHTML = tableFormat(binding[n].value); // set value of cell
            curr += 1;
          }
        }
        hideSpinner();
      }
      else {
        hideSpinner();
        console.log("No data returned by query");
      }

    } else {
      var msg = await resp.text();
      hideSpinner();
      console.error('Query Failed', msg);
      alert('Query Failed ' + msg)
    }

  } catch (e) {
    hideSpinner();
    console.error('Query Failed', e);
    alert('Query Failed ' + e)
  }
  await setTableSize();
  await buttonDisplay();
}

// This function updates table to show results of a query
function click_queryGen() {
  offset = Number("0");
  queryGen();
}

async function queryGen() {
  resultMode = "query";
  await setLimit();
  showSpinner();
  var subject = validateSubject();
  var predicate = validatePredicate();
  var object = nonvalidatedObject();
  var graph = gAppState.checkValue("docNameID", "docNameID2");

  if (isBlankNode(subject) || isBlankNode(object)) {
    bnQueryGen(); // if query includes blank node call bnQueryGen function
    return false; // returns false so the queryGen function stops executing
  }

  if (gAppState.getCurTab() === "dbms") {
    var query =
      "PREFIX : <" + graph + "#>\n"
      + "SELECT DISTINCT" + " " + subject + " AS ?subject" + " " + predicate + " AS ?predicate" + " " + object + " AS ?object \n"
      + "FROM <" + graph + "> \n"
      + "WHERE {" + " " + subject + " " + predicate + " " + object + " " + "}"
  } else if (gAppState.getCurTab() === "fs") {
    var query =
      "DEFINE get:refresh" + " " + '"clean"' + "\n"
      + "DEFINE get:soft" + " " + '"replace"' + "\n"
      + "PREFIX : <" + graph + "#>\n"
      + "SELECT DISTINCT" + " " + subject + " AS ?subject" + " " + predicate + " AS ?predicate" + " " + object + " AS ?object \n"
      + "FROM <" + graph + "> \n"
      + "WHERE {" + " " + subject + " " + predicate + " " + object + " " + "}"
  }

  if (limit >= 1) { // if results per page is active
    query = query + "\n" + "OFFSET " + offset + "\n" + "LIMIT " + limit;
  }

  if (DOC.iSel("riID").checked == true) {// if reasoning and inference is on
    query = "DEFINE input:same-as" + '"yes" \n' + query;
  } else if (DOC.iSel("ruleNameID").checked == true) {
    query = "DEFINE input:inference" + ' ' + "'" + DOC.iSel("infRuleNameID").value + "'" + ' \n' + query;
  }

  // CSV download
  if (DOC.iSel("csvID").checked == true || DOC.iSel("xmlID").checked == true) {
    await downloadResults();
  }

  var endpoint = DOC.iSel("sparql_endpoint").value + "?default-graph-uri=&query=";
  let url = endpoint + encodeURIComponent(query) + "&should-sponge=&format=application%2Fsparql-results%2Bjson";

  if (DOC.iSel("cmdID").checked == true) {
    console.log("SPARQL Query: " + query);
    console.log("Query URL: " + url);
  }

  const options = {
    method: 'GET',
    headers: {
      'Content-type': 'application/sparql-results+json; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options)

    if (resp.ok && resp.status == 200) {
      var data = await resp.json();

      refreshTable();
      createHeader();

      if (data.results.bindings.length > 0) {
        var table = gAppState.checkId("dbmsTableID", "fsTableID");
        var object = nonvalidatedObject();
        for (var i = 0; i < data.results.bindings.length; i++) {
          var subject = data.results.bindings[i].subject.value;
          var predicate = data.results.bindings[i].predicate.value;
          var object = data.results.bindings[i].object.value;
          if (DOC.iSel("fctID").checked == true) { //if fct checkbox is checked
            if (subject.includes(graph) || regexp.test(subject)) { //if subject is not a literal value
              subject = globals.describe + data.results.bindings[i].subject.value;
              subject = subject.replace("#", "%23"); // replaces # with %23 for fct results
            }

            if (predicate.includes(graph) || regexp.test(predicate)) { //if subject is not a literal value
              predicate = globals.describe + data.results.bindings[i].predicate.value;
              predicate = predicate.replace("#", "%23");
            }

            if (object.includes(graph) || regexp.test(object)) {
              object = globals.describe + data.results.bindings[i].object.value;
              object = object.replace("#", "%23");
            } else { //if object is literal value
              object = data.results.bindings[i].object.value;
            }

          } else {
            subject = data.results.bindings[i].subject.value;
            predicate = data.results.bindings[i].predicate.value;
            object = data.results.bindings[i].object.value;
          }


          var row = table.insertRow(-1);
          var cell1 = row.insertCell(0);
          var cell2 = row.insertCell(1);
          var cell3 = row.insertCell(2);

          cell1.innerHTML = tableFormat(subject);
          cell2.innerHTML = tableFormat(predicate);
          cell3.innerHTML = tableFormat(object);
        }
        hideSpinner();
      }
      else {
        hideSpinner();
        console.log("No data returned by query");
      }

    } else {
      var msg = await resp.text();
      hideSpinner();
      console.error('Query Failed', msg);

      alert('Query Failed ' + msg)
    }

  } catch (e) {
    hideSpinner();
    console.error('Query Failed', e);
    alert('Query Failed ' + e)
  }
  await setTableSize();
  await buttonDisplay();
}


// This function fetches the query results and returns them in json
function click_updateTable() {
  offset = Number("0");
  updateTable();
}

async function updateTable() {
  resultMode = "all";
  if (gAppState.getCurTab() === "ap")
    return;
  var graph = gAppState.checkValue("docNameID", "docNameID2");
  if (!graph) {
    console.log("DocumentName is Empty");
    return;
  }

  await setLimit();
  showSpinner();

  if (gAppState.getCurTab() === "dbms") {
    var data_query =
      "SELECT DISTINCT * FROM <" + graph + "> WHERE {?subject ?predicate ?object}"
  } else if (gAppState.getCurTab() === "fs") {
    // Use of Sponger Pragma to force document reload during query evaluation
    var data_query =
      "DEFINE get:refresh" + " " + '"clean"' + "\n"
      + "DEFINE get:soft" + " " + '"replace"' + "\n"
      + "SELECT DISTINCT * FROM <" + graph + "> WHERE {?subject ?predicate ?object}"
  }

  if (limit >= 1) { // if results per page is active
    data_query = data_query + "\n" + "OFFSET " + offset + "\n" + "LIMIT " + limit;
  }

  if (DOC.iSel("riID").checked == true) {// if reasoning and inference is on
    data_query = "DEFINE input:same-as" + '"yes" \n' + data_query;
  } else if (DOC.iSel("ruleNameID").checked == true) {
    data_query = "DEFINE input:inference" + ' ' + "'" + DOC.iSel("infRuleNameID").value + "'" + ' \n' + data_query;
  }

  // CSV download
  if (DOC.iSel("csvID").checked == true || DOC.iSel("xmlID").checked == true) {
    await downloadResults();
  }

  var endpoint = DOC.iSel("sparql_endpoint").value + "?default-graph-uri=&query=";
  let url = endpoint + encodeURIComponent(data_query) + "&should-sponge=&format=application%2Fsparql-results%2Bjson";

  if (DOC.iSel("cmdID").checked == true) {
    console.log("Retrieving Table Data From: " + url);
    console.log("Query: " + data_query);
  }


  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/sparql-results+json; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options)

    if (resp.ok && resp.status == 200) {
      var data = await resp.json();

      refreshTable();
      createHeader();
      var table = gAppState.checkId("dbmsTableID", "fsTableID");

      if (data.results.bindings.length > 0) {
        for (var i = 0; i < data.results.bindings.length; i++) {
          var subject = data.results.bindings[i].subject.value;
          var predicate = data.results.bindings[i].predicate.value;
          var object = data.results.bindings[i].object.value;
          if (DOC.iSel("fctID").checked == true) { //if fct checkbox is checked
            if (subject.includes(graph) || regexp.test(subject)) { //if subject is not a literal value
              subject = globals.describe + data.results.bindings[i].subject.value;
              subject = subject.replace("#", "%23"); // replaces # with %23 for fct results
            }

            if (predicate.includes(graph) || regexp.test(predicate)) { //if subject is not a literal value
              predicate = globals.describe + data.results.bindings[i].predicate.value;
              predicate = predicate.replace("#", "%23");
            }

            if (object.includes(graph) || regexp.test(object)) {
              object = globals.describe + data.results.bindings[i].object.value;
              object = object.replace("#", "%23");
            } else { //if object is literal value
              object = data.results.bindings[i].object.value;
            }

          } else {
            subject = data.results.bindings[i].subject.value;
            predicate = data.results.bindings[i].predicate.value;
            object = data.results.bindings[i].object.value;
          }

          var row = table.insertRow(-1);
          var cell1 = row.insertCell(0);
          var cell2 = row.insertCell(1);
          var cell3 = row.insertCell(2);

          cell1.innerHTML = tableFormat(subject);
          cell2.innerHTML = tableFormat(predicate);
          cell3.innerHTML = tableFormat(object);
        }
        hideSpinner();
      } else {
        hideSpinner();
        console.log("No data returned by query");
      }

    }
    else {
      var msg = await resp.text();
      hideSpinner();
      console.error('Table Refresh Failed', msg);
      await showSnackbar('Table Refresh Failed', `SPARQL endpoint Error: ${resp.status} ${resp.statusText}`);
    }

  } catch (e) {
    hideSpinner();
    console.error('Table Refresh Failed', e);
    await showSnackbar('Table Refresh Failed', `SPARQL endpoint Error: ${resp.status} ${resp.statusText}`);
  }
  await setTableSize();
  await buttonDisplay();
}


// This function gets the range of the predicate to determine if object is a literal or a reference
async function predicateRange() {
  var predicate = validatePredicate();
  var graph = gAppState.checkValue("docNameID", "docNameID2");

  var range_query =
    "PREFIX : <" + graph + "#>\n"
    + "ASK \n"
    + "WHERE \n"
    + "{ \n"
    + predicate + ' ' + "rdfs:range ?range .\n"
    + "filter (?range in (rdfs:Literal, xsd:string, xsd:decimal, xsd:integer, xsd:boolean, xsd:date, xsd:time))\n"
    + "}"

  var endpoint = DOC.iSel("sparql_endpoint").value + "?default-graph-uri=&query=";
  // This sets the url for retrieving the json
  let url = endpoint + encodeURIComponent(range_query) + "&should-sponge=&format=application%2Fsparql-results%2Bjson";

  if (DOC.iSel("cmdID").checked == true) {
    console.log("Receiving Predicate Range From: " + url);
    console.log("Query" + range_query);
  }


  const options = {
    method: 'GET',
    headers: {
      'Content-type': 'application/sparql-results+json; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options); // resp awaits completion of fetch

    if (resp.status >= 200 && resp.status <= 300) {
      console.log(resp.status + " - " + resp.statusText);
    } else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
    }
    const json = await resp.json(); // constant awaits resp before being assigned (so it isn't assigned as a promise)
    return (json.boolean); // returns true or false returned by query after awaiting results
  } catch (e) {
    console.error('Predicate Range Lookup Failed', e);
    showSnackbar('Predicate Range Lookup Failed', '' + e);
  }
}

async function turtleGen() {
  await setLimit();
  showSpinner();

  var subject = validateSubject();
  var predicate = validatePredicate();
  var object = await validateObject(); // insert function awaits object value before proceeding
  var docName = DOC.iSel("docNameID2").value;
  console.log("subject: " + subject)

  var turtle_cmd =
    `INSERT DATA {@prefix : <${docName}#> . ${subject}  ${predicate}  ${object} . } `

  let url = docName;

  if (DOC.iSel("fctID").checked == true) {
    console.log("Insert Command:" + turtle_cmd);
  }


  const options = {
    method: 'PATCH',
    headers: {
      'Content-type': 'application/sparql-update; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
    body: turtle_cmd,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.status >= 200 && resp.status <= 300) {
      hideSpinner();
      console.log(resp.status + " - " + resp.statusText);
      updateTable();
    }
    else {
      hideSpinner();
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
    }
  } catch (e) {
    hideSpinner();
    showSnackbar('Insert Failed', '' + e);
    console.error('Insert Failed ' + e);
  }
  await setTableSize();
  await buttonDisplay();
}

async function turtleDel() {
  await setLimit();
  showSpinner();

  var subject = validateSubject();
  var predicate = validatePredicate();
  var object = nonvalidatedObject(); // insert function awaits object value before proceeding
  var docName = DOC.iSel("docNameID2").value;
  var del_cmd;
  var is_solid_server = false;

  try {
    if (gAppState.is_solid_id && (new URL(gAppState.webid)).origin === (new URL(docName)).origin) {
      is_solid_server = true;
    }
  } catch (e) { }

  if (is_solid_server)
    del_cmd =
      `DELETE DATA {@prefix : <${docName}#> . ${subject}  ${predicate}  ${object} . } `
  else
    del_cmd =
      `PREFIX : <${docName}#> DELETE DATA { GRAPH <${docName}> { ${subject} ${predicate} ${object} . } }`;

  let url = docName;
  if (DOC.iSel("fctID").checked == true) {
    console.log("Delete Command:" + del_cmd);
  }


  const options = {
    method: 'PATCH',
    headers: {
      'Content-type': 'application/sparql-update; charset=UTF-8',
    },
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
    body: del_cmd,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.status >= 200 && resp.status <= 300) {
      hideSpinner();
      console.log(resp.status + " - " + resp.statusText);
      updateTable();
    }
    else {
      throw new Error(`Error ${resp.status} - ${resp.statusText}`);
    }
  } catch (e) {
    hideSpinner();
    console.error('Delete Failed ' + e);
    showSnackbar('Delete Failed', '' + e);
  }
  await setTableSize();
  await buttonDisplay();
}


// --------------------------------------------------------------------------
// Authentication and WebID profile retrieval
//

async function loadProfile(webId) {
  showSpinner();
  try {
    var rc = await fetchProfile(webId);
    if (!rc)
      return null;

    var uriObj = new URL(webId)
    uriObj.hash = uriObj.search = uriObj.query = '';

    var base = uriObj.toString()
    const kb = $rdf.graph()

    $rdf.parse(rc.profile, kb, base, rc.content_type);

    const LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
    const PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
    const SOLID = $rdf.Namespace("http://www.w3.org/ns/solid/terms#");

    const s_webId = $rdf.sym(webId)

    uriObj.pathname = '/';
    var ret = uriObj.toString();

    var store = kb.any(s_webId, PIM('storage'));
    var inbox = kb.any(s_webId, LDP('inbox'));

    var s_issuer = kb.any(s_webId, SOLID('oidcIssuer'));
    var s_account = kb.any(s_webId, SOLID('account'));
    var s_pubIndex = kb.any(s_webId, SOLID('publicTypeIndex'));

    var is_solid_id = (s_issuer || s_account || s_pubIndex) ? true : false;
    hideSpinner();

    if (inbox)
      return { store: inbox.value, is_solid_id };
    else if (store)
      return { store: store.value, is_solid_id };

  } catch (e) {
    hideSpinner();
    console.error('Error', e)
    alert('Error ', e)
    return null;
  }
}

async function fetchProfile(url) {
  if (!url.startsWith('https://') && !url.startsWith('http://'))
    return null;

  const options = {
    method: 'GET',
    headers: { 'Accept': 'text/turtle,application/ld+json;q=0.9' }, // rdflib do not parse AS profile by a reason
    credentials: 'include',
    mode: 'cors',
    crossDomain: true,
  };

  var resp;
  try {
    resp = await solidClient.fetch(url, options);
    if (resp.ok) {
      var body = await resp.text();
      var contentType = resp.headers.get('content-type');
      console.log (contentType);
      return { profile: body, contentType };
    }
    else {
      console.log("Error " + resp.status + " - " + resp.statusText)
    }
  }
  catch (e) {
    console.error('Request failed', e)
    await showSnackbar('Request failed.', 'Could not fetch profile: ' + url);
    return null;
  }
}

async function authLogin() {
  dialog.dialog("open");
}

async function authLogout() {
  console.log('authLogout(): Calling solidClientAuthentication.logout()');
  await solidClientAuthentication.logout();
  location.reload();
}

// --------------------------------------------------------------------------
// Spinner
//

function showSpinner() {
  DOC.iSel("spinner").className = "show";
}

function hideSpinner() {
  DOC.iSel("spinner").className = DOC.iSel("spinner").className.replace("show", "");
}

// --------------------------------------------------------------------------
// Snackbar
//

const delay = ms => new Promise(res => setTimeout(res, ms));

async function showSnackbar(text1, text2) {
  const tm = 5000;
  var x = DOC.iSel("snackbar");
  DOC.qSel("#snackbar #msg1").innerText = text1;
  DOC.qSel("#snackbar #msg2").innerText = text2 ? text2 : '';
  //x.innerText = text;
  x.className = "show";
  setTimeout(function () { x.className = x.className.replace("show", ""); }, tm);
  await delay(tm);
}

function pickActivity(id) {
    var item = id.toLowerCase();

    DOC.iSel('apObjType').innerHTML = 'ActivityStreams Object Type ('+id+')&nbsp;<span class="caret">';
    if (item == 'note') {
      DOC.iSel('apObjectID').value =
            '{\n' +
            '  "@context": "https://www.w3.org/ns/activitystreams",\n' +
            '  "type": "Note",\n' +
            '  "summary":null,\n' +
            '  "content": ""\n' +
            '}';
    }
    else if (item == 'delete' || item == 'like' || item == 'announce' || item == 'follow') {
      DOC.iSel('apObjectID').value =
            '{\n' +
            '  "@context": "https://www.w3.org/ns/activitystreams",\n' +
            '  "type": "'+ id +'",\n' +
            '  "object": ""\n' +
            '}';
    }
    else if (item == 'unfollow') {
      DOC.iSel('apObjectID').value =
            '{\n' +
            '  "@context": "https://www.w3.org/ns/activitystreams",\n' +
            '  "type": "Undo",\n' +
            '  "object": {\n' +
            '     "type": "Follow",\n' +
            '     "object": ""\n' +
            '  }\n' +
            '}';
    }
    else if (item == 'unlike') {
      DOC.iSel('apObjectID').value =
            '{\n' +
            '  "@context": "https://www.w3.org/ns/activitystreams",\n' +
            '  "type": "Undo",\n' +
            '  "object": {\n' +
            '     "type": "Like",\n' +
            '     "object": ""\n' +
            '  }\n' +
            '}';
    }
}

// ==========================================================================
// Declarations done, now execute ...

// --------------------------------------------------------------------------
// Page initialization on onready event.
//

gAppState = new AppState();

// solid-client-authn.bundle.js lib exports an object assigned to var solidClientAuthentication.
solidClient = solidClientAuthentication;

$(document).ready(function () {
  // Activate tooltips
  $('[data-toggle="tooltip"]').tooltip({
    placement: 'right'
  });

  limit = Number("0");
  offset = Number("0");
  tableSize = Number(setTableSize());
  resultMode = null;

  DOC.iSel('sparql_endpoint').onchange = () => { gAppState.updatePermalink() }

  DOC.iSel('loginID').onclick = () => { authLogin() }
  DOC.iSel('logoutID').onclick = () => { authLogout() }

  DOC.iSel('subjectID').onchange = () => { gAppState.updatePermalink() }
  DOC.iSel('predicateID').onchange = () => { gAppState.updatePermalink() }
  DOC.iSel('objectID').onchange = () => { gAppState.updatePermalink() }
  DOC.iSel('docNameID').onchange = () => { gAppState.updatePermalink() }

  //DOC.iSel('resolveBtnID').onclick = () => { resolveOutBox() }
  DOC.iSel('sendBtnID').onclick = () => { sendActivity() }

  DOC.iSel('clearBtnID').onclick = () => { gAppState.clearInput() }
  DOC.iSel('insertBtnID').onclick = () => { recordGen() }
  DOC.iSel('deleteBtnID').onclick = () => { recordDel() }
  DOC.iSel('queryBtnID').onclick = () => { click_queryGen() }
  DOC.iSel('dataBtnID').onclick = () => { click_updateTable() }

  DOC.iSel('firstBtnID').onclick = () => { first() }
  DOC.iSel('prevBtnID').onclick = () => { previous() }
  DOC.iSel('lastBtnID').onclick = () => { last() }
  DOC.iSel('nextBtnID').onclick = () => { next() }

  DOC.iSel('subjectID2').onchange = () => { gAppState.updatePermalink() }
  DOC.iSel('predicateID2').onchange = () => { gAppState.updatePermalink() }
  DOC.iSel('objectID2').onchange = () => { gAppState.updatePermalink() }
  DOC.iSel('docNameID2').onchange = () => { gAppState.updatePermalink() }

  DOC.iSel('clearBtnID2').onclick = () => { gAppState.clearInput() }
  DOC.iSel('insertBtnID2').onclick = () => { turtleGen() }
  DOC.iSel('deleteBtnID2').onclick = () => { turtleDel() }
  DOC.iSel('queryBtnID2').onclick = () => { click_queryGen() }
  DOC.iSel('dataBtnID2').onclick = () => { click_updateTable() }

  DOC.iSel('firstBtnID2').onclick = () => { first() }
  DOC.iSel('prevBtnID2').onclick = () => { previous() }
  DOC.iSel('lastBtnID2').onclick = () => { last() }
  DOC.iSel('nextBtnID2').onclick = () => { next() }

  // This function validates the uri used for PATCH
  DOC.iSel("docNameID2").addEventListener("input", docNameValidation);

  // If the subject is quoted or contains a space this function throws and error
  DOC.iSel("subjectID").addEventListener("input", validateSubject);
  DOC.iSel("subjectID2").addEventListener("input", validateSubject);

  // If the predicate is quoted, contains, or is a blank node a space this function throws and error
  DOC.iSel("predicateID").addEventListener("input", validatePredicate);
  DOC.iSel("predicateID2").addEventListener("input", validatePredicate);

  // update table and permalink on tab switch
  $('.nav-tabs a').on('shown.bs.tab', function (event) {
    var currTab = $(event.target).text();
    var prevTab = $(event.relatedTarget).text();
    if (currTab != "About" && prevTab != "About") {
      gAppState.updatePermalink();
      click_updateTable();
    }
  });

  if (typeof (globals) == 'undefined')
    $('#configError').modal('show');
  // check for permalink
  gAppState.loadPermalink();

  $('.dropdown-menu a[href="#ap"]').click(function(){
    pickActivity(this.text);
  });

  //docNameValue() ; // Checks/updates document name when page is loaded

});


