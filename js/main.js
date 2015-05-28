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
		var pairs = decodeURIComponent(document.location.search.substr(1)).split("&");
		for (var i = 0; i < pairs.length; i++) {
			var pair = pairs[i].split("=");
			if (pair[0] === name) {
				pair.splice(0, 1);
				return pair.join("=");
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
			}
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

				Locale = getLocale();
				wialon.util.DateTime.setLocale(Locale.days, Locale.months, Locale.days_abbrev, Locale.months_abbrev);

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

		var times = $("#ranging-time-wrap").intervalWialon('get');
		if (!times) {
			alert($.localise.tr("Please select time interval."));
			return;
		}

		flagExistChangeSet = false;
		ctimes = times; // stores current worker time in global variable
		$('#message-wrap').remove();
		ltranlate(unit);
		load_trips(unit, times);
	}
	/// Main function for unloading trips
	function load_trips(unit, times) {
		ctrips = [];
		var res = resources[0]; // use first resource for create report.

		// specify time interval object
		var interval = {
			"from": times[0],
			"to": times[1],
			"flags": wialon.item.MReport.intervalFlag.absolute
		};


		var events_config = {
			itemId: cunit.getId(),
			eventType: 'trips',
			ivalType: 4,
			ivalFrom: times[0],
			ivalTo: times[1]
		};

		var sensors = cunit.getSensors();
		var private_sensor = 0;
		for(var s_id in sensors){
			if(sensors[s_id].t == "private mode") { //detect trip status by private mode sensor
				private_sensor = sensors[s_id].id;
				events_config.filter1 = sensors[s_id].id;
				events_config.eventType += ',sensors';
				break;
			}
		}
		wialon.core.Remote.getInstance().remoteCall(
			"unit/get_events",
			events_config,
			wialon.util.Helper.wrapCallback(qx.lang.Function.bind(function(unit, code, events) {
				if(code != 0 || !events) {
					$("#table-wrap").activity(false);
					$("#execute-btn").removeAttr("disabled");
					undisableui();
					disabletableui();
					showMessage($.localise.tr("No data for selected interval."));
					return;
				}
				var locations = [];
				var trips = [], ev_sensors = [];
				if (!events.trips.from  && !events.trips.to ){
					for(var i = 0; i<events.trips.length; i++){
						locations.push({lat:events.trips[i].from.y, lon:events.trips[i].from.x});
						locations.push({lat:events.trips[i].to.y, lon:events.trips[i].to.x});
					}
					trips=events.trips;
				} else if( typeof events.trips == "object") {
					locations.push({lat:events.trips.from.y,lon:events.trips.from.x});
					locations.push({lat:events.trips.to.y,lon:events.trips.to.x});
					trips.push(events.trips);
				}
				if(events.sensors){
					if (!events.sensors[private_sensor].from  && !events.sensors[private_sensor].to ){
						ev_sensors=events.sensors[private_sensor];
					} else if( typeof events.sensors[private_sensor] == "object") {
						ev_sensors.push(events.sensors[private_sensor]);
					}
				}
				if(locations.length > 0){
					wialon.util.Gis.getLocations(locations, qx.lang.Function.bind(function(trips_array, sensors_array, unit, code, result) {
						if (!code && result) {
							for(var arr_id in trips_array){
								trips_array[arr_id].from.location = result[arr_id*2];
								trips_array[arr_id].to.location = result[arr_id*2+1];
							}
							ctrips = getNormalizedData(trips_array,sensors_array,unit);
							refresh_drivers(cunit, times, ctrips);
							$("#paginated-table").dividedByPages(ctrips, trips_to_table);
							undisableui();
							undisabletableui();
						}
					}, this, trips, ev_sensors, unit));
				}else {
					$("#table-wrap").activity(false);
					$("#execute-btn").removeAttr("disabled");
					undisableui();
					disabletableui();
					showMessage($.localise.tr("No data for selected interval."));
				}
			}, this, unit))
		);
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
		if (settings['geofences']) {
			if (settings['geofences']['home']) {
				home = settings['geofences']['home'];
			}

			if (settings['geofences']['office']) {
				office = settings['geofences']['office'];
			}
		}
	}
	function getNormalizedData(trips, sensors, unit) {
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
			if (home && home.id && office && office.id) {
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
			for(ev_id in sensors) {
				if( sensors[ev_id].from.t <= c.to.t && sensors[ev_id].to.t >= c.from.t) {
					status = textbox_items[1]; // Personal
					type ='';
					home_mode = false;
					private_mode = true;
					c.from.location_prvt = c.from.location;
					c.from.location = '---';
					c.to.location_prvt = c.to.location;
					c.to.location = '---';
					beginGeofence = endGeofence = '';
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

			if(private_mode && status!=textbox_items[1] ) {
					c.from.location = c.from.location_prvt;
					c.to.location = c.to.location_prvt;
			}

			var bySensor = (private_mode && status==textbox_items[1]);
			var data = {
				id: "trip_" + i,
				index: i + 1,

				time_from: getTimeStr(c.from.t),
				time_to: getTimeStr(c.to.t),
				from: c.from,
				to: c.to,
				fromL: (c.from.location && !home_mode) ? c.from.location : '',
				toL: (c.to.location && !home_mode) ? c.to.location : '',
				duration: get_time_string(c.to.t - c.from.t),
				start_odometer:getMeasureUnits({unit: unit, l: (c.odometer-c.distance)/1000}),
				end_odometer:getMeasureUnits({unit: unit, l: (c.odometer)/1000}),
				trip_length:getMeasureUnits({unit: unit, l: (c.distance)/1000}),
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
				changed: chngd
			};


			if (LANG == "ru") {
				data.fromL = data.fromL.replace(/km from/g, 'км от');
				data.toL = data.toL.replace(/km from/g, 'км от');
			}

            if (data['uinput']!=textbox_items[1] && data.from.location_prvt && data.to.location_prvt) {
                data.fromL = data.from.location=data.from.location_prvt;
                data.toL = data.to.location=data.to.location_prvt;
            } else if (data['uinput']==textbox_items[1] && data.from.location!== '---') {
                data.from.location_prvt=data.from.location;
                data.to.location_prvt=data.to.location;
                data.fromL = data.from.location='---';
                data.toL = data.to.location='---';
            }

			m.push(data);
			// if (chngd) {//mark auto changed
			// 	changed = true;
			// }
		}
		textbox_items = _.uniq(textbox_items);
		updateStateList(textbox_items);
		return m
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
			ctrips = trips;
			$("#paginated-table").dividedByPages(ctrips, trips_to_table);
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
	function trips_to_table(sindex, trips) {
		//disableui();
		for (var i = 0, len = trips.length; i < len; i++) {
			var trip = trips[i];
			if (!trip) {
				continue;
			}
			sindex = _trip_to_table(sindex, trip);
		}
		//undisableui();
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
	/// The auxiliary function for transform trip in table
	function _trip_to_table(sindex, trip) {
		var row = trip_to_row(sindex++, trip);
		$("#paginated-table").children("tbody").append(row);

		var text = get_trip_mtext (trip) || ""; // "Business"; // set default value
		var imessage = $("#trip_" + (sindex - 1)).find("input.message");
		$(imessage).val(text);
		text = get_trip_ntext (trip);
		$("#trip_" + (sindex - 1)).find("textarea.note").val(text);
		$(imessage).textbox({
			items: textbox_items
		});
		return sindex;
	}
	/// Fetches data from trip for represent in table
	function trip_to_data(id, trip) {
		trip.SetTable = SetTable;
		return trip;
	}
	/// The auxiliary function for transform trip in row table
	function trip_to_row(id, trip) {
		var data = trip_to_data(id, trip);
		var template = _.template($("#row").html());
		return template(data);
	}
	/// Disabled ui
	function disableui() {
		$('#select-table-columns-wrap').appendTo($('#table-wrap'));
		$('#nrowonpage').appendTo($('#table-wrap'));
		//		try { $("#table-wrap").activity(); } catch (e) {}
		$("#execute-btn").attr("disabled", "disabled");
		disabletableui();
	}
	/// Undisabled ui
	function undisableui() {
		try {
			$("#table-wrap").activity(false);
		} catch ( e ) {}
		$("#execute-btn").removeAttr("disabled");
		$('#select-table-columns-wrap').appendTo($('#expand-menu'));
		$('#nrowonpage').appendTo($('#nrowonpage-wrap'));
		undisabletableui();
	}
	/// Disabled table ui
	function disabletableui() {
		$("#table-instruments").hide();
		$("#paginated-table").hide();
		$("#print-btn").hide();
	}
	/// Undisabled table ui
	function undisabletableui() {
		$("#table-instruments").show();
		$("#paginated-table").show();
		$("#print-btn").show();
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

		// var t = underi18n.MessageFactory(TRANSLATIONS);
		// add tab for datetimepiker
		// $('#ranging-time-wrap').html( _.template(underi18n.template($('#ranging-time-tpl').html(), t)) );
		var LANG = get_html_var('lang') || 'en';
		var loc = getLocale();
		$.datepicker.regional[LANG] = {
			prevText: TRANSLATIONS['Prev'],
			nextText: TRANSLATIONS['Next'],
			currentText: TRANSLATIONS['Today'],
			monthNames: loc.months,
			monthNamesShort: loc.months_abbrev,
			dayNames: loc.days,
			dayNamesShort: loc.days_abbrev,
			dayNamesMin: loc.days_abbrev,
		};
		$.datepicker.setDefaults($.datepicker.regional[LANG]);
		// var t = underi18n.MessageFactory(TRANSLATIONS);
	}
	///
	function ltranlate(unit) {
		// add TH to table
		var t = underi18n.MessageFactory(TRANSLATIONS);
		$('#paginated-table thead').html(_.template(underi18n.template($('#th-row').html(), t), {
			SetTable: SetTable,
			LANG: LANG,
			metric_m: ( (getMeasureUnits({
				unit: unit
			})) ? $.localise.tr("mi") : $.localise.tr("km"))
		}));
		// add list
		$('#select-table-columns-list').html(_.template(underi18n.template($('#select-table-columns-list-tpl').html(), t), {
			SetTable: SetTable,
			metric_m: ( (getMeasureUnits({
				unit: unit
			})) ? $.localise.tr("mi") : $.localise.tr("km"))
		}));
	}
	function hresize(e, count) {
		var CONST_H = 204;
		var isless = false,
			wheight = $(window).height();
		if (e === null) {
			var nheight = count * 49; // where 39 height of on row in table
			if ((nheight + CONST_H) > wheight) {
				isless = true;
			} else {
				$("#table-wrap").height(nheight);
			}
		}

		if (e !== null || isless) {
			$("#table-wrap").height(wheight - CONST_H);
		}
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
			return res.toFixed(2);
		}
		if (settings.h) {
			return (metric) ? Math.round(parseInt(settings.h) / 3.2808) : parseInt(settings.h);
		}
		return metric; // default return metric of units;
	}
	/// set Locale Date Time
	function getLocale() {
		return {
			days: [
				$.localise.tr("Sunday"),
				$.localise.tr("Monday"),
				$.localise.tr("Tuesday"),
				$.localise.tr("Wednesday"),
				$.localise.tr("Thursday"),
				$.localise.tr("Friday"),
				$.localise.tr("Saturday")
			],
			months: [
				$.localise.tr("January"),
				$.localise.tr("February"),
				$.localise.tr("March"),
				$.localise.tr("April"),
				$.localise.tr("May"),
				$.localise.tr("June"),
				$.localise.tr("July"),
				$.localise.tr("August"),
				$.localise.tr("September"),
				$.localise.tr("October"),
				$.localise.tr("November"),
				$.localise.tr("December")
			],
			days_abbrev: [
				$.localise.tr("Sun"),
				$.localise.tr("Mon"),
				$.localise.tr("Tue"),
				$.localise.tr("Wed"),
				$.localise.tr("Thu"),
				$.localise.tr("Fri"),
				$.localise.tr("Sat")
			],
			months_abbrev: [
				$.localise.tr("Jan"),
				$.localise.tr("Feb"),
				$.localise.tr("Mar"),
				$.localise.tr("Apr"),
				$.localise.tr("May"),
				$.localise.tr("Jun"),
				$.localise.tr("Jul"),
				$.localise.tr("Aug"),
				$.localise.tr("Sep"),
				$.localise.tr("Oct"),
				$.localise.tr("Nov"),
				$.localise.tr("Dec")
			]
		}
	}
	/// set Locale Date Time
	function setLocaleDateTime() {
		wialon.util.DateTime.setLocale(Locale.days, Locale.months, Locale.days_abbrev, Locale.months_abbrev);
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
			tzOffset: wialon.util.DateTime.getTimezoneOffset() + wialon.util.DateTime.getDSTOffset(),
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
		var windowUrl = 'about:blank';
		var uniqueName = new Date();
		var windowName = 'Print' + uniqueName.getTime();

		var WinPrint = window.open(windowUrl, "", 'left=300,top=300,right=500,bottom=500,width=1000,height=500');

		var t = underi18n.MessageFactory(TRANSLATIONS);
		var template = _.template(underi18n.template($("#print").html(), t));

		var ttrips = [];
		for (var i = 0, len = ctrips.length; i < len; i++) {
			var trip = {};
			$.extend(trip, ctrips[i]);
			if (!trip) {
				continue;
			}
			var data = trip_to_data(i, trip);
			if (data) {
				var mtext = get_trip_mtext(trip);
				var note = get_trip_ntext(trip);

				data['message'] = mtext ? mtext : ""; //"Business";
				data['note'] = note ? note : "";
				ttrips.push(data);
			}
		}

		var list = "<% _.each(trips, function(data) { %> " + $("#print-row").html() + " <% }); %>";
		var tcontent = _.template(list, {
			trips: ttrips
		});

		var ttimes = $("#ranging-time-wrap").intervalWialon('get');

		// remove <br>
		var tf = en_format_time.replace('<br>', ' ');

		// use timeZone:
		var deltaTime = wialon.util.DateTime.getTimezoneOffset() + (new Date()).getTimezoneOffset() * 60;
		var tfrom = ttimes[0] - deltaTime;
		var tto = ttimes[1] - deltaTime;

		var content = template({
			content: tcontent,
			uname: cunit.getName(),
			metric_m: (getMeasureUnits({
				unit: cunit
			})) ? $.localise.tr("mi") : $.localise.tr("km"),
			tfrom: getTimeStr(tfrom, tf),
			tto: getTimeStr(tto, tf),
			SetTable: SetTable
		});

		WinPrint.document.write(content);

		WinPrint.document.close();
		WinPrint.focus();
		WinPrint.print();
		// Hide this window on close (print)
		WinPrint.close();
	}

	/// for settings to columns of table
	function getSettingsTable() {
		var setForm = $('#select-table-columns-list');
		// check for setting flag flagExistChangeSet;
		for (var name in SetTable) {
			var opt = setForm.find('[name=' + name + ']').prop('checked');
			if (SetTable[name] !== opt) {
				flagExistChangeSet = true;
				break;
			}
		}
		// fetch data
		if (flagExistChangeSet) {
			for (var key in SetTable) {
				SetTable[key] = setForm.find('[name=' + key + ']').prop('checked');
				// save to cookies:
				(SetTable[key]) ? deleteCookie(key) : setCookie(key, SetTable[key]); // save FALSE settings
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
		var $sel = $('#select-table-columns-wrap');
		var $nrowonpage = $('#nrowonpage');
		$sel.appendTo($('#table-wrap'));
		$nrowonpage.appendTo($('#table-wrap'));
		$("#paginated-table").trigger("refresh", {
			data: ctrips
		});
		ltranlate(cunit);
		$sel.appendTo($('#expand-menu'));
		$nrowonpage.appendTo($('#nrowonpage-wrap'));

	}
	/// addEventsListeners
	function addEventsListeners() {
		// custom fire event for change cols of table
		$(window).on('updateSettings', function() {
			renderTable();
		});
		var timeOut;
		$(window).on('updateData', function(e, input) {
			apply(input);
		});

		$("#execute-btn").click(execute);
		$("#nrowonpage").change(change_nrowonpage);
		$("#page_selector").keypress(change_npage);
		// show/hide dropdown menu;
		$('#select-table-columns').on('click', function() {
			var p = $(this).parent();
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
			if (!$(e.target).closest('#select-table-columns-wrap').length && $('#select-table-columns-wrap').hasClass('open')) {
				$('#select-table-columns-wrap').removeClass('open');
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
				// check if btn already pushed into array
				if (_.indexOf(changed, id) === -1) {
					changed.push(id);
				}
				btn.show();
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
		$('#apply_changes, .save-btn').live('click',function(e) {
			var $this = $(this);
			$(window).trigger('updateData', $this.hasClass('save-btn') ? $this : null);
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
		jQuery("#config-btn").click(function() {
			var user = wialon.core.Session.getInstance().getCurrUser();
			var settings = user.getCustomProperty('__app__logbook_settings', '{}');
			settings = JSON.parse(settings);
			var home = office = {
				'name': '',
				'id': ''
			};
			if (settings['geofences']) {
				if (settings['geofences']['home']) {
					home = settings['geofences']['home'];
				}

				if (settings['geofences']['office']) {
					office = settings['geofences']['office'];
				}
			}

			jQuery("#home_geofence").val(home.id);
			jQuery("#home_geofence_select").val(home.name);
			jQuery("#office_geofence").val(office.id);
			jQuery("#office_geofence_select").val(office.name);
			jQuery("#user_settings").toggle();

		});
		jQuery(".modal-overflow").click(function(event) {
			if (event.target == this || jQuery(event.target).hasClass("close")) {
				if (jQuery(event.target).hasClass("save")) {
					var user = wialon.core.Session.getInstance().getCurrUser();
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
						}
					}
					user.updateCustomProperty('__app__logbook_settings', JSON.stringify(settings))
					home = settings.geofences.home;
					office = settings.geofences.office;
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


	/** Format abs time to local time
	 *
	 *  @param {int} abs_time   UNIX time UTC
	 *  @param {int} tz   timezone offset
	 *  @param {int} dst   DST
	 *  @returns {int} local time
	 */
	function get_user_time(abs_time, tz, dst) {
		if (typeof wialon == "undefined") return abs_time;
		var t = abs_time - get_local_timezone() + tz + dst;
		return t;
	}

	/** Get local timezone
	 *
	 *  @returns {int} local timezone
	 */
	function get_local_timezone() {
		var rightNow = new Date();
		var jan1 = new Date(rightNow.getFullYear(), 0, 1, 0, 0, 0, 0); // jan 1st
		var june1 = new Date(rightNow.getFullYear(), 6, 1, 0, 0, 0, 0); // june 1st
		var temp = jan1.toGMTString();
		var jan2 = new Date(temp.substring(0, temp.lastIndexOf(" ") - 1));
		temp = june1.toGMTString();
		var june2 = new Date(temp.substring(0, temp.lastIndexOf(" ") - 1));
		var std_time_offset = ((jan1 - jan2) / (1000 * 60 * 60));
		var daylight_time_offset = ((june1 - june2) / (1000 * 60 * 60));
		var dst;
		if (std_time_offset == daylight_time_offset) {
			dst = "0"; // daylight savings time is NOT observed
		} else {
			// positive is southern, negative is northern hemisphere
			var hemisphere = std_time_offset - daylight_time_offset;
			if (hemisphere >= 0) {
				std_time_offset = daylight_time_offset;
			}
			dst = "1"; // daylight savings time is observed
		}
		return parseInt(std_time_offset * 3600, 10);
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
					}
					if (mes['tc']) {
						var time = getTimeStr(parseInt(mes['tc']));
						item.closest('td').siblings('.time_change-wrap').html(time);
					}

					if (data[i]['uinput']!=textbox_items[1] && data[i].from.location_prvt && data[i].to.location_prvt) {
						data[i].fromL = data[i].from.location=data[i].from.location_prvt;
						data[i].toL = data[i].to.location=data[i].to.location_prvt;
					} else if (data[i]['uinput']==textbox_items[1] && data[i].from.location!== '---') {
						data[i].from.location_prvt=data[i].from.location;
						data[i].to.location_prvt=data[i].to.location;
						data[i].fromL = data[i].from.location='---';
						data[i].toL = data[i].to.location='---';
					}

					item.closest('td').siblings('.address-from').html(data[i].from.location);
					item.closest('td').siblings('.address-to').html(data[i].to.location);
				// error save date from input
				}
				// else if (data[i].id == tripId && !data[i]['p']) {
				// 	if (item.hasClass('message') || item.hasClass('note')) {
				// 		item.val('')
				// 			.closest('td')
				// 			.addClass('error');
				// 	}
				// }
			}
		});


	}
	/// return date str
	function getTimeStr(time, tf) {
		var format_time = (tf) ? tf : ( (en_format_time == '') ? "yyyy-MM-dd HH:mm" : en_format_time );
		return wialon.util.DateTime.formatTime(time, 0, format_time);
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
		if ((!LANG) || ($.inArray(LANG, ["en", "ru", "de", "sk", "cs"]) == -1)) {
			LANG = "en";
		}
		$.localise('lang/', {
			language: LANG
		});

		url += "/wsdk/script/wialon.js" ;
		load_script(url, init_sdk);

		$.datepicker.setDefaults($.datepicker.regional[LANG]);
		//		$.timepicker.setDefaults( $.timepicker.regional[ LANG ] );

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