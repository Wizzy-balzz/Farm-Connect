// Native global fetch is used in Node.js 24+

// In-memory cache for static location data
const cache = {
  countries: null,
  regions: new Map(),
  districts: new Map(),
  places: new Map(),
  search: new Map()
};

// Comprehensive fallback dictionary for zero-downtime, offline, or API-limited operation
const FALLBACK_COUNTRIES = [
  { code: "IN", code3: "IND", name: "India", flag: "🇮🇳", region: "Asia", currency: "INR", symbol: "₹", callingCode: "+91", timezone: "Asia/Kolkata", lat: 20.5937, lng: 78.9629, adminTerm: "State", districtTerm: "District" },
  { code: "US", code3: "USA", name: "United States", flag: "🇺🇸", region: "Americas", currency: "USD", symbol: "$", callingCode: "+1", timezone: "America/New_York", lat: 37.0902, lng: -95.7129, adminTerm: "State", districtTerm: "County" },
  { code: "CA", code3: "CAN", name: "Canada", flag: "🇨🇦", region: "Americas", currency: "CAD", symbol: "CA$", callingCode: "+1", timezone: "America/Toronto", lat: 56.1304, lng: -106.3468, adminTerm: "Province", districtTerm: "District" },
  { code: "GB", code3: "GBR", name: "United Kingdom", flag: "🇬🇧", region: "Europe", currency: "GBP", symbol: "£", callingCode: "+44", timezone: "Europe/London", lat: 55.3781, lng: -3.436, adminTerm: "Country / Nation", districtTerm: "County" },
  { code: "AU", code3: "AUS", name: "Australia", flag: "🇦🇺", region: "Oceania", currency: "AUD", symbol: "A$", callingCode: "+61", timezone: "Australia/Sydney", lat: -25.2744, lng: 133.7751, adminTerm: "State / Territory", districtTerm: "Local Government Area" },
  { code: "CN", code3: "CHN", name: "China", flag: "🇨🇳", region: "Asia", currency: "CNY", symbol: "¥", callingCode: "+86", timezone: "Asia/Shanghai", lat: 35.8617, lng: 104.1954, adminTerm: "Province", districtTerm: "Prefecture / County" },
  { code: "DE", code3: "DEU", name: "Germany", flag: "🇩🇪", region: "Europe", currency: "EUR", symbol: "€", callingCode: "+49", timezone: "Europe/Berlin", lat: 51.1657, lng: 10.4515, adminTerm: "State (Bundesland)", districtTerm: "District (Landkreis)" },
  { code: "FR", code3: "FRA", name: "France", flag: "🇫🇷", region: "Europe", currency: "EUR", symbol: "€", callingCode: "+33", timezone: "Europe/Paris", lat: 46.2276, lng: 2.2137, adminTerm: "Region", districtTerm: "Department" },
  { code: "BR", code3: "BRA", name: "Brazil", flag: "🇧🇷", region: "Americas", currency: "BRL", symbol: "R$", callingCode: "+55", timezone: "America/Sao_Paulo", lat: -14.235, lng: -51.9253, adminTerm: "State", districtTerm: "Microregion" },
  { code: "ZA", code3: "ZAF", name: "South Africa", flag: "🇿🇦", region: "Africa", currency: "ZAR", symbol: "R", callingCode: "+27", timezone: "Africa/Johannesburg", lat: -30.5595, lng: 22.9375, adminTerm: "Province", districtTerm: "District Municipality" },
  { code: "JP", code3: "JPN", name: "Japan", flag: "🇯🇵", region: "Asia", currency: "JPY", symbol: "¥", callingCode: "+81", timezone: "Asia/Tokyo", lat: 36.2048, lng: 138.2529, adminTerm: "Prefecture", districtTerm: "District / Subprefecture" },
  { code: "MX", code3: "MEX", name: "Mexico", flag: "🇲🇽", region: "Americas", currency: "MXN", symbol: "Mex$", callingCode: "+52", timezone: "America/Mexico_City", lat: 23.6345, lng: -102.5528, adminTerm: "State", districtTerm: "Municipality" },
  { code: "NG", code3: "NGA", name: "Nigeria", flag: "🇳🇬", region: "Africa", currency: "NGN", symbol: "₦", callingCode: "+234", timezone: "Africa/Lagos", lat: 9.082, lng: 8.6753, adminTerm: "State", districtTerm: "Local Government Area" },
  { code: "KE", code3: "KEN", name: "Kenya", flag: "🇰🇪", region: "Africa", currency: "KES", symbol: "KSh", callingCode: "+254", timezone: "Africa/Nairobi", lat: -1.2921, lng: 36.8219, adminTerm: "County", districtTerm: "Sub-county" },
  { code: "NL", code3: "NLD", name: "Netherlands", flag: "🇳🇱", region: "Europe", currency: "EUR", symbol: "€", callingCode: "+31", timezone: "Europe/Amsterdam", lat: 52.1326, lng: 5.2913, adminTerm: "Province", districtTerm: "Municipality" },
  { code: "NZ", code3: "NZL", name: "New Zealand", flag: "🇳🇿", region: "Oceania", currency: "NZD", symbol: "NZ$", callingCode: "+64", timezone: "Pacific/Auckland", lat: -40.9006, lng: 174.886, adminTerm: "Region", districtTerm: "Territorial Authority" }
];

