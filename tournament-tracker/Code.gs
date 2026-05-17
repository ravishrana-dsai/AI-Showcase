const SHEET_NAME = 'Database';
const SPREADSHEET_ID = '187BaVDlkDOa4PRe_t-oIwIyp8WxFbzUMbbgwwVG83KU';

const COLS = {
  eventName:              1,
  organizer:              2,
  organizerContact:       3,
  venueName:              4,
  city:                   5,
  startDate:              6,
  endDate:                7,
  pipeline:               8,
  partneredAs:            9,
  playerDetailsReceived:  10,
  socialMediaSpoc:        11,
  fixtureSchedule:        12,
  brandings:              13,
  notes:                  14,
  noOfRequests:           15,
  noOfParticipants:       16,
  organizerPoc:           17,
  noOfCourts:             18
};

const PIPELINE_VALUES = ['Upcoming', 'In Talks', 'Deal Done', 'Completed'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DP Events Dashboard')
    .addItem('Open Dashboard', 'openDashboard')
    .addToUi();
}

function openDashboard() {
  var url = 'https://script.google.com/a/macros/dreamplayai.com/s/AKfycbxyITrb-XcSGrcyKVkW3J9RuJnOdiIKojSQ4-8bTRRNjN2zye_nkXS5spC14FshSsDB7Q/exec';
  var html = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '","_blank");google.script.host.close();</script>'
  ).setWidth(1).setHeight(1);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening dashboard...');
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('DP Events Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
}

function pad_(n) { return n < 10 ? '0' + n : String(n); }

function formatDate_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.getFullYear() + '-' + pad_(val.getMonth() + 1) + '-' + pad_(val.getDate());
  }
  return String(val);
}

function getEvents() {
  const sheet = getSheet_();
  const data  = sheet.getDataRange().getValues();
  const events = [];

  // Row 0: group headers  Row 1: sub-headers  Row 2+: data
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1]) continue;
    events.push({
      rowIndex:              i + 1,
      eventName:             String(row[0]  || ''),
      organizer:             String(row[1]  || ''),
      organizerContact:      String(row[2]  || ''),
      venueName:             String(row[3]  || ''),
      city:                  String(row[4]  || ''),
      startDate:             formatDate_(row[5]),
      endDate:               formatDate_(row[6]),
      pipeline:              String(row[7]  || 'Upcoming'),
      partneredAs:           String(row[8]  || ''),
      playerDetailsReceived: String(row[9]  || ''),
      socialMediaSpoc:       String(row[10] || ''),
      fixtureSchedule:       String(row[11] || ''),
      brandings:             String(row[12] || ''),
      notes:                 String(row[13] || ''),
      noOfRequests:          String(row[14] || ''),
      noOfParticipants:      String(row[15] || ''),
      organizerPoc:          String(row[16] || ''),
      noOfCourts:            String(row[17] || '')
    });
  }
  return events;
}

function updateEventFull(rowIndex, data) {
  const sheet = getSheet_();
  sheet.getRange(rowIndex, COLS.eventName, 1, 18).setValues([[
    data.eventName,
    data.organizer,
    data.organizerContact,
    data.venueName,
    data.city,
    data.startDate,
    data.endDate,
    data.pipeline,
    data.partneredAs,
    data.playerDetailsReceived,
    data.socialMediaSpoc,
    data.fixtureSchedule,
    data.brandings,
    data.notes,
    data.noOfRequests,
    data.noOfParticipants,
    data.organizerPoc,
    data.noOfCourts
  ]]);
  return { success: true };
}

function addEvent(data) {
  const sheet = getSheet_();
  sheet.appendRow([
    data.eventName,
    data.organizer,
    data.organizerContact,
    data.venueName,
    data.city,
    data.startDate,
    data.endDate,
    data.pipeline || 'Upcoming',
    data.partneredAs,
    data.playerDetailsReceived,
    data.socialMediaSpoc,
    data.fixtureSchedule,
    data.brandings,
    data.notes,
    data.noOfRequests,
    data.noOfParticipants,
    data.organizerPoc,
    data.noOfCourts
  ]);
  return { success: true, rowIndex: sheet.getLastRow() };
}

function deleteEvent(rowIndex) {
  getSheet_().deleteRow(rowIndex);
  return { success: true };
}

// Run ONCE after migrateSchema() to add the Pipeline column.
// Inserts "Pipeline" at column 8, shifting Partnered As and later columns right.
function migratePipeline() {
  const sheet = getSheet_();

  // Insert blank column at position 8 (before current col 8 "Partnered as")
  sheet.insertColumnBefore(8);

  // Set header
  sheet.getRange(1, 8).setValue('Pipeline');

  // Default all existing data rows to "Upcoming"
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const range = sheet.getRange(3, 8, lastRow - 2, 1);
    range.setValue('Upcoming');
  }

  SpreadsheetApp.flush();
  Logger.log('Pipeline migration complete. Column 8 = Pipeline, all existing rows set to Upcoming.');
}

// Run this ONCE first if you haven't already run migrateSchema().
function migrateSchema() {
  const sheet = getSheet_();
  sheet.insertColumnBefore(7);
  sheet.getRange(1, 6).setValue('Start Date');
  sheet.getRange(1, 7).setValue('End Date');
  sheet.getRange(2, 7).clearContent();
  SpreadsheetApp.flush();
  Logger.log('Schema migration complete. Column 6 = Start Date, Column 7 = End Date.');
}
