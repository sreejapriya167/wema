export const ALL_STATES = [
  "All States",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
  "Unassigned"
];

const CITY_STATE_MAP = {
  hyderabad: "Telangana",
  chennai: "Tamil Nadu",
  mumbai: "Maharashtra",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  delhi: "Delhi",
  kolkata: "West Bengal",
  pune: "Maharashtra",
  kochi: "Kerala",
  ahmedabad: "Gujarat",
  visakhapatnam: "Andhra Pradesh",
  vizag: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh",
  guntur: "Andhra Pradesh",
  tirupati: "Andhra Pradesh",
  rajahmundry: "Andhra Pradesh",
  kakinada: "Andhra Pradesh",
  nellore: "Andhra Pradesh",
  kavali: "Andhra Pradesh",
  kurnool: "Andhra Pradesh",
  anantapur: "Andhra Pradesh",
  warangal: "Telangana",
  karimnagar: "Telangana",
  nizamabad: "Telangana",
  thane: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  aurangabad: "Maharashtra",
  jaipur: "Rajasthan",
  jodhpur: "Rajasthan",
  udaipur: "Rajasthan",
  surat: "Gujarat",
  vadodara: "Gujarat",
  rajkot: "Gujarat",
  bhopal: "Madhya Pradesh",
  indore: "Madhya Pradesh",
  gwalior: "Madhya Pradesh",
  lucknow: "Uttar Pradesh",
  noida: "Uttar Pradesh",
  ghaziabad: "Uttar Pradesh",
  kanpur: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  patna: "Bihar",
  ranchi: "Jharkhand",
  bhubaneswar: "Odisha",
  cuttack: "Odisha",
  guwahati: "Assam",
  shillong: "Meghalaya",
  imphal: "Manipur",
  agartala: "Tripura",
  chandigarh: "Chandigarh",
  dehradun: "Uttarakhand",
  jammu: "Jammu and Kashmir",
  srinagar: "Jammu and Kashmir",
  goa: "Goa",
  panaji: "Goa"
};

export function normalizeCity(city = "") {
  return city
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function deriveStateFromCity(city = "") {
  return CITY_STATE_MAP[normalizeCity(city)] || "Unassigned";
}

export function listStatesFromCities(cities = []) {
  const derived = new Set(cities.map((city) => deriveStateFromCity(city)).filter(Boolean));
  return ALL_STATES.filter((state) => state === "All States" || derived.has(state));
}
