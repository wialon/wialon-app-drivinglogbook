# Driving Logbook, version 2.2.1: (November 15, 2017)
This is WEB application based on Apps from Gurtam (http://apps.wialon.com).

**This is a legacy app: it is no longer developed or maintained. The code is published as is, without support.**

## Description
Driving Logbook app allows requesting a special report for trips. This report specifies the beginning and the end of the trip, its type (business/personal trip), initial and final position, etc. Trip type can be changed manually, but the «work» type is stated by default.
Besides, the columns, containing user notes, can be added to the report manually. All the changes, made by the user, are logged. This report can be printed.

## License
[The MIT License](LICENSE-MIT)

## Requirements
 * Browser: a current version of Google Chrome, Firefox, Safari or Edge
 * Language: en, br, cs, da, de, es, et, fa, fi, fr-CA, fr, hr, nl, pl, ro, ru, sk, sl
 * Components: SDK
 * URL params: Active SID, Base URL, Host URL, Language, Current user

## Quick start
Apps activation through the management system: https://help.wialon.com/en/wialon-hosting/user-guide/management-system/apps  
Working with applications in the GPS tracking system: https://help.wialon.com/en/wialon-hosting/user-guide/monitoring-system/apps

## Installation
The repository contains the app in the form it is hosted in. Put the files on a web server and open `index.html` with the URL params listed above, for example
`index.html?sid=<Active SID>&baseUrl=https://hst-api.wialon.com&user=<Current user>&lang=en`.

 * The date interval picker and the datepicker locales are loaded from `//apps.wialon.com/plugins/`.
 * The export to XLS posts the table to `print.php` in the parent folder of the app or, when it is not available there, to `https://apps.wialon.com/print.php`.