export function normalizeCountryCode(raw) {
  if (!raw) return "IN";
  const str = String(raw).trim().toUpperCase();
  if (str === "IN" || str === "IND" || str === "INDIA") return "IN";
  if (str === "US" || str === "USA" || str === "UNITED STATES") return "US";
  if (str === "CA" || str === "CAN" || str === "CANADA") return "CA";
  if (str === "GB" || str === "GBR" || str === "UNITED KINGDOM" || str === "UK") return "GB";
  if (str === "AU" || str === "AUS" || str === "AUSTRALIA") return "AU";
  if (str === "DE" || str === "DEU" || str === "GERMANY") return "DE";
  if (str === "FR" || str === "FRA" || str === "FRANCE") return "FR";
  if (str === "BR" || str === "BRA" || str === "BRAZIL") return "BR";
  if (str === "MX" || str === "MEX" || str === "MEXICO") return "MX";
  if (str === "JP" || str === "JPN" || str === "JAPAN") return "JP";
  if (str === "CN" || str === "CHN" || str === "CHINA") return "CN";
  if (str === "NG" || str === "NGA" || str === "NIGERIA") return "NG";
  if (str === "KE" || str === "KEN" || str === "KENYA") return "KE";
  if (str === "ZA" || str === "ZAF" || str === "SOUTH AFRICA") return "ZA";

  if (str.length === 2) return str;
  const found = FALLBACK_COUNTRIES.find(
    (c) => c.code === str || c.code3 === str || c.name.toUpperCase() === str
  );
  return found ? found.code : "IN";
}

