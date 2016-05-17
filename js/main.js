/*
 * override "Today" button to also grab the wialon time.
 */
$.datepicker._gotoToday = function(id) {
	var inst = this._getInst($(id)[0]);
	$dp = inst.dpDiv;
	this._base_gotoToday(id);
	var now = new Date();
	var time = wialon.core.Session.getInstance().getServerTime();
	var utime = wialon.util.DateTime.userTime(time * 1000);
	now.setTime(utime);
	this._setTime(inst, now);
	$('.ui-datepicker-today', $dp).click();
};
/// Global event handlers
var callbacks = {};
/// Execute callback
function exec_callback(id) {
	if (!callbacks[id])
		return null;
	callbacks[id].call();
	delete callbacks[id];
}

(function($, _) {
	/// Global units cache
	var units = {};
	/// Global current trips
	var ctrips = [];
	/// Global current trips grouped by date
	var ctabs = {};
	/// Global summary
	var csummary = {};
	/// Current wialon unit
	var cunit = null;
	/// Current times [time_from, time_to]
	var ctimes = null;
	/// Items for textbox input
	var textbox_items = [];
	///
	var gdh = [];
	///
	var LANG = "";
	///
	var PRINT_URL = "..";
	/// save object of localization massive
	var Locale = "";
	///
	var resources = [];
	/// Time format
	var en_format_time = ''; //"yyyy-MM-dd HH:mm";
	/// options for date
	var initDatepickerOpt;
	/// save geoZones
	var zone_data = {};
	var zone_selector_data = [];
	/// Changes flag
	var changed = [];
	/// SetTable
	var SetTable = { // default sett to TRUE
		beginning: true,
		end: true,
		duration: true,
		initLocation: true,
		startOdometer: true,
		finalLocation: true,
		endOdometer: true,
		tripLength: true,
		driver: false,
		user: true,
		lastChanges: true,
		tripStatus: true,
		notes: true
	};
	var TableTranslations = {};
	var TableColumns = {};
	/// flag for check exist change for columns settings
	var flagExistChangeSet = false;
	var TZ = 0,
		DST = 0,
		TODAY = {
			from: 0,
			to: 0
		};
	var LOCAL_STATE = {
		time_from: 0,
		time_to: 0,
		time_custom: null,
		time_type: 0
	};
	var changeTimeTimeout;
	var address_format;

	var home = office = null;
	var hoh = payment = false;
	var header_tmpl = footer_tmpl = 1;
	var payment_less = payment_more = payment_mileage = 0;

	// UI settings
	// 0x1 - group by date
	// 0x2 - show summary
	var ui_flags = 0;

	// Mileage calculation algorithm
	// 0 - default, trips events
	// 1 - odo sensor
	// 2 - mileage counter
	var mileage_values = 2;

	/// IE check
	function ie() {
		return (navigator.appVersion.indexOf("MSIE 6") !== -1 ||
			navigator.appVersion.indexOf("MSIE 7") !== -1 ||
			navigator.appVersion.indexOf("MSIE 8") !== -1);
	}
	/// Wrap callback
	function wrap_callback(callback) {
		var id = (new Date()).getTime();
		callbacks[id] = callback;
		return id;
	}
	/// Fetch varable from 'GET' request
	var get_html_var = _.memoize(function(name) {
		if (!name) {
			return null;
		}
		var pairs = document.location.search.substr(1).split("&");
		for (var i = 0; i < pairs.length; i++) {
			var pair = pairs[i].split("=");
			if (decodeURIComponent(pair[0]) === name) {
				return decodeURIComponent(pair[1]);
			}
		}
		return null;
	});
	/// Load scripts
	function load_script(src, callback) {
		var script = document.createElement("script");
		script.setAttribute("type", "text/javascript");
		script.setAttribute("charset", "UTF-8");
		script.setAttribute("src", src);
		if (callback && typeof callback === "function") {
			var id = wrap_callback(callback);
			if (ie()) {
				script.onreadystatechange = function() {
					if (this.readyState === 'complete' || this.readyState == 'loaded') {
						callback();
					}
				};
			} else {
				script.setAttribute("onLoad", "exec_callback(" + wrap_callback(callback) + ")");
			}
		}
		document.getElementsByTagName("head")[0].appendChild(script);
	}
	/// Fill in the interface 'select' html for control unit selection
	function fill_units_select(items) {
		units = {}; // update global variable
		var html = "";
		for (var i = 0, len = items.length; i < len; i++) {
			var item = items[i];
			if (!item) {
				continue;
			}
			var access = item.getUserAccess();
			if (wialon.util.Number.and(wialon.item.Unit.accessFlag.registerEvents, access)) {
				units[item.getId()] = item;
				html += "<option value='" + item.getId() + "'>" + item.getName() + "</option>";
			}
			if (!units || units.length < 1) {
				alert($.localise.tr("List of units empty."));
			}
		}
		$("#units-select").html(html);
	}
	/// Login result
	function login(code) {
		if (code) {
			alert($.localise.tr("Login error."));
			return;
		}

		disableui();
		wialon.core.Session.getInstance().loadLibrary("resourceDrivers");
		wialon.core.Session.getInstance().loadLibrary("unitTripDetector");
		wialon.core.Session.getInstance().loadLibrary("unitEventRegistrar");
		wialon.core.Session.getInstance().loadLibrary("resourceReports");
		wialon.core.Session.getInstance().loadLibrary("resourceZones");
		wialon.core.Session.getInstance().loadLibrary("unitEvents");
		wialon.core.Session.getInstance().loadLibrary("unitSensors");
		var t = underi18n.MessageFactory(TRANSLATIONS);
		$('#user_settings').html(_.template(underi18n.template($('#modal-tpl').html(), t), {
			LANG: LANG
		}));
		$("#apply_changes").val($.localise.tr("Apply"));
		var spec_resource = {
			itemsType: "avl_resource",
			propName: "sys_name",
			propValueMask: "*",
			sortType: "sys_name"
		};
		var flags_resource = wialon.item.Item.dataFlag.base | wialon.item.Resource.dataFlag.drivers;

		loadSetTable(); // load settings for displayed columns of table

		// fetch request
		wialon.core.Remote.getInstance().startBatch();
		var fd;
		var zones_res;
		var items;
		wialon.core.Session.getInstance().searchItems(spec_resource, true, flags_resource, 0, 0, function(code, data) {
			if (code === 0 && data && data.items && data.items.length > 0) {
				for (var i = 0, len = data.items.length; i < len; i++) {
					var item = data.items[i];
					if (!item) {
						continue;
					}
					var access = item.getUserAccess();
					if (wialon.util.Number.and(wialon.item.Resource.accessFlag.viewDrivers, access)) {
						resources.push(item);
					}
				}
			}
		});
		wialon.core.Session.getInstance().getCurrUser().getLocale(function(arg, locale) {
			fd = (locale && locale.fd) ? locale.fd : '%Y-%m-%E_%H:%M:%S'; // check for users who have never changed the parameters of the metric

			initDatepickerOpt = {
				wd: (locale && locale.wd && locale.wd > 1) ? 0 : 1,
				wd_orig: locale.wd,
				fd: fd
			};
		});

		address_format = wialon.core.Session.getInstance().getCurrUser().getCustomProperty("us_addr_fmt", "");

		var flagZones = wialon.item.Item.dataFlag.base | wialon.item.Resource.dataFlag.zones;
		wialon.core.Session.getInstance().updateDataFlags([{
			type: "type",
			data: "avl_resource",
			flags: flagZones,
			mode: 0
		}], function(code) {
			zones_res = wialon.core.Session.getInstance().getItems("avl_resource");
		});

		var spec_unit = {
			itemsType: "avl_unit",
			propName: "sys_name",
			propValueMask: "*",
			sortType: "sys_name"
		};
		var flags_unit = wialon.item.Item.dataFlag.base | wialon.item.Unit.dataFlag.sensors;
		wialon.core.Session.getInstance().searchItems(spec_unit, true, flags_unit, 0, 0, function(code, data) {
			$("#table-wrap").activity(false);
			if (code || !data) {
				alert($.localise.tr("List of units empty."));
			} else if (!data.items || data.items.length < 1) {
				alert($.localise.tr("List of units empty."));
			} else {
				items = data.items;
			}
		});
		// run after request
		wialon.core.Remote.getInstance().finishBatch(qx.lang.Function.bind(function() {

			// fetch data of zones:
			var add_zone_data = function(res_id, code, col) {
				if (code || !col)
					return;
				zone_selector_data.push({
					id: 0,
					name: ''
				});
				for (var i = 0; i < col.length; i++) {
					zone_data[res_id + "_" + col[i].id] = col[i];

					zone_selector_data.push({
						id: res_id + "_" + col[i].id,
						name: col[i].n
					});
				}
			};
			wialon.core.Remote.getInstance().startBatch("getZonesData");
			var pre_visible_zones = {};
			for (var i = 0; i < zones_res.length; i++) {
				if (zones_res[i]) {
					if (typeof pre_visible_zones[zones_res[i].getId()] == "undefined") {
						pre_visible_zones[zones_res[i].getId()] = [];
					}
					var zones = zones_res[i].getZones();
					for (var j in zones) {
						var z = zones[j];
						pre_visible_zones[zones_res[i].getId()].push(z.id);
					}
				}
			}
			var zones_flags = wialon.item.MZone.flags.base |
			wialon.item.MZone.flags.area |
			wialon.item.MZone.flags.points;

			for (var r in pre_visible_zones) {
				var resource = wialon.core.Session.getInstance().getItem(r);
				var cb = qx.lang.Function.bind(add_zone_data, this, r);
				resource.getZonesData(pre_visible_zones[r], zones_flags, cb);
			}
			wialon.core.Remote.getInstance().finishBatch(qx.lang.Function.bind(function() {
				// run after load all data:
				en_format_time = wialon.util.DateTime.convertFormat(fd, true).replace(/_/, '<br>').replace(/ /, '&nbsp;');

				// set default regional settings
				var regional = $.datepicker.regional[LANG];
				if (regional) {
					$.datepicker.setDefaults(regional);
					// also wialon locale
					wialon.util.DateTime.setLocale(
						regional.dayNames,
						regional.monthNames,
						regional.dayNamesShort,
						regional.monthNamesShort
					);
				}

				fill_units_select(items);
				ltranlate(items[0]);
				renderStaticTpl();
				initDatepicker( initDatepickerOpt.wd, initDatepickerOpt.fd, initDatepickerOpt.wd_orig);
				addEventsListeners();

				$("#execute-btn").removeAttr("disabled");

				jQuery("#home_geofence_select").autocomplete(zone_selector_data, {
					matchSubset: true,
					matchContains: true,
					mustMatch: true,
					highlight: null,
					minChars: 0,
					max: 1000,
					appendAfterInput: false,
					formatItem: function(row) {
						return row.name;
					}
				}).result(function(evt, obj, value) {
					jQuery("#home_geofence").val(obj.id);
				});
				jQuery("#office_geofence_select").autocomplete(zone_selector_data, {
					matchSubset: true,
					matchContains: true,
					mustMatch: true,
					highlight: null,
					minChars: 0,
					max: 1000,
					appendAfterInput: false,
					formatItem: function(row) {
						return row.name;
					}
				}).result(function(evt, obj, value) {
					jQuery("#office_geofence").val(obj.id);
				});

			}), "getZonesData");
		})); // finishBatch

	}
	/// Init SDK
	function init_sdk() {
		var url = get_html_var("baseUrl");
		if (!url) {
			url = get_html_var("hostUrl");
		}
		if (!url) {
			return null;
		}

		var user = get_html_var("user");
		user = (user) ? user : "";

		wialon.core.Session.getInstance().initSession(url, undefined, 0x800, undefined);
		var sid = get_html_var("sid");
		var authHash = get_html_var("authHash");

		if (authHash) {
			wialon.core.Session.getInstance().loginAuthHash(authHash, login);
		} else if (sid) {
			wialon.core.Session.getInstance().duplicate(sid, user, true, login);
		}
	}
	///
	function ischeck(val) {
		return (val === null || val === undefined) ? false : true;
	}
	/// Fetches unit from the user input
	function getUnitFromInput() {
		var unit_id = $("#units-select").val();
		return units[unit_id];
	}
	/// Lays table update
	var refresh_drivers = (function() {
		var timeout = null;
		return function(unit, times, trips) {
			if (timeout !== null) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				load_drivers (unit, times, trips);
				clearTimeout(timeout);
				timeout = null;
			}, 1000);
		};
	})();
	/// execute trips
	function execute(event) {
		changed = [];
		var unit = getUnitFromInput();
		if (!unit) {
			alert($.localise.tr("Please select unit."));
			return;
		}
		cunit = unit;

		disableui();
		$('#loading').addClass('show'); // show loading line

		var times = $("#ranging-time-wrap").intervalWialon('get', true);
		if (!times) {
			alert($.localise.tr("Please select time interval."));
			return;
		}
		times[0] = times[0] - wialon.util.DateTime.getDSTOffset(times[0]);
		times[1] = times[1] - wialon.util.DateTime.getDSTOffset(times[1]);

		flagExistChangeSet = false;
		ctimes = times; // stores current worker time in global variable
		$('#message-wrap').remove();
		ltranlate(unit);
		load_trips(unit, times);
	}

	/// Find best
	function getBest(counter, prev, comp) {
		var res = null;
		if (counter && prev) {
			res = comp(prev, counter);
		} else if (counter) {
			res = counter;
		} else if (prev) {
			res = prev;
		}
		return res;
	}

	/// Main function for unloading trips
	function load_trips(unit, times) {
		ctrips = [];

		var events_config = {
			itemId: unit.getId(),
			eventType: 'trips' + (mileage_values == 2 ? ',counters' : ''),
			ivalType: 4,
			ivalFrom: times[0],
			ivalTo: times[1],
		};

		var sensors = cunit.getSensors();
		var private_sensor = 0, mileage_sensor = null;
		for(var s_id in sensors){
			if (sensors[s_id].t == "private mode") { // detect trip status by private mode sensor
				private_sensor = sensors[s_id].id;
				events_config.filter1 = sensors[s_id].id;
				events_config.eventType += ',sensors';
			} else if (sensors[s_id].t == "mileage") { // use mileage sensor
				mileage_sensor = sensors[s_id];
			}

			if (private_sensor > 0 && mileage_sensor) {
				break;
			}
		}

		// arrays for events data
		var batch_params = [],
			ev_sensors = [],
			locations = [],
			trips = [];

		wialon.core.Remote.getInstance().startBatch('getTripsBatch');

		wialon.core.Remote.getInstance().remoteCall(
			"unit/get_events",
			events_config,
			function(code, events) {
				if(code || !events) {
					$("#table-wrap").activity(false);
					$("#execute-btn").removeAttr("disabled");
					undisableui();
					disabletableui();
					showMessage($.localise.tr("No data for selected interval."));
					return;
				}

				if (!events.trips.from  && !events.trips.to ){
					for(var i = 0; i<events.trips.length; i++){
						locations.push({lat:events.trips[i].from.y, lon:events.trips[i].from.x});
						locations.push({lat:events.trips[i].to.y, lon:events.trips[i].to.x});

						if (mileage_sensor) {
							// messages for calc sensors value
							addMessagesToBatch(batch_params, unit.getId(), events.trips[i]);
						}
					}
					trips=events.trips;
				} else if( typeof events.trips == "object") {
					locations.push({lat:events.trips.from.y,lon:events.trips.from.x});
					locations.push({lat:events.trips.to.y,lon:events.trips.to.x});
					trips.push(events.trips);
					addMessagesToBatch(batch_params, unit.getId(), events.trips);
				}
				// private sensors
				if(events.sensors){
					if (!events.sensors[private_sensor].from  && !events.sensors[private_sensor].to ){
						ev_sensors=events.sensors[private_sensor];
					} else if( typeof events.sensors[private_sensor] == "object") {
						ev_sensors.push(events.sensors[private_sensor]);
					}
				}
			}
		);

		wialon.core.Remote.getInstance().finishBatch(function(code, events) {
			// when all data received
			if (locations.length > 0) {
				if (mileage_sensor) {
					wialon.core.Remote.getInstance().remoteCall('core/batch', batch_params, function(code, msgs) {
						wialon.util.Gis.getLocations(locations, qx.lang.Function.bind(addLocationsToTrips, this, trips, ev_sensors, unit, times, mileage_sensor, msgs));
					});
				} else {
					wialon.util.Gis.getLocations(locations, qx.lang.Function.bind(addLocationsToTrips, this, trips, ev_sensors, unit, times, mileage_sensor, []));
				}
				// add counters to trips
				if (mileage_values == 2 && !code && events && events.counters && trips.length) {
					// wrap object to array
					if (events.counters.toString() == '[object Object]') {
						events.counters = [events.counters];
					}

					var cur = 0;
					for (var i = 0, tfrom, tto, prev, ok; i < trips.length; i++) {
						if (cur >= events.counters.length) {
							trips[i].prev = null;
							trips[i].next = null;
							continue;
						}
						ok = true;
						tfrom = trips[i].from.t;
						tto = trips[i].to.t;
						// find first
						do {
							// next counter is after trip
							if (events.counters[cur].m > tto) {
								ok = false;
								break;
							}
							trips[i].prev = events.counters[cur];
							cur++;
						} while (cur < events.counters.length && events.counters[cur].m < tfrom)
						// skip trips without counters
						if (!ok) {
							continue;
						}
						// find last
						while (true) {
							if (cur >= events.counters.length - 1 || events.counters[cur].m > tto) {
								trips[i].next = events.counters[cur];
								break;
							}
							cur++;
						}
					}
				}
			} else {
				$("#table-wrap").activity(false);
				$("#execute-btn").removeAttr("disabled");
				undisableui();
				disabletableui();
				showMessage($.localise.tr("No data for selected interval."));
			}
		}, 'getTripsBatch');
	}

	// construct array to get start/finish messages for trip
	function addMessagesToBatch(batch, unitId, trip) {
		batch.push({
			svc: 'messages/load_last',
			params: {
				itemId: unitId,
				lastTime: trip.from.t,
				lastCount: 1,
				flags: 0,
				flagsMask: 0,
				loadCount:1
			}
		}, {
			svc: 'messages/load_last',
			params: {
				itemId: unitId,
				lastTime: trip.to.t,
				lastCount: 1,
				flags: 0,
				flagsMask: 0,
				loadCount:1
			}
		});
	}

	function addLocationsToTrips(trips_array, sensors_array, unit, times, mileage_sensor, msgs, code, result) {
		if (!code && result) {
			for(var arr_id in trips_array){
				trips_array[arr_id].from.location = result[arr_id*2];
				trips_array[arr_id].to.location = result[arr_id*2+1];
				if (mileage_sensor) {
					// messages
					trips_array[arr_id].from.msg = msgs[arr_id* 2].messages[0];
					trips_array[arr_id].to.msg = msgs[arr_id*2+1].messages[0];

					trips_array[arr_id].from.odo = unit.calculateSensorValue(mileage_sensor, trips_array[arr_id].from.msg);
					trips_array[arr_id].to.odo = unit.calculateSensorValue(mileage_sensor, trips_array[arr_id].to.msg);
					if (trips_array[arr_id].from.odo != wialon.item.MUnitSensor.invalidValue &&
						trips_array[arr_id].to.odo != wialon.item.MUnitSensor.invalidValue &&
						trips_array[arr_id].from.odo > 0 && trips_array[arr_id].to.odo) {
						// calculate mileage from sensors
						trips_array[arr_id].odo = trips_array[arr_id].to.odo - trips_array[arr_id].from.odo;
					} else {
						// if invalid value or 0 - use mileage from events
						mileage_sensor = null;
					}
				}
			}
			ctrips = getNormalizedData(trips_array, sensors_array ,unit, mileage_sensor);
			ctabs = groupByDate(ctrips);

			// assync get drivers and redraw
			refresh_drivers(cunit, times, ctrips);

			if (ui_flags & 0x1) {
				$("#paginated-table").dividedByDayTabs(ctabs, trips_to_table);
			} else {
				$("#paginated-table").dividedByPages(ctrips, trips_to_table);
			}

			undisableui();
			undisabletableui();

			resizeColumns();
		}
	}

	/// adapter for data for FULL DATA!
	function loadUserSettings(){
		var user = wialon.core.Session.getInstance().getCurrUser();
		var settings = user.getCustomProperty('__app__logbook_settings', '{}');
		settings = JSON.parse(settings);
		home = office = {
			'name': '',
			'id': ''
		};
		hoh = payment = false;
		header_tmpl = footer_tmpl = 1;
		payment_less = payment_more = payment_mileage = 0;

		if (settings['geofences']) {
			if (settings['geofences']['home']) {
				home = settings['geofences']['home'];
			}

			if (settings['geofences']['office']) {
				office = settings['geofences']['office'];
			}
		}
		if (settings['print']) {
			if (settings['print']['hoh']) {
				hoh = settings['print']['hoh'];
			}
			if (settings['print']['payment']) {
				payment = settings['print']['payment'];
			}
			if (settings['print']['header_tmpl']) {
				header_tmpl = settings['print']['header_tmpl'];
			}
			if (settings['print']['footer_tmpl']) {
				footer_tmpl = settings['print']['footer_tmpl'];
			}
			if (settings['print']['payment_less']) {
				payment_less = parseFloat(settings['print']['payment_less']);
			}
			if (settings['print']['payment_more']) {
				payment_more = parseFloat(settings['print']['payment_more']);
			}
			if (settings['print']['payment_mileage']) {
				payment_mileage = parseInt(settings['print']['payment_mileage']);
			}
		}
		// ui settings
		if (settings['ui_flags']) {
			ui_flags = settings['ui_flags'];
		}
		// mileage
		if (settings['mileage_values']) {
			mileage_values = settings['mileage_values'];
		}
	}

	// odo - absolute mileage sensor or null
	function getNormalizedData(trips, sensors, unit, odo) {
		var m = [], type, status;
		textbox_items = [$.localise.tr("Business"), $.localise.tr("Personal"), $.localise.tr("Home-Office-Home")];
		var private_mode, home_mode, beginGeofence, endGeofence, chngd;
		for (var i = 0, len = trips.length; i < len; i++) { // cycle on table trips
			var c = trips[i];
			if( home === null || office === null) loadUserSettings();
			type=null;
			status=textbox_items[0];
			home_mode = false;
			beginGeofence = endGeofence = '';
			chngd = true;
			if (home && home.id && zone_data[home.id] && office && office.id && zone_data[office.id]) {
				if (wialon.util.Geometry.pointInShape(zone_data[home.id].p, zone_data[home.id].t == 2 ? 0 : zone_data[home.id].w, c.from.x, c.from.y)
					&& wialon.util.Geometry.pointInShape(zone_data[office.id].p, zone_data[office.id].t == 2 ? 0 : zone_data[office.id].w, c.to.x, c.to.y)) {
					status = textbox_items[2]; // Home-Office
					type = $.localise.tr('Drive home-office');
					textbox_items.push(status);
					home_mode = true;
					beginGeofence = home.name;
					endGeofence = office.name;
				} else if (wialon.util.Geometry.pointInShape(zone_data[office.id].p, zone_data[office.id].t == 2 ? 0 : zone_data[office.id].w, c.from.x, c.from.y)
					&& wialon.util.Geometry.pointInShape(zone_data[home.id].p, zone_data[home.id].t == 2 ? 0 : zone_data[home.id].w, c.to.x, c.to.y)) {
					status = textbox_items[2]; // Office-Home
					type = $.localise.tr('Drive office-home');
					textbox_items.push(status);
					home_mode = true;
					beginGeofence = office.name;
					endGeofence = home.name;
				}
			}


			private_mode = false;
			// check private mode sensor
			for(var ev_id in sensors) {
				if( sensors[ev_id].from.t <= c.to.t && sensors[ev_id].to.t >= c.from.t) {
					status = textbox_items[1]; // Personal
					type ='';
					home_mode = false;
					private_mode = true;
					break;
				}
			}


			if(c['p']) { // load saved data
				if(c['p']['nt'] || c['p']['ui_text']) {
					type = home_mode ? type : '';
					status = '';
					chngd = false;
				}
				if(typeof c['p']['nt'] != 'undefined') {
					type = c['p']['nt'];
				}
				if (typeof c['p']['ui_text'] != 'undefined') {
					textbox_items.push(c['p']['ui_text']);
					status = c['p']['ui_text'];
				}
			}

			var trip_length = getMeasureUnits({unit: unit, l: (c.distance) / 1000}),
				start_odometer = null,
				end_odometer = null;
			if (mileage_values == 0) {
				// trips events odometer
				start_odometer = getMeasureUnits({unit: unit, l: c.odometer / 1000});
				end_odometer = getMeasureUnits({unit: unit, l: (c.odometer + c.distance) / 1000});
			} else if (mileage_values == 1 && odo) {
				// mileage sensor
				var start_odometer = getMeasureUnits({unit: unit, l: c.from.odo});
				var end_odometer = getMeasureUnits({unit: unit, l: c.to.odo});
				var trip_length = getMeasureUnits({unit: unit, l: c.odo});
			} else if (mileage_values == 2 && c.prev && c.next) {
				// mileage counter
				start_odometer = getMeasureUnits({unit: unit, l: c.prev.mileage / 1000});
				end_odometer = getMeasureUnits({unit: unit, l: c.next.mileage / 1000});
				trip_length = getMeasureUnits({unit: unit, l: (c.next.mileage - c.prev.mileage) / 1000});
			}

			var bySensor = (private_mode && status==textbox_items[1]);
			var data = {
				id: "trip_" + i,
				index: i + 1,

				date: getDateStr(c.from.t),

				time_from: getTimeStr(c.from.t),
				time_to: getTimeStr(c.to.t),
				from: c.from,
				to: c.to,
				fromL: (c.from.location && !home_mode) ? c.from.location : '',
				toL: (c.to.location && !home_mode) ? c.to.location : '',
				duration: get_time_string(c.to.t - c.from.t),
				start_odometer: start_odometer,
				end_odometer: end_odometer,
				trip_length: trip_length,
				driver: '---',
				metric_m: (getMeasureUnits({
					unit: unit
				})) ? $.localise.tr("mi") : $.localise.tr("km"),
				begin: {
					geoZone: (bySensor || home_mode)?beginGeofence:getGeoZone({
						lon: c.from.x,
						lat: c.from.y
					})
				},
				end: {
					geoZone: (bySensor || home_mode)?endGeofence:getGeoZone({
						lon: c.to.x,
						lat: c.to.y
					})
				},
				uname: (c['p'] && c['p']['un'])?c['p']['un']:"---",
				time_change: (c['p'] && c['p']['tc'])?getTimeStr(c['p']['tc']):"---",
				uinput: status,
				unote: type,
				prvt: private_mode,
				changed: chngd,
				trip: c
			};


			if (LANG == "ru") {
				data.fromL = data.fromL.replace(/km from/g, 'км от');
				data.toL = data.toL.replace(/km from/g, 'км от');
			}

			// if (chngd) {//mark auto changed
			// 	changed = true;
			m.push(data);
			// }
		}
		textbox_items = _.uniq(textbox_items);
		updateStateList(textbox_items);
		return m
	}

	///
	function groupByDate(trips) {
		var tabs = [];
		var ind = null;
		var i, trip, date;

		// group trips by date
		for (i = 0, trip, date; i < trips.length; i++) {
			trip = trips[i];
			date = trip.date.replace("&nbsp;", " ");
			if (ind === null || tabs[ind].date != date) {
				// add new tab
				ind = tabs.push({
					date: date,
					trips: [trip],
					trip_length: trip.trip_length,
					duration: trip.to.t - trip.from.t,
					start_odometer: trip.start_odometer,
					end_odometer: trip.end_odometer
				}) - 1;
			} else {
				// append trip to tab
				tabs[ind].trips.push(trip);
				tabs[ind].trip_length += trip.trip_length;
				tabs[ind].duration += trip.to.t - trip.from.t;
				tabs[ind].end_odometer = trip.end_odometer;
			}
		}

		// summary
		var summary = null
		if (trips.length) {
			summary = {
				trip_length: 0,
				duration: 0,
				start_odometer: start_odometer = trips[0].start_odometer,
				end_odometer: trips[trips.length - 1].end_odometer,
				from: trips[0].from,
				to: trips[trips.length - 1].to
			};

			// calculate summary
			for (var i = 0; i < tabs.length; i++) {
				summary.trip_length += tabs[i].trip_length;
				summary.duration += tabs[i].duration;
			}
		}

		return {
			summary: summary,
			tabs: tabs
		};
	}

	/// get geozone for point
	function getGeoZone(latlon) {
		var curZones = null; // zone for point
		if (!latlon.lat && !latlon.lon) return null;

		for (var i in zone_data) {
			if (wialon.util.Geometry.pointInShape(zone_data[i].p, zone_data[i].t == 2 ? 0 : zone_data[i].w, latlon.lon, latlon.lat)) {
				if (curZones) {
					// filter for minimal zone:
					curZones = (curZones.ar > zone_data[i].ar) ? zone_data[i] : curZones;
				} else {
					curZones = zone_data[i];
				}
			}
		}
		// return name of Zone
		return (curZones) ? curZones.n : null;
	}

	///  get Table Value
	function _getTableValue(data) { // calculate ceil value
		if (typeof data == "object")
			if (typeof data.t == "string") return data.t; else return "";
		else return data;
	}
	///
	function part_dh_by_tm(dh) {
		var result = [];
		if (dh.length < 1) {
			return result;
		}

		for (var i = 0, len = dh.length; i < len; i++) {
			var tempb = dh[i];
			if (tempb['u'] === 0) {
				continue;
			}

			var start = tempb['t'],
				end = 0xFFFFFFFF;
			var next = i + 1;
			if (next < len) {
				var temp = dh[next];
				if (temp['u'] === 0) {
					i++;
				}
				end = temp['t'];
			}
			result.push({
				tb: start,
				tub: end,
				did: tempb['did'],
				driver: tempb['driver']
			});
		}
		return result;
	}
	///
	function load_drivers(unit, times, trips) {
		wialon.core.Remote.getInstance().startBatch("load_drivers");

		gdh = [];
		for (var i = 0, len = resources.length; i < len; i++) {
			var resource = resources[i];
			if (!resource) {
				continue;
			}

			resource.getDriverBindings(unit, null, times[0], times[1], qx.lang.Function.bind(function(resource, code, data) {
				if (code === 0 && data) {
					var rid = resource.getId();
					var drivers = resource.getDrivers();
					for (var did in data) {
						var hdriver = data[did];
						for (var j = 0, dlen = hdriver.length; j < dlen; j++) {
							hdriver[j]['did'] = rid + "_" + did;
							hdriver[j]['driver'] = drivers[did].n;
							gdh.push(hdriver[j]);
						}
					}
				}
			}, this, resource));
		}

		wialon.core.Remote.getInstance().finishBatch(qx.lang.Function.bind(function(unit, times, trips, code, combinedCode) {
			gdh = _.sortBy(gdh, function(history) {
				return history['t'];
			});
			var partdh = part_dh_by_tm(gdh);
			var tlen = trips.length,
				temp = 0;
			for (var i = 0, len = partdh.length; i < len; i++) {
				var pdh = partdh[i];
				for (var j = temp; j < tlen; j++) {
					var trip = trips[j];
					if (trip['to'] && trip['to']['t'] && trip['from'] && trip['from']['t'] && (pdh['tb'] < trip['to']['t']) && (pdh['tub'] > trip['from']['t'])) {
						temp = j + 1;
						trip['did'] = pdh['did'];
						trip['driver'] = pdh['driver'];
					}
				}
				if (temp === tlen) {
					break;
				}
			}
			// save to global
			ctrips = trips;
			ctabs = groupByDate(ctrips);

			// update tables
			$("#paginated-table").trigger("refresh", {
				data: ui_flags & 0x1 ? ctabs : ctrips
			});

			resizeColumns();
		}, this, unit, times, trips), "load_drivers");
	}

	/// Check digit and prepend zero if required
	function add_zero(i) {
		return (i < 10) ? (i = "0" + i) : i;
	}
	/// Format time value
	function get_time_string(time, format) {
		if (!format) {
			format = "HH:mm:ss";
		}

		var result = format;
		var hours = parseInt(time / 3600);
		var mins = parseInt((time - hours * 3600) / 60);
		var secs = parseInt(time - hours * 3600 - mins * 60);
		var tokens = {
			"HH": add_zero(hours),
			"mm": add_zero(mins),
			"ss": add_zero(secs)
		};
		for (var i in tokens)
			result = result.replace(i, tokens[i]);
		return result;
	}
	/// Create html table for trips data
	function trips_to_table(sindex, trips, summary) {
		// clear tables
		$("#paginated-table tbody").empty();
		$("#paginated-table-footer tbody").empty();

		// prepare new rows
		var html = '';
		var i, trip;
		for (i = 0, len = trips.length; i < len; i++) {
			trip = trips[i];
			if (!trip) {
				continue;
			}
			html += trip_to_row(sindex + i, trip, summary ? sindex + i : null);
		}
		// add rows
		$("#paginated-table tbody").html(html);

		var rows = $("#paginated-table tbody tr input.message");
		var notes = $("#paginated-table tbody tr textarea.note");
		var text, elem;
		for (i = 0; i < rows.length; i++) {
			trip = trips[i];
			elem = rows[i]
			// set status
			text = get_trip_mtext (trip) || ""; // "Business"; // set default value
			elem.value = text;
			$(elem).textbox({
				items: textbox_items
			});
			// set notes
			text = get_trip_ntext (trip);
			notes[i].value = text;
		}

		// show summary
		if (ui_flags & 0x2) {
			showSummary(summary);
			$('#paginated-table-footer').show();
		} else {
			$('#paginated-table-footer').hide();
		}
		resizeColumns();
	}

	// resize columns
	function resizeColumns() {
		var thead = $("#paginated-table th");
		var tfoot = $("#paginated-table-footer tr:eq(0) td");
		;
		for (var i = 0; i < thead.length && i < tfoot.length - 1; i++) {
			$(tfoot[i]).outerWidth($(thead[i]).outerWidth());
		}
	}

	/// update dropdown list of state:
	function updateStateList(textbox_items) {
		var html = '';
		for (var i = 0, len = textbox_items.length; i < len; i++) {
			html += '<li><a href="#" style="font-size: 12px;">' + textbox_items[i] + '</a></li>'
		}
		$('ul.textboxlist').html(html);

	}
	/// Callback for apply button
	function apply(input) {
		if (!cunit) {
			return null;
		}
		flagExistChangeSet = false;

		wialon.core.Remote.getInstance().startBatch("apply_message");

		var parsedTrips = [];

		// this add for remove send message of other change
		if (input && $(input).closest('[id^="trip_"]').length) {
			var key = $(input).closest('[id^="trip_"]').attr('id').split('_')[1];
			if (key && ctrips[key]) {
				parsedTrips = [ctrips[key]]
			}
		} else {
			parsedTrips = ctrips;
		}
		for (var i = 0, len = parsedTrips.length; i < len; i++) {
			var trip = parsedTrips[i];
			if ((!trip) || ( (!ischeck(trip['uinput'])) && (!ischeck(trip['unote'])) )) {
				continue;
			}
			if (!trip['unote'] && (!ischeck(trip['uinput'])) && (!trip['p'])) {
				trip['unote'] = "";
				continue;
			}

			if (!ischeck(trip['uinput'])) {
				trip['uinput'] = (trip['p'] && trip['p']['ui_text']) ? trip['p']['ui_text'] : '';
			}

			var date = null;
			var note = "";
			if (ischeck(trip['unote'])) {
				note = trip['unote'];
			} else {
				note = (trip['p'] && trip['p']['nt']) ? trip['p']['nt'] : "";
			}
			var time = wialon.core.Session.getInstance().getServerTime();
			var user = wialon.core.Session.getInstance().getCurrUser();
			var oparams = {};
				oparams['un'] = user.getName(); // user name
				oparams['tc'] = time; // unix time changes
				oparams['ui_text'] = trip['uinput'];

			//if (note) {
				oparams['nt'] = note;
			//} // user note
			if(trip['changed']){
				wialon.core.Remote.getInstance().remoteCall(
					"unit/update_event_data", {
						itemId: cunit.getId(),
						eventType: 'trips',
						ivalType: 4,
						ivalFrom: trip.from.t,
						ivalTo: trip.to.t,
						params:oparams
					},
					wialon.util.Helper.wrapCallback(qx.lang.Function.bind(function(trip,oparams, code) {
						trip ['p'] = oparams;
						updateFields(input, ctrips);
					}, this, trip,oparams))
				);
			}
			// hide button
			$('#' + trip.id + ' .save-btn').hide();
			// remove current trip
			changed = _.without(changed, trip.id);
			// check if there are exists changed trips
			if (!changed.length) {
				$('#print-btn').prop('disabled', false);
				$('#export-xls-btn').prop('disabled', false);
				$('#export-csv-btn').prop('disabled', false);
			}
		}
		wialon.core.Remote.getInstance().finishBatch(function(code, combinedCode) {
			refresh(input);
		}, "apply_message");
	}
	/// Lays table update
	var refresh = (function() {
		// timeout used for skip large number of requests
		var timeout = null;
		return function(input) {
			if (timeout !== null) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				clearTimeout(timeout);
				timeout = null;
			}, 1000);
		};
	})();
	/// Get status text from user input or status message
	function get_trip_mtext(trip) {
		var text = "";
		if (trip['uinput']) {
			text = trip['uinput'];
		} else if (trip['message']) {
			text = (trip && trip && trip['p']) ? trip['p']['ui_text'] : ''
		}
		return text;
	}
	/// Get note text from user input or status message
	function get_trip_ntext(trip) {
		var text = "";
		if (trip['unote']) {
			text = trip['unote'];
		} else if (trip['p'] && trip['p']['nt']) {
			text = (trip['p']['nt']) ? trip['p']['nt'] : ''
		}
		return text;
	}
	/// Fetches data from trip for represent in table
	function trip_to_data(id, trip) {
		trip.SetTable = SetTable;
		return trip;
	}
	/// The auxiliary function for transform trip in row table
	function trip_to_row(id, trip, index) {
		var data = trip_to_data(id, trip);
		var template = _.template($("#row").html());
		if (index) {
			// replace index for day grouping
			var tmp = data.index;
			data.index = index;
			template = template(data);
			data.index = tmp;
		} else {
			template = template(data);
		}
		return template;
	}
	/// Disabled ui
	function disableui() {
		$('#select-table-columns-wrap').hide();
		$("#execute-btn").attr("disabled", "disabled");
		disabletableui();
	}
	/// Undisabled ui
	function undisableui() {
		try {
			$("#table-wrap").activity(false);
		} catch ( e ) {}
		$("#execute-btn").removeAttr("disabled");
		$('#select-table-columns-wrap').show();
		undisabletableui();
	}
	/// Disabled table ui
	function disabletableui() {
		$("#page-selector").hide();
		$("#paginated-table").hide();
		$("#paginated-table-footer").hide().children('tfoot').empty();
		$("#print-btn").hide();
		$('#export-xls-btn').hide();
		$('#export-csv-btn').hide();
		$('#message-wrap').remove();
	}
	/// Undisabled table ui
	function undisabletableui() {
		$("#page-selector").show();
		$("#paginated-table").show();
		$("#paginated-table-footer").show();
		$("#print-btn").show();
		$('#export-xls-btn').show();
		$('#export-csv-btn').show();
		$('#loading').removeClass('show');
	}
	/// Callback
	function change_nrowonpage() {
		var table = $("#paginated-table");
		hresize(null, $(this).val());
		table.trigger("changerowonpage", $(this).val());
		$(window).trigger('resize');
	}
	/// Callback
	function change_npage(event) {
		if (event.which === 13) {
			var table = $("#paginated-table");
			table.trigger("changepage", $(this).val());
		}
	}
	/// render static elements on page
	function renderStaticTpl() {
		$("#from-text-span").html($.localise.tr("From"));
		$("#to-text-span").html($.localise.tr("To"));
		$("#execute-btn").val($.localise.tr("OK"));

		$("#page").html($.localise.tr("Page&nbsp;"));
		$("#of").html($.localise.tr("&nbsp;of&nbsp;"));

		$("#print-btn").val($.localise.tr("Print"));
	}
	///
	function ltranlate(unit) {
		// get measure units
		var metric_m = getMeasureUnits({unit: unit}) ? $.localise.tr("mi") : $.localise.tr("km");
		// add TH to table
		var t = underi18n.MessageFactory(TRANSLATIONS);
		$('#paginated-table thead').html(_.template(underi18n.template($('#th-row').html(), t), {
			SetTable: SetTable,
			LANG: LANG,
			metric_m: metric_m
		}));
		// add list
		$('#select-table-columns-list').html(_.template(underi18n.template($('#select-table-columns-list-tpl').html(), t), {
			SetTable: SetTable,
			metric_m: metric_m
		}));

		// translations
		TableTranslations = {
			beginning: $.localise.tr("Beginning"),
			end: $.localise.tr("End"),
			duration: $.localise.tr("Duration"),
			initLocation: $.localise.tr("Initial location"),
			startOdometer: $.localise.tr("Initial mileage") + ", " + metric_m,
			finalLocation: $.localise.tr("Final location"),
			endOdometer: $.localise.tr("Final mileage") + ", " + metric_m,
			tripLength: $.localise.tr("Mileage") + ", "+ metric_m,
			driver: $.localise.tr("Driver"),
			user: $.localise.tr("User"),
			lastChanges: $.localise.tr("Last changes"),
			tripStatus: $.localise.tr("Trip status"),
			notes: $.localise.tr("Notes"),
		};

		// column getters
		TableColumns = {
			beginning: function(data) {return data.time_from.replace("<br>", " ").replace("&nbsp;", " ");},
			end: function(data) {return data.time_to.replace("<br>", " ").replace("&nbsp;", " ");},
			duration: function(data) {return data.duration;},
			startOdometer: function(data) {return data.start_odometer !== null ? data.start_odometer.toFixed(2) : "";},
			endOdometer: function(data) {return data.end_odometer !== null ? data.end_odometer.toFixed(2) : "";},
			tripLength: function(data) {return data.trip_length.toFixed(2);},
			driver: function(data) {return data.driver;},
			user: function(data) {return data.uname;},
			lastChanges: function(data) {return data.time_change.replace("<br>", " ").replace("&nbsp;", " ");},
			tripStatus: function(data) {return data.message;},
			notes: function(data) {return data.note;},
			initLocation: function(data) {return data.fromL + (data.begin.geoZone && data.fromL ? " " + data.begin.geoZone : "");},
			finalLocation: function(data) {return data.toL + (data.end.geoZone && data.toL ? " " + data.end.geoZone : "");}
		};
	}
	function hresize(e, count) {
		resizeColumns();
	}

	/// get Measure Units
	function getMeasureUnits(settings) {
		if (!settings) return null;
		//        var set = {
		//            unit: unit,
		//            s: null, // speed in km/h to mph
		//            l: null, // length in meter to mil
		//            h: null // Altitude in meter to ft
		//        };
		var metric = settings.unit.getMeasureUnits();
		if (settings.s) {
			return (metric) ? Math.round(parseInt(settings.s) / 1.609344) : parseInt(settings.s);
		}
		if (settings.l) {
			var res = parseFloat(settings.l);
			if (metric) {
				res *= 0.6214;
			}
			return res;
		}
		if (settings.h) {
			return (metric) ? Math.round(parseInt(settings.h) / 3.2808) : parseInt(settings.h);
		}
		return metric; // default return metric of units;
	}

	var currentType, currentInterval;
	/// init initDatepicker
	function initDatepicker(firstDay, setDateFormat, firstDayOrig) {
		var options = {
			template: $('#ranging-time-tpl').html(),
			 labels: {
				yesterday: $.localise.tr("Yesterday"),
				today: $.localise.tr("Today"),
				week: $.localise.tr("Week"),
				month: $.localise.tr("Month"),
				custom: $.localise.tr("Custom"),
				ok: "OK"
			},
			datepicker: {},
			onInit: function(){
				$("#ranging-time-wrap").intervalWialon('set', 0);
				currentType = $("#ranging-time-wrap").intervalWialon('type');
			},
			onChange: function(data){
				if (changed.length) {
					if(!confirm($.localise.tr('You have unsaved changes. Do you want to discard these changes?'))) {
						$("#ranging-time-wrap").intervalWialon('set', currentType, currentType == 4?currentInterval:0, true);
						return false;
					}
				}
				changeTime.apply(this, data);
				currentType = $("#ranging-time-wrap").intervalWialon('type');
				if(currentType == 4) {
					currentInterval = $("#ranging-time-wrap").intervalWialon('get');
				}

			},
			onAfterClick: function () {
				$(".date-time-content").resize();
			},
			tzOffset: wialon.util.DateTime.getTimezoneOffset(),
			now: wialon.core.Session.getInstance().getServerTime(),
		};

		options.dateFormat = wialon.util.DateTime.convertFormat(setDateFormat.split('_')[0], true);
		options.firstDay = firstDayOrig;

		$("#ranging-time-wrap").intervalWialon(options);
	}
	/// set Date
	function setDateToDatepicker(from, to) {
		if (from) {
			$("#date-from").datepicker("option", "defaultDate", from).datepicker("setDate", from);
		}
		if (to) {
			$("#date-to").datepicker("option", "defaultDate", to).datepicker("setDate", to);
		}
	}
	/// print
	function print() {
		var WinPrint = window.open('about:blank', '', 'left=300,top=300,right=500,bottom=500,width=1000,height=500');

		var t = underi18n.MessageFactory(TRANSLATIONS);
		var template = _.template(underi18n.template($("#print").html(), t));

		var ttrips = [];
		var summarize = {};
		var tdriver = getTrips(ttrips, summarize);

		var list = "<% _.each(trips, function(data) { %> " + $("#print-row").html() + " <% }); %>";
		var tcontent = '';

		// grouped by date
		if (ui_flags & 0x1) {
			var colspan = 1;
			for (var i in SetTable) {
				if (SetTable[i]) {
					colspan++;
				}
			}

			_.each(ctabs.tabs, function (tab) {
				// add info to trip
				for (var ij = 0; ij < tab.trips.length; ij++) {
					var mtext = tab.trips[ij].trip.p ? tab.trips[ij].trip.p.ui_text : '';
					var note = tab.trips[ij].trip.p ? tab.trips[ij].trip.p.nt : '';
					tab.trips[ij]['message'] = mtext ? mtext : ""; //"Business";
					tab.trips[ij]['note'] = note ? note : "";
				}

				tcontent += '<tr class="summary"><td colspan="' + colspan + '">' + tab.date +'</td></tr>';

				tcontent += _.template(list, {
					trips: tab.trips,
					diff: -tab.trips[0].index + 1,
					SetTable: SetTable
				});

				// add tab summary
				if (ui_flags & 0x2) {
					tab.print = true;
					tab.SetTable = SetTable;
					tab.get_time_string = get_time_string;
					tcontent += _.template($("#summary-row").html(), tab)
					delete tab.print;
				}
			});
		} else {
			tcontent = _.template(list, {
				trips: ttrips,
				diff: 0,
				SetTable: SetTable
			});
		}

		// add global summary
		if (ui_flags & 0x2) {
			ctabs.summary.print = true;
			ctabs.summary.SetTable = SetTable;
			ctabs.summary.get_time_string = get_time_string;
			tcontent += _.template($("#summary-row").html(), ctabs.summary)
			delete ctabs.summary.print;
		}

		// get report time interval
		var ttimes = getTimes();
		var tfrom = ttimes[0],
			tto = ttimes[1],
			tnow = ttimes[2],
			df = ttimes[3];

		var refund = 0;
		if ( payment_mileage ) {
			refund = Math.floor(summarize[textbox_items[0]] / payment_mileage) * payment_mileage * payment_more;
			refund += (summarize[textbox_items[0]] % payment_mileage) * payment_less;
		}

		var theader = _.template(underi18n.template($("#print-header-tmpl-" + header_tmpl).html(), t))({
			tfrom: tfrom,
			tto: tto,
			uname: cunit.getName(),
			tdriver: tdriver
		});

		var tfooter = _.template(underi18n.template($("#print-footer-tmpl-" + footer_tmpl).html(), t))({
			summarize: summarize,
			payment: payment,
			payment_mileage: payment_mileage,
			payment_less: payment_less,
			payment_more: payment_more,
			refund: refund,
			metric_m: (getMeasureUnits({
				unit: cunit
			})) ? $.localise.tr("mi") : $.localise.tr("km"),
			start: ttrips[0],
			end: ttrips[ttrips.length - 1],
			tnow: getTimeStr(tnow, df),
			ctabs: ctabs
		});

		var content = template({
			content: tcontent,
			metric_m: (getMeasureUnits({
				unit: cunit
			})) ? $.localise.tr("mi") : $.localise.tr("km"),
			header: theader,
			footer: tfooter,
			SetTable: SetTable
		});

		WinPrint.document.write(content);

		WinPrint.document.close();
		WinPrint.focus();
		WinPrint.print();
		// Hide this window on close (print)
		WinPrint.close();
	}

	// get [from, to] string representation
	function getTimes() {
		var ttimes = $("#ranging-time-wrap").intervalWialon('get');

		// remove <br>
		var tf = en_format_time.replace('<br>', ' ');

		// use timeZone:
		var deltaTime = wialon.util.DateTime.getTimezoneOffset() + (new Date()).getTimezoneOffset() * 60;
		var tfrom = ttimes[0] - deltaTime - wialon.util.DateTime.getDSTOffset(ttimes[0]);
		var tto = ttimes[1] - deltaTime - wialon.util.DateTime.getDSTOffset(ttimes[1]);
		var tnow = wialon.core.Session.getInstance().getServerTime() - deltaTime;

		var df = $('#ranging-time-wrap').intervalWialon('__getData');
		df = df.dateFormat || 'dd MMM yyyy';

		if (tto - tfrom < 86.4e3) {
			tto = tfrom;
		}

		return [getTimeStr(tfrom, df), getTimeStr(tto, df), tnow, df];
	}

	// get trips and summary, return driver
	function getTrips(ttrips, summarize) {
		var tdriver = null;
		_.each(textbox_items.slice(0, hoh ? 3 : 2), function(v) {
			summarize[v] = 0;
		});

		for (var i = 0, len = ctrips.length; i < len; i++) {
			var trip = {};
			$.extend(trip, ctrips[i]);
			if (!trip) {
				continue;
			}
			var data = trip_to_data(i, trip);

			if (data) {
				var mtext = data.trip.p ? data.trip.p.ui_text : '';
				var note = data.trip.p ? data.trip.p.nt : '';

				data['message'] = mtext ? mtext : ""; //"Business";
				data['note'] = note ? note : "";
				ttrips.push(data);

				if ('driver' in data) {
					tdriver = (tdriver && tdriver !== data.driver) ? '---' : data.driver;
				}

				if ((data['message'] === textbox_items[2] && !hoh) || !_.contains(textbox_items.slice(0, 3), data['message'])) {
					continue;
				}

				summarize[data['message']] += parseFloat(data.trip_length);
			}
		}

		return tdriver;
	}

	// export to XLS
	function exportxls() {
		var times = getTimes();

		var tfrom = times[0],
			tto = times[1],
			summarize = {},
			ttrips = [];

		getTrips(ttrips, summarize);

		// generate table header, get column count
		var selected = [];
		var table = {r:[[""]], b:1};
		for (var col in SetTable) {
			if (SetTable[col]) {
				table.r[0].push(TableTranslations[col]);
				selected.push(col);
			}
		}

		// document header
		var json = {sh: [{
			t: [{
				r: [[$.localise.tr("Unit"), cunit.getName()]]
			}],
			n: "Statistic"
		}]};

		var metric_m = getMeasureUnits({unit: cunit}) ? $.localise.tr("mi") : $.localise.tr("km");
		// statistic
		var stat = json.sh[0].t[0].r;
		if (SetTable.beginning) {
			stat.push([$.localise.tr("Beginning"), ttrips[0].time_from.replace("<br>", " ").replace("&nbsp;", " ")]);
		}
		if (SetTable.end) {
			stat.push([$.localise.tr("End"), ttrips[ttrips.length - 1].time_to.replace("<br>", " ").replace("&nbsp;", " ")]);
		}
		if (SetTable.startOdometer) {
			stat.push([$.localise.tr("Initial mileage") + ", " + metric_m, ttrips[0].start_odometer]);
		}
		if (SetTable.endOdometer) {
			stat.push([$.localise.tr("Final mileage") + ", " + metric_m, ttrips[ttrips.length - 1].end_odometer]);
		}
		if (SetTable.tripLength) {
			stat.push([
				$.localise.tr("Mileage") + ", " + metric_m,
				ctabs.summary.trip_length ? ctabs.summary.trip_length.toFixed(2) : "---"
			]);
		}

		// all available stats
		for (var i in summarize) {
			stat.push([i, summarize[i].toFixed(2)]);
		}

		var colspan = 1;
		for (var i in SetTable) {
			if (SetTable[i]) {
				colspan++;
			}
		}

		// trips index
		var index = 1;
		for (var tt in ctabs.tabs) {
			var tab = ctabs.tabs[tt];

			if (ui_flags & 0x1) {
				// group by date
				table.r.push([{v: tab.date, size: colspan}]);
				// reset index
				index = 1;
			}

			for (var i = 0; i < tab.trips.length; i++) {
				var mtext = tab.trips[i].trip.p ? tab.trips[i].trip.p.ui_text : "";
				var note = tab.trips[i].trip.p ? tab.trips[i].trip.p.nt : "";
				tab.trips[i]['message'] = mtext ? mtext : "";
				tab.trips[i]['note'] = note ? note : "";

				row = [index++];
				for (var j = 0; j < selected.length; j++) {
					row.push(TableColumns[selected[j]](tab.trips[i]));
				}
				table.r.push(row);
			}

			// tab summary (group & summary = 0x3)
			if ((ui_flags & 0x3) == 0x3) {
				table.r.push(getSummaryRow(selected, tab));
			}
		}

		// global summary
		if (ui_flags & 0x2) {
			table.r.push(getSummaryRow(selected, ctabs.summary));
		}

		// add table to json
		json.sh.push({t:[table], n: "Trips"});

		// send print request
		$.post(PRINT_URL + '/print.php', {data: JSON.stringify(json)}).done(function (response, status){
			if (response.success && status == "success") {
				window.location.href = PRINT_URL + response.url;
			} else {
				alert($.localise.tr("Error while export to xls"));
			}
		});
	}

	// get summary row for XLSX
	function getSummaryRow(cols, data) {
		var row = [''];
		for (var i = 0, skip; i < cols.length; i++) {
			skip = ['duration', 'startOdometer', 'endOdometer', 'tripLength'].indexOf(cols[i]) == -1;
			if (skip) {
				row.push('');
			} else if (cols[i] == 'duration') {
				// format duration
				row.push(get_time_string(data.duration));
			} else {
				row.push(TableColumns[cols[i]](data));
			}
		}
		return row;
	}

	// export to CVS
	function exportcsv() {
		var times = getTimes();

		var tfrom = times[0],
			tto = times[1],
			summarize = {},
			ttrips = [],
			link = document.createElement('a'), // Create empty link
			mimeType = 'text/csv',
			fileName= tfrom + (tfrom == tto ? '' : '_' + tto) + '.csv',
			cnt = '';

		// prepare trips array
		getTrips(ttrips, summarize);

		// generate first row
		var selected = [];
		for (var col in SetTable) {
			if (SetTable[col]) {
				cnt += (selected.length > 0 ? ',' : '') + prepareString(TableTranslations[col]);
				selected.push(col);
			}
		}
		cnt += '\n';

		// add trip data data
		for (var i = 0; i < ttrips.length; i++) {
			for (var j = 0; j < selected.length; j++) {
				// prepare string and add it to content (with separator)
				cnt += (j > 0 ? ',' : '') + prepareString(TableColumns[selected[j]](ttrips[i]));
			}
			cnt += '\n';
		}

		// IE10
		if (navigator.msSaveBlob) {
			navigator.msSaveBlob(new Blob([cnt], {type: mimeType}), fileName);
			return this;
		}
		// Check support for html5 a[download]
		if ("download" in link) {
			link.setAttribute("download", fileName);
		// Iframe dataURL download
		} else {
			link = document.createElement("iframe");
		}
		link.href = "data:" + mimeType + "," + encodeURIComponent(cnt);
		link.style.display = "none";
		document.body.appendChild(link);
		setTimeout(function() {
			// Trigger click to download
			if ("download" in link) {
				link.click();
			}
			// Remove link or frame
			document.body.removeChild( link );
		}, 250);
	}

	// prepare string to csv export
	function prepareString(str) {
		var result = str.toString();
		result = result.replace('&nbsp;', ' ');
		result = result.replace(/"/g, '""');
		if (result.search(/("|,|\n)/g) >= 0) {
			result = '"'+ result +'"';
		}
		return result;
	}

	/// for settings to columns of table
	function getSettingsTable() {
		var setForm = $('#select-table-columns-list');
		// check for setting flag flagExistChangeSet;
		for (var name in SetTable) {
			var opt = setForm.find('[name=' + name + ']').prop('checked');
			if (SetTable[name] !== opt) {
				flagExistChangeSet = true;

				SetTable[name] = opt;
				// save to cookies:
				if (SetTable[name]) {
					deleteCookie(name);
				} else {
					// save FALSE settings
					setCookie(name, SetTable[name]);
				}
			}
		}
	}
	/// load settings from cookies
	function loadSetTable() {
		for (var key in SetTable) {
			var state = '' + getCookie(key);
			SetTable[key] = (state === 'undefined') ? true : false;
		}
	}
	/// renderTable
	function renderTable() {
		$("#paginated-table").trigger("refresh", {
			data: ui_flags & 0x1 ? ctabs : ctrips
		});
		ltranlate(cunit);
		resizeColumns();
	}
	/// addEventsListeners
	function addEventsListeners() {
		// custom fire event for change cols of table
		$(window).on('updateSettings', renderTable);
		var timeOut;
		$(window).on('updateData', function(e, input) {
			apply(input);
		});

		$("#execute-btn").click(execute);
		$("#nrowonpage").change(change_nrowonpage);
		$("#page_selector").keypress(change_npage);
		// show/hide dropdown menu;
		$('#table-wrap').on('click', function(evt) {
			if (evt.target.id != 'select-table-columns') {
				return;
			}

			var p = $("#select-table-columns-list");
			if (p.hasClass('open')) {
				p.removeClass('open');
				getSettingsTable();
				if (flagExistChangeSet) {
					$(window).trigger('updateData');
				}
			} else {
				p.addClass('open');
			}
			return false;
		});
		$(window).on('click', function(e) {
			if (!$(e.target).closest('#select-table-columns-list').length && $('#select-table-columns-list').hasClass('open')) {
				$('#select-table-columns-list').removeClass('open');
				getSettingsTable();
				if (flagExistChangeSet) {
					$(window).trigger('updateSettings');
				}
			}
		});

		$(window).resize(hresize);
		$(window).trigger('resize'); // fire event for first load app

		$('#paginated-table textarea.note, #paginated-table input.message').live('focusin', function() {
			$(this).attr('data-start', $(this).val());
		});
		var timeOut;
		$('#paginated-table textarea.note, #paginated-table input.message').live('change keyup', function() {
			var $trip = $(this).parents('[id^=trip_]');
			if (!$trip.length) {
				return false;
			}
			var btn = $trip.find('.save-btn'),
				id = $trip[0].id;
			if ($(this).data('start') != $(this).val()) {
				$('#print-btn').prop('disabled', true);
				$('#export-xls-btn').prop('disabled', true);
				$('#export-csv-btn').prop('disabled', true);
				// check if btn already pushed into array
				if (_.indexOf(changed, id) === -1) {
					changed.push(id);
				}
				btn.show();
				resizeColumns();
			}
		});
		// add event for autosetting attribute
		$("#all-type-for-trip").live('change', function() {
			var text = ($(this).val() != 0) ? $(this).children("option:selected").text() : '';
			for (var i = 0, len = ctrips.length; i < len; i++) {
				if (!ctrips[i]) {
					continue;
				}
				ctrips[i]['uinput'] = text;
				ctrips[i]['changed'] = true;
			}
			$(".message").val(text); // fire event for save data;
			// $(window).trigger('updateData');
		});
		// Save necessary row trip or all trips
		$('#apply_changes, .save-btn').live('click', function(e) {
			var $this = $(this);
			apply($this.hasClass('save-btn') ? $this : null);
		});
		$(window).on('beforeunload', function(){
			if (changed.length) {
				return $.localise.tr('You have unsaved changes. Are you sure you want to leave?');
			}
		});

		$("body").delegate(".message", "input", function() {
			var row = $(this).parents("tr");
			var id = $(row).attr('id');
			if (!id) {
				return;
			}

			var index = id.split("_")[1];
			var trip = ctrips[index];
			if (trip) {
				trip['uinput'] = $(this).val();
				trip['changed'] = true;
			}
		});

		$("body").delegate(".message", "change", function() {
			var row = $(this).parents("tr");
			var id = $(row).attr('id');
			if (!id) {
				return;
			}

			var index = id.split("_")[1];
			var trip = ctrips[index];
			if (trip) {
				trip['uinput'] = $(this).val();
				trip['changed'] = true;
			}
		});

		$("body").delegate(".note", "change", function() {
			var row = $(this).parents("tr");
			var id = $(row).attr('id');
			if (!id) {
				return;
			}

			var index = id.split("_")[1];
			var trip = ctrips[index];
			if (trip) {
				trip['unote'] = $(this).val();
				trip['changed'] = true;
			}
		});

		(function () {
			var previous;
			$("#units-select").on('focus', function () {
				// Store the current value on focus and on change
				previous = this.value;
			}).change(function() {
				if (changed.length) {
					if(confirm($.localise.tr('You have unsaved changes. Do you want to discard these changes?'))) {
						execute();
					} else {
						$(this).val(previous);
					}
				} else {
					execute();
				}
				// Make sure the previous value is updated
				previous = this.value;
			});
		})();

		$("#print-btn").click(print);
		$("#export-csv-btn").click(exportcsv);
		$("#export-xls-btn").click(exportxls);
		jQuery("#config-btn").click(function() {
			if (home === null || office === null) {
				loadUserSettings();
			}
			jQuery("#home_geofence").val(home.id);
			jQuery("#home_geofence_select").val(home.name);
			jQuery("#office_geofence").val(office.id);
			jQuery("#office_geofence_select").val(office.name);
			jQuery("#show_hoh_select").prop('checked', hoh);
			jQuery("#show_payment_select").prop('checked', payment);
			jQuery("#group_by_date").prop('checked', (ui_flags & 0x1) == 0x1);
			jQuery("#show_summary").prop('checked', (ui_flags & 0x2) == 0x2);
			jQuery("#mileage_values_select").val(mileage_values);
			jQuery("#header_tmpl_select").val(header_tmpl);
			jQuery("#footer_tmpl_select").val(footer_tmpl);
			jQuery("#payment_less_select").val(payment_less || 0);
			jQuery("#payment_more_select").val(payment_more || 0);
			jQuery("#payment_mileage_select").val(payment_mileage || 0);
			jQuery("#user_settings").toggle();
		});
		jQuery(".modal-overflow").click(function(event) {
			if (event.target == this || jQuery(event.target).hasClass("close")) {
				if (jQuery(event.target).hasClass("save")) {
					var user = wialon.core.Session.getInstance().getCurrUser();
					// calculate UI flags
					ui_flags = 0;
					if (jQuery("#group_by_date").prop("checked")) {
						// 0x1 - group by date
						ui_flags |= 0x1;
					}
					if (jQuery("#show_summary").prop("checked")) {
						// 0x2 - show summary
						ui_flags |= 0x2;
					}
					// calculate mileage values algorithm
					mileage_values = jQuery("#mileage_values_select").val();

					// construct settings JSON
					var settings = {
						'geofences': {
							'home': {
								'id': jQuery("#home_geofence_select").val()?jQuery("#home_geofence").val():'',
								'name': jQuery("#home_geofence_select").val()
							},
							'office': {
								'id': jQuery("#office_geofence_select").val()?jQuery("#office_geofence").val():'',
								'name': jQuery("#office_geofence_select").val()
							}
						},
						'print': {
							'hoh': jQuery("#show_hoh_select").prop("checked"),
							'payment': jQuery("#show_payment_select").prop("checked"),
							'header_tmpl': jQuery("#header_tmpl_select").val(),
							'footer_tmpl': jQuery("#footer_tmpl_select").val(),
							'payment_less': jQuery("#payment_less_select").val(),
							'payment_more': jQuery("#payment_more_select").val(),
							'payment_mileage': jQuery("#payment_mileage_select").val(),
						},
						'ui_flags': ui_flags,
						'mileage_values': mileage_values
					}
					user.updateCustomProperty('__app__logbook_settings', JSON.stringify(settings))
					home = settings.geofences.home;
					office = settings.geofences.office;
					hoh = settings.print.hoh;
					header_tmpl = settings.print.header_tmpl;
					footer_tmpl = settings.print.footer_tmpl;
					payment_less = parseFloat(settings.print.payment_less);
					payment_more = parseFloat(settings.print.payment_more);
					payment_mileage = parseInt(settings.print.payment_mileage);
					payment = settings.print.payment;
					execute();
				}
				jQuery("#user_settings").toggle();
			}
		});

		$("#time-select").on("click", ".time-template", function() {
			//            if ($(this).hasClass('active')) return;
			if (changed.length) {
				if(!confirm($.localise.tr('You have unsaved changes. Do you want to discard these changes?'))) {
					return false;
				}
			}
			changeTime(this.id.split("_")[1]);
		});

		$('#time-label .past').click(function() {
			if (changed.length) {
				if(!confirm($.localise.tr('You have unsaved changes. Do you want to discard these changes?'))) {
					return false;
				}
			}
			var self = this;
			changePeriod(0);
			if (changeTimeTimeout !== null) {
				clearTimeout(changeTimeTimeout);
			}
			changeTimeTimeout = setTimeout(function() {
				execute();
				clearTimeout(changeTimeTimeout);
				changeTimeTimeout = null;
			}, 1000);
			return false;
		});
		$('#time-label .future').click(function() {
			if (changed.length) {
				if(!confirm($.localise.tr('You have unsaved changes. Do you want to discard these changes?'))) {
					return false;
				}
			}
			var self = this;
			changePeriod(1);
			if (changeTimeTimeout !== null) {
				clearTimeout(changeTimeTimeout);
			}
			changeTimeTimeout = setTimeout(function() {
				execute();
				clearTimeout(changeTimeTimeout);
				changeTimeTimeout = null;
			}, 1000);
			return false;
		});
	}
	/// support cookies getCookie
	function getCookie(name) {
		var matches = document.cookie.match(new RegExp(
		"(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
		));
		return matches ? decodeURIComponent(matches[1]) : undefined;
	}
	/// support cookies getCookie
	function setCookie(name, value, options) {
		options = options || {};

		var expires = options.expires;

		if (typeof expires == "number" && expires) {
			var d = new Date();
			d.setTime(d.getTime() + expires * 1000);
			expires = options.expires = d;
		}
		if (expires && expires.toUTCString) {
			options.expires = expires.toUTCString();
		}

		value = encodeURIComponent(value);

		var updatedCookie = name + "=" + value;

		for (var propName in options) {
			updatedCookie += "; " + propName;
			var propValue = options[propName];
			if (propValue !== true) {
				updatedCookie += "=" + propValue;
			}
		}

		document.cookie = updatedCookie;
	}
	/// support cookies getCookie
	function deleteCookie(name) {
		setCookie(name, "", {
			expires: -1
		})
	}
	/// get time from input
	function get_time_from_input() {
		var date_from = $("#date-from").datepicker("getDate");
		var date_to = $("#date-to").datepicker("getDate");
		if (!date_from || !date_to) return [];

		var time_from = Math.round(date_from.getTime() / 1000);
		var time_to = Math.round(date_to.getTime() / 1000) + 86400;
		return [time_from, time_to - 1];
	}

	/// changeTime
	function changeTime(value, interval){
		if( ! interval)
			return ;
		value = parseInt(value, 10);
		// var interval = get_time_from_input();
		if (value == 4 && LOCAL_STATE.time_custom === null) {
			LOCAL_STATE.time_custom = interval;
		}
		LOCAL_STATE.time_type = value;


			$('#execute-btn').hide();
			if (changeTimeTimeout !== null) {
				clearTimeout(changeTimeTimeout);
			}
			changeTimeTimeout = setTimeout(function() {
				execute();
				clearTimeout(changeTimeTimeout);
				changeTimeTimeout = null;
			}, 1000);

		activateTimeTemplate(value);
	}

	/** Activate interval time ( buttons, labels, timepickers... )
	 *
	 *  @param {int} value   type of interval. Possible values: @see changeTime
	 *  @returns {bool}   true - done without errors, false - activation failed
	 */
	function activateTimeTemplate(value) {
		$("#time-select .time-template.active").removeClass("active");

		var obj = $("#time_" + value);
		if (!obj && !obj.length) return false;

		if (value === 0 || value === 1) {
			if ((LOCAL_STATE.time_from == TODAY.from - 86400 && LOCAL_STATE.time_to == TODAY.to - 86400 * 2 + 1) ||
				(LOCAL_STATE.time_from == TODAY.from && LOCAL_STATE.time_to == TODAY.to - 86399)) {
				obj.addClass("active");
			}
		} else {
			obj.addClass("active");
		}


		$(".date-time-content").resize();
		return true;
	}

	/** Show statistic
	 */
	function showSummary(summary) {
		var template = _.template($("#summary-row").html());
		var html = '';

		if (summary) {
			if (!('SetTable' in summary)) {
				summary.SetTable = SetTable;
				summary.get_time_string = get_time_string;
			}
			html += template(summary);
		}

		if (ctabs.summary) {
			if (!('SetTable' in ctabs.summary)) {
				ctabs.summary.SetTable = SetTable;
				ctabs.summary.get_time_string = get_time_string;
			}
			html += template(ctabs.summary);
		}

		// render template
		$("#paginated-table-footer tfoot").html(html);
	}

	/** show message
	 *
	 *  @mes {string} message. may be HTML
	 *  @className {string} class for wrapper of message: none = info, "error" - error message
	 */
	function showMessage(message, className) {

		var html = _.template($('#message').html(), {
			message: message,
			className: className
		});
		$('#message-wrap').remove();
		$('#table-wrap').append(html);
	}
	function updateFields(items, data) {
		items = (items) ? items : $('#paginated-table .message'); // if item == undefined, then apply for all message's input
		$(items).each(function() {
			var item = $(this);
			var tripId = $(item).closest('tr[id^="trip_"]').attr('id');
			if (!tripId) return;
			for (var i = 0, l = data.length; i < l; i++) {
				// successful data storage
				if (data[i].id == tripId && data[i] && data[i]['p']) {
					if(!data[i]['changed']) continue;
					data[i]['changed'] = false;
					var mes = data[i]['p'];

					if (item.hasClass('message') && mes['ui_text']) {
						item.val(mes['ui_text'])
							.closest('td')
							.removeClass('error');
					} else if (item.hasClass('note') && (mes['nt'])) {
						item.val(mes['nt'])
							.closest('td')
							.removeClass('error');
					}

					if (mes['un']) {
						item.closest('td').siblings('.uname-wrap').html(mes['un']);
						// update ctrips
						data[i].uname = mes['un'];
					}
					if (mes['tc']) {
						var time = getTimeStr(parseInt(mes['tc']));
						item.closest('td').siblings('.time_change-wrap').html(time);
						// update ctrips
						data[i].time_change = time;
					}

					// update location
					// ToDo: we rly need it here?
					var from = data[i].fromL,
						to = data[i].toL;
					if (data[i].begin.geoZone) {
						from += (from ? '; ': '') + '<span class="geozone">' + data[i].begin.geoZone + '</span>';
					}
					if (data[i].end.geoZone) {
						to += (to ? '; ': '') + '<span class="geozone">' + data[i].end.geoZone + '</span>';
					}
					item.closest('td').siblings('.address-from').html(from);
					item.closest('td').siblings('.address-to').html(to);

				}
			}
		});
	}
	/// return date str
	function getTimeStr(time, tf) {
		var format_time = (tf) ? tf : ( (en_format_time == '') ? "yyyy-MM-dd HH:mm" : en_format_time );
		return wialon.util.DateTime.formatTime(time, 0, format_time);
	}
	/// return date str
	function getDateStr(time) {
		var df = '';
		if (en_format_time) {
			df = en_format_time.split('<br>')[0] || 'yyyy-MM-dd';
		}
		return wialon.util.DateTime.formatDate(time, df);
	}
	/// adapter dateFormat for datetimepicker
	function getAdaptedDateFormat(date) {

		var s = date.replace(/(%\w)|_|%%/g, function(str) {
			switch (str) {
				case "%Y": return 'yy';
				case "%y": return 'y';
				// month
				case "%B": return 'MM'; // MM - month name long
				case "%b": return 'M'; // M - month name short
				case "%m": return 'mm'; // mm - month of year (two digit)
				case "%l": return 'm'; // m - month of year (no leading zero)
				// day
				case "%A": return 'DD'; // DD - day name long
				case "%a": return 'D'; // D - day name short
				case "%E": return 'dd'; // dd - (two digit)
				case "%e": return 'd'; // d - (no leading zero)
				// for time format:
				case "%H": return 'HH'; // 24h
				case "%I": return 'hh'; // 12h
				case "%p": return 'TT'; // AM/PM
				case "%M": return 'mm';
				default: return '';
			}
		});

		return s;
	}

	/// A function to execute after the DOM is ready.
	$(document).ready(function() {
		// detect right print service url
		$.ajax(PRINT_URL + '/print.php', {
			complete: function(response, status) {
				if (status != "success") {
					PRINT_URL = "http://apps.wialon.com"
				}
			}
		});

		disabletableui();
		var url = get_html_var("baseUrl");
		if (!url) {
			url = get_html_var("hostUrl");
		}
		if (!url) {
			return null;
		}

		$('#execute-btn').hide();

		LANG = get_html_var("lang");
		if ((!LANG) || ($.inArray(LANG, ["en", "ru", "de", "sk", "cs", "fi", "ee"]) == -1)) {
			LANG = "en";
		}
		$.localise('lang/', {
			language: LANG
		});

		// load datepicker locale
		if (LANG != "en") {
			load_script("//apps.wialon.com/plugins/wialon/i18n/" + LANG + ".js");
		}

		url += "/wsdk/script/wialon.js" ;
		load_script(url, init_sdk);

		hresize(null);
	});
}) (jQuery, _);

(function() {
	$(document).ready(function() {
		var pagination = new Pagination({})
	});

	var Pagination = function() {
		this.o = {
			list: $('#pg')

		};
		this.init = function(settings) {
			var self = this;
			$.extend(self.o, settings);
			this.addEventListeners();
		};
		this.addEventListeners = function() {};
		this.render = function() {};
		this.getCountItems = function() {
			return 10;
		};

		return this.init();
	}

})();
