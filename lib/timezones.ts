/**
 * Country → cities, instead of asking someone to type "America/Montevideo".
 *
 * The IANA identifier is still what gets stored (ADR-0014 depends on it:
 * the generator converts local time to UTC with AT TIME ZONE, and only a
 * zone *name* survives DST changes correctly). This list is just a
 * human-facing way to pick one.
 *
 * Scoped to Latin America plus Spain and the US -- adding a country is
 * one entry here, and picking an unlisted zone is still possible by
 * storing it directly.
 */
export interface Country {
  code: string;
  name: string;
  zones: { iana: string; city: string }[];
}

export const COUNTRIES: Country[] = [
  { code: "UY", name: "Uruguay", zones: [{ iana: "America/Montevideo", city: "Montevideo" }] },
  {
    code: "AR",
    name: "Argentina",
    zones: [
      { iana: "America/Argentina/Buenos_Aires", city: "Buenos Aires" },
      { iana: "America/Argentina/Cordoba", city: "Córdoba" },
      { iana: "America/Argentina/Mendoza", city: "Mendoza" },
      { iana: "America/Argentina/Salta", city: "Salta" },
      { iana: "America/Argentina/Tucuman", city: "Tucumán" },
      { iana: "America/Argentina/Ushuaia", city: "Ushuaia" },
    ],
  },
  {
    code: "BR",
    name: "Brasil",
    zones: [
      { iana: "America/Sao_Paulo", city: "São Paulo" },
      { iana: "America/Bahia", city: "Salvador" },
      { iana: "America/Fortaleza", city: "Fortaleza" },
      { iana: "America/Recife", city: "Recife" },
      { iana: "America/Belem", city: "Belém" },
      { iana: "America/Manaus", city: "Manaos" },
      { iana: "America/Porto_Velho", city: "Porto Velho" },
      { iana: "America/Rio_Branco", city: "Rio Branco" },
    ],
  },
  {
    code: "CL",
    name: "Chile",
    zones: [
      { iana: "America/Santiago", city: "Santiago" },
      { iana: "Pacific/Easter", city: "Isla de Pascua" },
    ],
  },
  { code: "PY", name: "Paraguay", zones: [{ iana: "America/Asuncion", city: "Asunción" }] },
  { code: "BO", name: "Bolivia", zones: [{ iana: "America/La_Paz", city: "La Paz" }] },
  { code: "PE", name: "Perú", zones: [{ iana: "America/Lima", city: "Lima" }] },
  {
    code: "EC",
    name: "Ecuador",
    zones: [
      { iana: "America/Guayaquil", city: "Guayaquil / Quito" },
      { iana: "Pacific/Galapagos", city: "Galápagos" },
    ],
  },
  { code: "CO", name: "Colombia", zones: [{ iana: "America/Bogota", city: "Bogotá" }] },
  { code: "VE", name: "Venezuela", zones: [{ iana: "America/Caracas", city: "Caracas" }] },
  {
    code: "MX",
    name: "México",
    zones: [
      { iana: "America/Mexico_City", city: "Ciudad de México" },
      { iana: "America/Monterrey", city: "Monterrey" },
      { iana: "America/Merida", city: "Mérida" },
      { iana: "America/Cancun", city: "Cancún" },
      { iana: "America/Chihuahua", city: "Chihuahua" },
      { iana: "America/Mazatlan", city: "Mazatlán" },
      { iana: "America/Tijuana", city: "Tijuana" },
    ],
  },
  { code: "CR", name: "Costa Rica", zones: [{ iana: "America/Costa_Rica", city: "San José" }] },
  { code: "PA", name: "Panamá", zones: [{ iana: "America/Panama", city: "Ciudad de Panamá" }] },
  { code: "GT", name: "Guatemala", zones: [{ iana: "America/Guatemala", city: "Ciudad de Guatemala" }] },
  { code: "SV", name: "El Salvador", zones: [{ iana: "America/El_Salvador", city: "San Salvador" }] },
  { code: "HN", name: "Honduras", zones: [{ iana: "America/Tegucigalpa", city: "Tegucigalpa" }] },
  { code: "NI", name: "Nicaragua", zones: [{ iana: "America/Managua", city: "Managua" }] },
  { code: "CU", name: "Cuba", zones: [{ iana: "America/Havana", city: "La Habana" }] },
  { code: "DO", name: "República Dominicana", zones: [{ iana: "America/Santo_Domingo", city: "Santo Domingo" }] },
  { code: "PR", name: "Puerto Rico", zones: [{ iana: "America/Puerto_Rico", city: "San Juan" }] },
  {
    code: "ES",
    name: "España",
    zones: [
      { iana: "Europe/Madrid", city: "Madrid / Barcelona" },
      { iana: "Atlantic/Canary", city: "Islas Canarias" },
    ],
  },
  {
    code: "US",
    name: "Estados Unidos",
    zones: [
      { iana: "America/New_York", city: "Nueva York / Miami" },
      { iana: "America/Chicago", city: "Chicago / Houston" },
      { iana: "America/Denver", city: "Denver" },
      { iana: "America/Phoenix", city: "Phoenix" },
      { iana: "America/Los_Angeles", city: "Los Ángeles" },
      { iana: "America/Anchorage", city: "Anchorage" },
      { iana: "Pacific/Honolulu", city: "Honolulú" },
    ],
  },
];

export const DEFAULT_TIMEZONE = "America/Montevideo";

/** Which country a stored IANA zone belongs to, for pre-selecting the picker. */
export function countryForTimezone(iana: string): Country | undefined {
  return COUNTRIES.find((country) => country.zones.some((zone) => zone.iana === iana));
}

/** The human city label for a stored zone, e.g. for read-only display. */
export function cityForTimezone(iana: string): string {
  for (const country of COUNTRIES) {
    const zone = country.zones.find((z) => z.iana === iana);
    if (zone) return `${zone.city}, ${country.name}`;
  }
  return iana;
}