const FALLBACK_REGIONS = {
  IN: [
    { code: "AP", name: "Andhra Pradesh", adminTerm: "State" },
    { code: "AR", name: "Arunachal Pradesh", adminTerm: "State" },
    { code: "AS", name: "Assam", adminTerm: "State" },
    { code: "BR", name: "Bihar", adminTerm: "State" },
    { code: "CG", name: "Chhattisgarh", adminTerm: "State" },
    { code: "GA", name: "Goa", adminTerm: "State" },
    { code: "GJ", name: "Gujarat", adminTerm: "State" },
    { code: "HR", name: "Haryana", adminTerm: "State" },
    { code: "HP", name: "Himachal Pradesh", adminTerm: "State" },
    { code: "JH", name: "Jharkhand", adminTerm: "State" },
    { code: "KA", name: "Karnataka", adminTerm: "State" },
    { code: "KL", name: "Kerala", adminTerm: "State" },
    { code: "MP", name: "Madhya Pradesh", adminTerm: "State" },
    { code: "MH", name: "Maharashtra", adminTerm: "State" },
    { code: "MN", name: "Manipur", adminTerm: "State" },
    { code: "ML", name: "Meghalaya", adminTerm: "State" },
    { code: "MZ", name: "Mizoram", adminTerm: "State" },
    { code: "NL", name: "Nagaland", adminTerm: "State" },
    { code: "OR", name: "Odisha", adminTerm: "State" },
    { code: "PB", name: "Punjab", adminTerm: "State" },
    { code: "RJ", name: "Rajasthan", adminTerm: "State" },
    { code: "SK", name: "Sikkim", adminTerm: "State" },
    { code: "TN", name: "Tamil Nadu", adminTerm: "State" },
    { code: "TG", name: "Telangana", adminTerm: "State" },
    { code: "TR", name: "Tripura", adminTerm: "State" },
    { code: "UP", name: "Uttar Pradesh", adminTerm: "State" },
    { code: "UK", name: "Uttarakhand", adminTerm: "State" },
    { code: "WB", name: "West Bengal", adminTerm: "State" },
    { code: "AN", name: "Andaman and Nicobar Islands", adminTerm: "Union Territory" },
    { code: "CH", name: "Chandigarh", adminTerm: "Union Territory" },
    { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu", adminTerm: "Union Territory" },
    { code: "DL", name: "Delhi (NCT)", adminTerm: "Union Territory" },
    { code: "JK", name: "Jammu and Kashmir", adminTerm: "Union Territory" },
    { code: "LA", name: "Ladakh", adminTerm: "Union Territory" },
    { code: "LD", name: "Lakshadweep", adminTerm: "Union Territory" },
    { code: "PY", name: "Puducherry", adminTerm: "Union Territory" }
  ],
  US: [
    { code: "AL", name: "Alabama", adminTerm: "State" },
    { code: "AK", name: "Alaska", adminTerm: "State" },
    { code: "AZ", name: "Arizona", adminTerm: "State" },
    { code: "AR", name: "Arkansas", adminTerm: "State" },
    { code: "CA", name: "California", adminTerm: "State" },
    { code: "CO", name: "Colorado", adminTerm: "State" },
    { code: "CT", name: "Connecticut", adminTerm: "State" },
    { code: "DE", name: "Delaware", adminTerm: "State" },
    { code: "FL", name: "Florida", adminTerm: "State" },
    { code: "GA", name: "Georgia", adminTerm: "State" },
    { code: "HI", name: "Hawaii", adminTerm: "State" },
    { code: "ID", name: "Idaho", adminTerm: "State" },
    { code: "IL", name: "Illinois", adminTerm: "State" },
    { code: "IN", name: "Indiana", adminTerm: "State" },
    { code: "IA", name: "Iowa", adminTerm: "State" },
    { code: "KS", name: "Kansas", adminTerm: "State" },
    { code: "KY", name: "Kentucky", adminTerm: "State" },
    { code: "LA", name: "Louisiana", adminTerm: "State" },
    { code: "ME", name: "Maine", adminTerm: "State" },
    { code: "MD", name: "Maryland", adminTerm: "State" },
    { code: "MA", name: "Massachusetts", adminTerm: "State" },
    { code: "MI", name: "Michigan", adminTerm: "State" },
    { code: "MN", name: "Minnesota", adminTerm: "State" },
    { code: "MS", name: "Mississippi", adminTerm: "State" },
    { code: "MO", name: "Missouri", adminTerm: "State" },
    { code: "MT", name: "Montana", adminTerm: "State" },
    { code: "NE", name: "Nebraska", adminTerm: "State" },
    { code: "NV", name: "Nevada", adminTerm: "State" },
    { code: "NH", name: "New Hampshire", adminTerm: "State" },
    { code: "NJ", name: "New Jersey", adminTerm: "State" },
    { code: "NM", name: "New Mexico", adminTerm: "State" },
    { code: "NY", name: "New York", adminTerm: "State" },
    { code: "NC", name: "North Carolina", adminTerm: "State" },
    { code: "ND", name: "North Dakota", adminTerm: "State" },
    { code: "OH", name: "Ohio", adminTerm: "State" },
    { code: "OK", name: "Oklahoma", adminTerm: "State" },
    { code: "OR", name: "Oregon", adminTerm: "State" },
    { code: "PA", name: "Pennsylvania", adminTerm: "State" },
    { code: "RI", name: "Rhode Island", adminTerm: "State" },
    { code: "SC", name: "South Carolina", adminTerm: "State" },
    { code: "SD", name: "South Dakota", adminTerm: "State" },
    { code: "TN", name: "Tennessee", adminTerm: "State" },
    { code: "TX", name: "Texas", adminTerm: "State" },
    { code: "UT", name: "Utah", adminTerm: "State" },
    { code: "VT", name: "Vermont", adminTerm: "State" },
    { code: "VA", name: "Virginia", adminTerm: "State" },
    { code: "WA", name: "Washington", adminTerm: "State" },
    { code: "WV", name: "West Virginia", adminTerm: "State" },
    { code: "WI", name: "Wisconsin", adminTerm: "State" },
    { code: "WY", name: "Wyoming", adminTerm: "State" },
    { code: "DC", name: "District of Columbia", adminTerm: "Federal District" }
  ],
  CA: [
    { code: "AB", name: "Alberta", adminTerm: "Province" },
    { code: "BC", name: "British Columbia", adminTerm: "Province" },
    { code: "MB", name: "Manitoba", adminTerm: "Province" },
    { code: "NB", name: "New Brunswick", adminTerm: "Province" },
    { code: "NL", name: "Newfoundland and Labrador", adminTerm: "Province" },
    { code: "NS", name: "Nova Scotia", adminTerm: "Province" },
    { code: "ON", name: "Ontario", adminTerm: "Province" },
    { code: "PE", name: "Prince Edward Island", adminTerm: "Province" },
    { code: "QC", name: "Quebec", adminTerm: "Province" },
    { code: "SK", name: "Saskatchewan", adminTerm: "Province" },
    { code: "NT", name: "Northwest Territories", adminTerm: "Territory" },
    { code: "NU", name: "Nunavut", adminTerm: "Territory" },
    { code: "YT", name: "Yukon", adminTerm: "Territory" }
  ],
  GB: [
    { code: "ENG", name: "England", adminTerm: "Country" },
    { code: "SCT", name: "Scotland", adminTerm: "Country" },
    { code: "WLS", name: "Wales", adminTerm: "Country" },
    { code: "NIR", name: "Northern Ireland", adminTerm: "Country" }
  ],
  AU: [
    { code: "NSW", name: "New South Wales", adminTerm: "State" },
    { code: "VIC", name: "Victoria", adminTerm: "State" },
    { code: "QLD", name: "Queensland", adminTerm: "State" },
    { code: "WA", name: "Western Australia", adminTerm: "State" },
    { code: "SA", name: "South Australia", adminTerm: "State" },
    { code: "TAS", name: "Tasmania", adminTerm: "State" },
    { code: "ACT", name: "Australian Capital Territory", adminTerm: "Territory" },
    { code: "NT", name: "Northern Territory", adminTerm: "Territory" }
  ],
  CN: [
    { code: "GD", name: "Guangdong", adminTerm: "Province" },
    { code: "SD", name: "Shandong", adminTerm: "Province" },
    { code: "HEN", name: "Henan", adminTerm: "Province" },
    { code: "SC", name: "Sichuan", adminTerm: "Province" },
    { code: "JS", name: "Jiangsu", adminTerm: "Province" },
    { code: "ZJ", name: "Zhejiang", adminTerm: "Province" },
    { code: "BJ", name: "Beijing", adminTerm: "Municipality" },
    { code: "SH", name: "Shanghai", adminTerm: "Municipality" }
  ],
  DE: [
    { code: "BW", name: "Baden-Württemberg", adminTerm: "State" },
    { code: "BY", name: "Bavaria", adminTerm: "State" },
    { code: "BE", name: "Berlin", adminTerm: "State" },
    { code: "BB", name: "Brandenburg", adminTerm: "State" },
    { code: "HE", name: "Hesse", adminTerm: "State" },
    { code: "NI", name: "Lower Saxony", adminTerm: "State" },
    { code: "NW", name: "North Rhine-Westphalia", adminTerm: "State" },
    { code: "SN", name: "Saxony", adminTerm: "State" }
  ],
  FR: [
    { code: "ARA", name: "Auvergne-Rhône-Alpes", adminTerm: "Region" },
    { code: "BFC", name: "Bourgogne-Franche-Comté", adminTerm: "Region" },
    { code: "BRE", name: "Brittany", adminTerm: "Region" },
    { code: "IDF", name: "Île-de-France", adminTerm: "Region" },
    { code: "NOR", name: "Normandy", adminTerm: "Region" },
    { code: "NAQ", name: "Nouvelle-Aquitaine", adminTerm: "Region" },
    { code: "OCC", name: "Occitanie", adminTerm: "Region" },
    { code: "PAC", name: "Provence-Alpes-Côte d'Azur", adminTerm: "Region" }
  ]
};

const FALLBACK_DISTRICTS = {
  "IN-TN": [
    { code: "THO", name: "Thoothukudi" },
    { code: "CHE", name: "Chennai" },
    { code: "COI", name: "Coimbatore" },
    { code: "MAD", name: "Madurai" },
    { code: "SAL", name: "Salem" },
    { code: "TRY", name: "Tiruchirappalli" },
    { code: "TNE", name: "Tirunelveli" },
    { code: "ERO", name: "Erode" },
    { code: "VEL", name: "Vellore" }
  ],
  "IN-MH": [
    { code: "MUM", name: "Mumbai" },
    { code: "NAS", name: "Nashik" },
    { code: "PUN", name: "Pune" },
    { code: "NAG", name: "Nagpur" },
    { code: "THA", name: "Thane" },
    { code: "PAL", name: "Palghar" },
    { code: "RAI", name: "Raigad" },
    { code: "RAT", name: "Ratnagiri" },
    { code: "SOL", name: "Solapur" },
    { code: "KOL", name: "Kolhapur" },
    { code: "AUR", name: "Chhatrapati Sambhajinagar" },
    { code: "AHM", name: "Ahilyanagar" }
  ],
  "IN-PB": [
    { code: "LUD", name: "Ludhiana" },
    { code: "AMR", name: "Amritsar" },
    { code: "JAL", name: "Jalandhar" },
    { code: "PAT", name: "Patiala" },
    { code: "BAT", name: "Bathinda" },
    { code: "MOH", name: "Mohali" }
  ],
  "IN-KL": [
    { code: "WAY", name: "Wayanad" },
    { code: "IDU", name: "Idukki" },
    { code: "ERS", name: "Ernakulam" },
    { code: "TVM", name: "Thiruvananthapuram" },
    { code: "CLT", name: "Kozhikode" },
    { code: "TCR", name: "Thrissur" }
  ],
  "IN-KA": [
    { code: "BLR", name: "Bengaluru Urban" },
    { code: "MYS", name: "Mysuru" },
    { code: "MNG", name: "Mangaluru (Dakshina Kannada)" },
    { code: "HUB", name: "Hubballi-Dharwad" }
  ],
  "IN-GJ": [
    { code: "AMD", name: "Ahmedabad" },
    { code: "SUR", name: "Surat" },
    { code: "BRD", name: "Vadodara" },
    { code: "RAJ", name: "Rajkot" }
  ],
  "IN-UP": [
    { code: "LKO", name: "Lucknow" },
    { code: "KNP", name: "Kanpur" },
    { code: "AGR", name: "Agra" },
    { code: "VNS", name: "Varanasi" },
    { code: "NOI", name: "Gautam Buddha Nagar (Noida)" }
  ],
  "IN-DL": [
    { code: "NDL", name: "New Delhi" },
    { code: "CDL", name: "Central Delhi" },
    { code: "EDL", name: "East Delhi" },
    { code: "WDL", name: "West Delhi" }
  ],
  "US-CA": [
    { code: "LA", name: "Los Angeles County" },
    { code: "FRE", name: "Fresno County" },
    { code: "MON", name: "Monterey County" },
    { code: "KER", name: "Kern County" },
    { code: "SD", name: "San Diego County" },
    { code: "SF", name: "San Francisco County" }
  ],
  "US-TX": [
    { code: "HAR", name: "Harris County" },
    { code: "DAL", name: "Dallas County" },
    { code: "TRA", name: "Travis County" },
    { code: "BEX", name: "Bexar County" }
  ],
  "CA-ON": [
    { code: "TOR", name: "Toronto" },
    { code: "PEE", name: "Peel Region" },
    { code: "OTT", name: "Ottawa" }
  ],
  "GB-ENG": [
    { code: "GLO", name: "Greater London" },
    { code: "MAN", name: "Greater Manchester" },
    { code: "YOR", name: "North Yorkshire" }
  ]
};

const FALLBACK_PLACES = {
  "IN-TN-THO": [
    { code: "KOV", name: "Kovilpatti", lat: 9.1724, lng: 77.8687 },
    { code: "THO-C", name: "Thoothukudi City", lat: 8.7642, lng: 78.1348 },
    { code: "TIR", name: "Tiruchendur", lat: 8.4965, lng: 78.1278 }
  ],
  "IN-MH-NAS": [
    { code: "NAS-C", name: "Nashik City", lat: 19.9975, lng: 73.7898 },
    { code: "MAL", name: "Malegaon", lat: 20.5523, lng: 74.5269 }
  ],
  "IN-MH-MUM": [
    { code: "MUM-S", name: "Mumbai South", lat: 18.922, lng: 72.8347 },
    { code: "AND", name: "Andheri", lat: 19.1197, lng: 72.8464 },
    { code: "BAN", name: "Bandra", lat: 19.0596, lng: 72.8295 },
    { code: "POW", name: "Powai", lat: 19.1176, lng: 72.906 }
  ],
  "IN-MH-PUN": [
    { code: "PUN-C", name: "Pune City", lat: 18.5204, lng: 73.8567 },
    { code: "PCM", name: "Pimpri-Chinchwad", lat: 18.6298, lng: 73.7997 }
  ],
  "IN-PB-LUD": [
    { code: "LUD-C", name: "Ludhiana City", lat: 30.901, lng: 75.8573 },
    { code: "KHAN", name: "Khanna", lat: 30.7042, lng: 76.2163 }
  ],
  "IN-KL-WAY": [
    { code: "KAL", name: "Kalpetta", lat: 11.6094, lng: 76.0827 },
    { code: "MAN-W", name: "Mananthavady", lat: 11.8026, lng: 76.0033 }
  ],
  "US-CA-LA": [
    { code: "LA-C", name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
    { code: "PAS", name: "Pasadena", lat: 34.1478, lng: -118.1445 }
  ],
  "GB-ENG-GLO": [
    { code: "LON-C", name: "City of London", lat: 51.5074, lng: -0.1278 },
    { code: "CAM", name: "Camden", lat: 51.529, lng: -0.1255 }
  ]
};

/**
 * Fetch list of countries normalized with ISO codes, currencies, flags, and admin terminology
 */
export async function getCountries() {
  if (cache.countries) return cache.countries;

  try {
    const res = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,region,subregion,currencies,idd,latlng,timezones,flag",
      { signal: AbortSignal.timeout(5000) }
    );

    if (res.ok && res.status >= 200 && res.status < 300) {
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.warn("[LocationService] RestCountries API returned non-JSON response:", jsonErr.message);
        cache.countries = FALLBACK_COUNTRIES;
        return FALLBACK_COUNTRIES;
      }

      if (!Array.isArray(data)) {
        const preview = typeof data === "object" && data !== null ? JSON.stringify(data).slice(0, 160) : String(data);
        console.warn(`[LocationService] RestCountries API returned non-array payload (${preview}). Using comprehensive fallback countries.`);
        cache.countries = FALLBACK_COUNTRIES;
        return FALLBACK_COUNTRIES;
      }

      const mapped = data.map((c) => {
        if (!c || typeof c !== "object") return null;
        const currCode = c.currencies && typeof c.currencies === "object" ? Object.keys(c.currencies)[0] : "USD";
        const currObj = (c.currencies && currCode) ? c.currencies[currCode] || {} : {};
        const callCode = c.idd && c.idd.root ? `${c.idd.root}${c.idd.suffixes && Array.isArray(c.idd.suffixes) ? c.idd.suffixes[0] : ""}` : "";
        
        const fb = FALLBACK_COUNTRIES.find((f) => f.code === c.cca2) || {};

        return {
          code: c.cca2 || fb.code,
          code3: c.cca3 || fb.code3,
          name: (c.name && (c.name.common || c.name.official)) || fb.name || "Unknown",
          flag: c.flag || (c.flags && (c.flags.emoji || c.flags.png)) || fb.flag || "🌐",
          region: c.region || fb.region || "Global",
          subregion: c.subregion || fb.subregion || "",
          currency: currCode || fb.currency || "USD",
          symbol: currObj.symbol || fb.symbol || "$",
          callingCode: callCode || fb.callingCode || "",
          timezone: c.timezones && Array.isArray(c.timezones) && c.timezones.length ? c.timezones[0] : (fb.timezone || "UTC"),
          lat: c.latlng && Array.isArray(c.latlng) && c.latlng.length >= 2 ? c.latlng[0] : (fb.lat || 0),
          lng: c.latlng && Array.isArray(c.latlng) && c.latlng.length >= 2 ? c.latlng[1] : (fb.lng || 0),
          adminTerm: fb.adminTerm || "State / Region",
          districtTerm: fb.districtTerm || "District / County"
        };
      }).filter(Boolean);

      if (mapped.length > 0) {
        mapped.sort((a, b) => a.name.localeCompare(b.name));
        cache.countries = mapped;
        return mapped;
      }
    } else {
      console.warn(`[LocationService] RestCountries API request failed with HTTP ${res.status} (${res.statusText}). Using comprehensive fallback countries.`);
    }
  } catch (err) {
    console.warn("[LocationService] RestCountries API network or parse error, using comprehensive fallback countries:", err.message);
  }

  cache.countries = FALLBACK_COUNTRIES;
  return FALLBACK_COUNTRIES;
}

