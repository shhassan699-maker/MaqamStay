# Location data

`countries.json`, `cities-by-country.json` and `major-cities-by-country.json` are a compact, separate snapshot of the [Countries States Cities Database](https://github.com/dr5hn/countries-states-cities-database) by dr5hn and contributors. Source release: `v3.2-export.7` (29 July 2026). Snapshot prepared 28 September 2026 from the release's `json-cities.json.gz` and the repository's `json/countries.json`.

The location data files are available under the [Open Database License 1.0](./ODbL-LICENSE.txt). The files retain country codes, calling codes and distinct city names grouped by country code. The major-city list ranks source entries by recorded population and excludes names ending in administrative-area terms. Please preserve this attribution and the ODbL license when redistributing these data files or adaptations of them.

The source lists 250 countries and territories, with 141,113 distinct city names across 223 of them. Some places are absent from the upstream database; the request form accepts manually entered countries and cities for that reason. City suggestions are served by a small search endpoint so the browser does not download the full catalog.

The source's Bouvet Island calling code has a leading zero and cannot form an international number, so it is omitted from the phone picker. Its country entry remains available for address entry.
