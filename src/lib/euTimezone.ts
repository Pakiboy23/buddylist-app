// EU/EEA member states, UK, and Switzerland (nFADP mirrors GDPR).
// Used to decide whether to show the storage-disclosure notice.
// Being inclusive on border cases (CH, overseas territories) is preferable
// to missing users who have disclosure rights.
const EU_EEA_UK_TIMEZONES = new Set([
  // EU member states
  'Europe/Amsterdam',    // Netherlands
  'Europe/Athens',       // Greece
  'Europe/Berlin',       // Germany
  'Europe/Bratislava',   // Slovakia
  'Europe/Brussels',     // Belgium
  'Europe/Bucharest',    // Romania
  'Europe/Budapest',     // Hungary
  'Europe/Copenhagen',   // Denmark
  'Europe/Dublin',       // Ireland
  'Europe/Helsinki',     // Finland
  'Europe/Lisbon',       // Portugal
  'Europe/Ljubljana',    // Slovenia
  'Europe/Luxembourg',   // Luxembourg
  'Europe/Madrid',       // Spain
  'Europe/Malta',        // Malta
  'Europe/Mariehamn',    // Åland Islands (Finland)
  'Europe/Nicosia',      // Cyprus
  'Europe/Paris',        // France
  'Europe/Prague',       // Czech Republic
  'Europe/Riga',         // Latvia
  'Europe/Rome',         // Italy
  'Europe/Sofia',        // Bulgaria
  'Europe/Stockholm',    // Sweden
  'Europe/Tallinn',      // Estonia
  'Europe/Vienna',       // Austria
  'Europe/Vilnius',      // Lithuania
  'Europe/Warsaw',       // Poland
  'Europe/Zagreb',       // Croatia
  // EEA (non-EU)
  'Europe/Oslo',         // Norway
  'Europe/Reykjavik',    // Iceland
  'Europe/Vaduz',        // Liechtenstein
  'Arctic/Longyearbyen', // Norway (Svalbard)
  // UK
  'Europe/London',
  // EU overseas territories that use non-Europe/ zone names
  'Atlantic/Azores',     // Portugal
  'Atlantic/Canary',     // Spain (Canary Islands)
  'Atlantic/Madeira',    // Portugal
  'Atlantic/Faroe',      // Faroe Islands (Denmark)
  'Africa/Ceuta',        // Spain (Ceuta)
  // Switzerland — nFADP has equivalent storage-disclosure requirements
  'Europe/Zurich',
]);

export function isEuTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return EU_EEA_UK_TIMEZONES.has(tz);
  } catch {
    return false;
  }
}