/**
 * Fetch dynamic administrative regions/states for a given country code
 */
export async function getRegions(rawCountryCode) {
  const code = normalizeCountryCode(rawCountryCode);
  if (cache.regions.has(code)) return cache.regions.get(code);

  const username = process.env.GEONAMES_USERNAME;
  if (username) {
    try {
      const res = await fetch(`http://api.geonames.org/searchJSON?country=${code}&featureCode=ADM1&maxRows=100&username=${username}`);
      if (res.ok) {
        const data = await res.json();
        if (data.geonames && Array.isArray(data.geonames) && data.geonames.length > 0) {
          const mapped = data.geonames.map((g) => ({
            code: g.adminCode1 || g.geonameId.toString(),
            name: g.name || g.toponymName,
            geonameId: g.geonameId,
            adminTerm: "Region / State"
          }));
          mapped.sort((a, b) => a.name.localeCompare(b.name));
          cache.regions.set(code, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn(`GeoNames API error fetching regions for ${code}:`, err.message);
    }
  }

  const fallback = FALLBACK_REGIONS[code] || [
    { code: `${code}-R1`, name: `${code} Northern Region`, adminTerm: "Region" },
    { code: `${code}-R2`, name: `${code} Central Region`, adminTerm: "Region" },
    { code: `${code}-R3`, name: `${code} Southern Region`, adminTerm: "Region" },
    { code: `${code}-R4`, name: `${code} Eastern Region`, adminTerm: "Region" },
    { code: `${code}-R5`, name: `${code} Western Region`, adminTerm: "Region" }
  ];

  cache.regions.set(code, fallback);
  return fallback;
}

/**
 * Fetch dynamic districts/counties for a given country and region code
 */
export async function getDistricts(rawCountryCode, rawRegionCode) {
  const cCode = normalizeCountryCode(rawCountryCode);
  const regInput = (rawRegionCode || "").trim();

  // Look up matching region code if name was passed
  const regions = await getRegions(cCode);
  const matchReg = regions.find(
    (r) => r.name.toLowerCase() === regInput.toLowerCase() || r.code.toLowerCase() === regInput.toLowerCase()
  );
  const rCode = matchReg ? matchReg.code : regInput.toUpperCase();
  const key = `${cCode}-${rCode}`;

  if (cache.districts.has(key)) return cache.districts.get(key);

  const username = process.env.GEONAMES_USERNAME;
  if (username) {
    try {
      const res = await fetch(`http://api.geonames.org/searchJSON?country=${cCode}&adminCode1=${rCode}&featureCode=ADM2&maxRows=100&username=${username}`);
      if (res.ok) {
        const data = await res.json();
        if (data.geonames && Array.isArray(data.geonames) && data.geonames.length > 0) {
          const mapped = data.geonames.map((g) => ({
            code: g.adminCode2 || g.geonameId.toString(),
            name: g.name || g.toponymName,
            geonameId: g.geonameId
          }));
          mapped.sort((a, b) => a.name.localeCompare(b.name));
          cache.districts.set(key, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn(`GeoNames API error fetching districts for ${key}:`, err.message);
    }
  }

  const fallback = FALLBACK_DISTRICTS[key] || [
    { code: `${key}-D1`, name: `${regInput || rCode} District 1` },
    { code: `${key}-D2`, name: `${regInput || rCode} District 2` },
    { code: `${key}-D3`, name: `${regInput || rCode} Central District` }
  ];

  cache.districts.set(key, fallback);
  return fallback;
}

/**
 * Fetch places/cities for a given district
 */
export async function getPlaces(rawCountryCode, rawRegionCode, rawDistrictCode) {
  const cCode = normalizeCountryCode(rawCountryCode);
  const regInput = (rawRegionCode || "").trim();
  const distInput = (rawDistrictCode || "").trim();

  const districts = await getDistricts(cCode, regInput);
  const matchDist = districts.find(
    (d) => d.name.toLowerCase() === distInput.toLowerCase() || d.code.toLowerCase() === distInput.toLowerCase()
  );
  const dCode = matchDist ? matchDist.code : distInput.toUpperCase();

  const regions = await getRegions(cCode);
  const matchReg = regions.find(
    (r) => r.name.toLowerCase() === regInput.toLowerCase() || r.code.toLowerCase() === regInput.toLowerCase()
  );
  const rCode = matchReg ? matchReg.code : regInput.toUpperCase();

  const key = `${cCode}-${rCode}-${dCode}`;
  if (cache.places.has(key)) return cache.places.get(key);

  const username = process.env.GEONAMES_USERNAME;
  if (username) {
    try {
      const res = await fetch(`http://api.geonames.org/searchJSON?country=${cCode}&adminCode1=${rCode}&adminCode2=${dCode}&featureClass=P&maxRows=50&username=${username}`);
      if (res.ok) {
        const data = await res.json();
        if (data.geonames && Array.isArray(data.geonames) && data.geonames.length > 0) {
          const mapped = data.geonames.map((g) => ({
            code: g.geonameId.toString(),
            name: g.name || g.toponymName,
            lat: parseFloat(g.lat),
            lng: parseFloat(g.lng)
          }));
          mapped.sort((a, b) => a.name.localeCompare(b.name));
          cache.places.set(key, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn(`GeoNames API error fetching places for ${key}:`, err.message);
    }
  }

  const fallback = FALLBACK_PLACES[key] || [
    { code: `${key}-P1`, name: `${distInput || dCode} Central Place`, lat: 20.0, lng: 78.0 },
    { code: `${key}-P2`, name: `${distInput || dCode} North Station`, lat: 20.05, lng: 78.05 }
  ];

  cache.places.set(key, fallback);
  return fallback;
}

// Rate limiter for OpenStreetMap Nominatim (strictly respecting 1 request per second policy)
let lastNominatimRequestTime = 0;
async function rateLimitedNominatimFetch(url) {
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequestTime;
  const minInterval = 1050; // 1.05s buffer to strictly satisfy 1 req/sec limit
  if (timeSinceLast < minInterval) {
    await new Promise((resolve) => setTimeout(resolve, minInterval - timeSinceLast));
  }
  lastNominatimRequestTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FarmConnect-AgriPlatform/2.0 (contact@farmconnect.in; B2B Agricultural Produce System)",
        "Accept": "application/json"
      }
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// In-memory Nominatim cache with 24-hour TTL
const nominatimSearchCache = new Map();
const nominatimReverseCache = new Map();
const NOMINATIM_CACHE_TTL = 24 * 60 * 60 * 1000;

function getCached(cacheMap, key) {
  const item = cacheMap.get(key);
  if (!item) return null;
  if (Date.now() - item.cachedAt > NOMINATIM_CACHE_TTL) {
    cacheMap.delete(key);
    return null;
  }
  return item.data;
}

function setCached(cacheMap, key, data) {
  if (cacheMap.size > 2000) {
    const firstKey = cacheMap.keys().next().value;
    cacheMap.delete(firstKey);
  }
  cacheMap.set(key, { data, cachedAt: Date.now() });
}

/**
 * Normalize Nominatim address component into FarmConnect standard object:
 * { latitude, longitude, address, city, district, state, pincode, country }
 */
function normalizeNominatimResult(item) {
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  const addr = item.address || {};

  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.suburb ||
    addr.county ||
    item.name ||
    "";

  const district =
    addr.state_district ||
    addr.district ||
    addr.county ||
    addr.subdistrict ||
    city ||
    "";

  const state = addr.state || addr.region || addr.province || "";
  const country = addr.country || "India";
  const countryCode = (addr.country_code || "in").toUpperCase();
  const pincode = addr.postcode || "";

  // Build clean display street / building address
  const streetParts = [
    addr.road || addr.street,
    addr.neighbourhood || addr.suburb,
    addr.hamlet
  ].filter(Boolean);
  const streetAddress = streetParts.length > 0 ? streetParts.join(", ") : (item.name || city);

  return {
    id: String(item.place_id || `${lat}_${lon}`),
    latitude: lat,
    longitude: lon,
    address: streetAddress,
    city: city,
    district: district,
    state: state,
    region: state, // Backward-compatibility alias for FarmConnect region
    pincode: pincode,
    postalCode: pincode, // Alias
    country: country,
    countryCode: countryCode,
    countryName: country,
    placeName: city || item.name || "Selected Location",
    formattedAddress: item.display_name || `${city}, ${state}, ${country}`
  };
}

/**
 * Search global & All-India locations via OpenStreetMap Nominatim
 */
export async function searchLocations(query, rawCountryCode = "IN") {
  const q = (query || "").trim();
  if (q.length < 2) return [];

  const cCode = rawCountryCode ? normalizeCountryCode(rawCountryCode).toLowerCase() : "";
  const cacheKey = `${cCode}:${q.toLowerCase()}`;
  const cached = getCached(nominatimSearchCache, cacheKey);
  if (cached) return cached;

  // 1. Query OpenStreetMap Nominatim API
  try {
    const countryFilter = cCode ? `&countrycodes=${encodeURIComponent(cCode)}` : "";
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6${countryFilter}`;
    const res = await rateLimitedNominatimFetch(url);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map(normalizeNominatimResult);
        setCached(nominatimSearchCache, cacheKey, results);
        return results;
      }
    }
  } catch (err) {
    console.warn("OpenStreetMap Nominatim search error, utilizing resilient local lookup:", err.message);
  }

  // 2. Resilient local fallback across ALL registered regions and districts (All-India & Global)
  const qLower = q.toLowerCase();
  const fallbackResults = [];

  for (const [key, placeList] of Object.entries(FALLBACK_PLACES)) {
    const parts = key.split("-"); // [cCode, rCode, dCode]
    const cObj = FALLBACK_COUNTRIES.find((c) => c.code === parts[0]) || { name: "India", code: "IN" };
    const rObj = (FALLBACK_REGIONS[parts[0]] || []).find((r) => r.code === parts[1]);
    const dObj = (FALLBACK_DISTRICTS[`${parts[0]}-${parts[1]}`] || []).find((d) => d.code === parts[2]);

    for (const p of placeList) {
      if (
        p.name.toLowerCase().includes(qLower) ||
        (dObj && dObj.name.toLowerCase().includes(qLower)) ||
        (rObj && rObj.name.toLowerCase().includes(qLower))
      ) {
        fallbackResults.push({
          id: p.code,
          latitude: p.lat,
          longitude: p.lng,
          address: p.name,
          city: p.name,
          district: dObj ? dObj.name : "",
          state: rObj ? rObj.name : "",
          region: rObj ? rObj.name : "",
          pincode: "",
          postalCode: "",
          country: cObj.name,
          countryCode: cObj.code,
          countryName: cObj.name,
          placeName: p.name,
          formattedAddress: `${p.name}, ${dObj ? dObj.name + ", " : ""}${rObj ? rObj.name + ", " : ""}${cObj.name}`
        });
      }
    }
  }

  // Also check region/state and district names directly for All-India coverage
  if (fallbackResults.length === 0) {
    for (const [cKey, rList] of Object.entries(FALLBACK_REGIONS)) {
      const cObj = FALLBACK_COUNTRIES.find((c) => c.code === cKey) || { name: "India", code: "IN" };
      for (const r of rList) {
        if (r.name.toLowerCase().includes(qLower)) {
          fallbackResults.push({
            id: `reg-${r.code}`,
            latitude: 20.5937,
            longitude: 78.9629,
            address: r.name,
            city: r.name,
            district: "",
            state: r.name,
            region: r.name,
            pincode: "",
            postalCode: "",
            country: cObj.name,
            countryCode: cObj.code,
            countryName: cObj.name,
            placeName: r.name,
            formattedAddress: `${r.name}, ${cObj.name}`
          });
        }
      }
    }
  }

  const sliced = fallbackResults.slice(0, 6);
  if (sliced.length > 0) {
    setCached(nominatimSearchCache, cacheKey, sliced);
  }
  return sliced;
}

/**
 * Reverse geocode latitude and longitude to normalized location object via OpenStreetMap Nominatim
 */
export async function reverseGeocode(lat, lng) {
  const nLat = parseFloat(lat);
  const nLng = parseFloat(lng);

  if (isNaN(nLat) || isNaN(nLng) || nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
    return null;
  }

  // Cache key with 4 decimal digits precision (~11 meters)
  const cacheKey = `${nLat.toFixed(4)},${nLng.toFixed(4)}`;
  const cached = getCached(nominatimReverseCache, cacheKey);
  if (cached) return cached;

  // 1. Query OpenStreetMap Nominatim Reverse Geocoding API
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${nLat}&lon=${nLng}&format=json&addressdetails=1`;
    const res = await rateLimitedNominatimFetch(url);

    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) {
        const normalized = normalizeNominatimResult(data);
        // Ensure lat/lng match exact request coordinates
        normalized.latitude = nLat;
        normalized.longitude = nLng;
        setCached(nominatimReverseCache, cacheKey, normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn("OpenStreetMap Nominatim reverse geocode error, using coordinate fallback:", err.message);
  }

  // 2. Safe coordinate-based fallback without hardcoding Tamil Nadu
  const fallback = {
    id: `coord_${cacheKey}`,
    latitude: nLat,
    longitude: nLng,
    address: `Coordinates: ${nLat.toFixed(4)}, ${nLng.toFixed(4)}`,
    city: "Identified Coordinates",
    district: "Local Region",
    state: "India",
    region: "India",
    pincode: "",
    postalCode: "",
    country: "India",
    countryCode: "IN",
    countryName: "India",
    placeName: `${nLat.toFixed(4)}, ${nLng.toFixed(4)}`,
    formattedAddress: `${nLat.toFixed(4)}, ${nLng.toFixed(4)}, India`
  };

  return fallback;
}

