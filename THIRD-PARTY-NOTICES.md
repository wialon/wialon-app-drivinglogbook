# Third-party notices

This repository is distributed under the MIT License (see `LICENSE-MIT`). That licence applies to the code written by Gurtam. The components listed below are third-party software included in the repository; they remain under their own licences, which are named in each entry and reproduced at the end of this file.

## Third-party components

### jQuery 1.8.3

- Where: `js/jquery-1.8.3.min.js`
- Project: https://jquery.com/
- Licence: MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright 2012 jQuery Foundation and other contributors, http://jquery.com/

### jQuery UI 1.10.0 (custom build)

- Where: `js/jquery-ui-1.10.0.custom.min.js`; `css/jquery-ui-1.10.0.custom.min.css`; `css/images/` (theme images)
- Project: http://jqueryui.com
- Licence: MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright (c) 2013 jQuery Foundation and other contributors

### jQuery Timepicker Addon 1.1.2

- Where: `js/jquery-ui-timepicker-addon.js`; `css/jquery-ui-timepicker-addon.css`
- Project: http://trentrichardson.com/examples/timepicker
- Licence: dual-licensed by its author under the MIT License or the GPL; used here under the MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright 2012 Trent Richardson

### jQuery UI Slider Access 0.3

- Where: `js/jquery-ui-sliderAccess.js`
- Project: http://trentrichardson.com
- Licence: dual-licensed by its author under the MIT License or the GPL; used here under the MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright 2011 Trent Richardson

### NETEYE Activity Indicator jQuery Plugin 1.0.0

- Where: `js/jquery.activity-indicator-1.0.0.min.js`
- Project: not stated in the file
- Licence: MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notices:
  - Copyright (c) 2010 NETEYE GmbH
  - Author: Felix Gnass [fgnass at neteye dot de]

### jQuery Autocomplete plugin 1.1

- Where: `js/jquery.autocomplete.js`; `css/jquery.autocomplete.css`
- Project: not stated in the file
- Licence: dual-licensed by its author under the MIT License or the GPL; used here under the MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright (c) 2009 Jörn Zaefferer

### Localisation assistance for jQuery 1.1.0 (jquery.localisation)

- Where: `js/jquery.localisation.js`
- Project: http://keith-wood.name/localisation.html
- Licence: dual-licensed by its author under the MIT License or the GPL; used here under the MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Written by Keith Wood (kbwood{at}iinet.com.au) June 2007.
- Note: Modified by Gurtam: the plugin loads the translations as JSON files (`<package>-<lang>.json`) into a global `TRANSLATIONS` object instead of loading scripts.

### jQuery Mouse Wheel Plugin 3.0.6

- Where: `js/jquery.textbox.js` (first part of the file)
- Project: http://brandonaaron.net
- Licence: MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)

### underi18n 0.1

- Where: `js/underi18n.js`
- Project: http://github.com/ggozad/underi18n
- Licence: MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: (c) 2012 Yiorgis Gozadinos, Crypho AS, http://crypho.com

### Underscore.js 1.4.3

- Where: `js/underscore-min.js`
- Project: http://underscorejs.org
- Licence: MIT License (SPDX: MIT). Text: see "MIT License" below.
- Copyright notice: Copyright (c) 2009-2012 Jeremy Ashkenas, DocumentCloud
- Note: The minified file carries no notice of its own; it is byte-identical to `underscore-min.js` of the 1.4.3 release.

## Licence texts

### MIT License

The following text applies to every component above that refers to the MIT License; the copyright notice of each component is given in its entry.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Libraries loaded at run time

At run time the app also loads some libraries from the network (for example the Wialon JavaScript SDK). They are not part of this repository and are not covered by this file.
