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

(function( $ , _ ) {
	/// Global units cache
	var units = {};
	/// Global current trips
	var ctrips = [];
	/// Messages of type event
	var cmessages = [];
	/// Wialon messages loader
	var mloader = null;
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
	var resources = [];
	/// Time format
	var en_format_time = "Y-MM-dd HH:mm";
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
	var get_html_var = _.memoize(function (name) {
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
		script.setAttribute("type","text/javascript");
		script.setAttribute("charset","UTF-8");
		script.setAttribute("src", src);
		if (callback && typeof callback === "function") {
			var id = wrap_callback(callback);
			if (ie()) {
				script.onreadystatechange = function () {
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
		for (var i=0, len=items.length; i<len; i++) {
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

		var spec_resource = {itemsType: "avl_resource", propName: "sys_name", propValueMask: "*",  sortType: "sys_name"};
		var flags_resource = wialon.item.Item.dataFlag.base | wialon.item.Item.dataFlag.messages | wialon.item.Resource.dataFlag.drivers;
		wialon.core.Session.getInstance().searchItems(spec_resource, true, flags_resource, 0, 0, function (code, data) {
			if (code === 0 && data && data.items && data.items.length > 0) {
				for (var i=0, len=data.items.length; i<len; i++) {
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
			
			var spec_unit = {itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name"};
			var flags_unit = wialon.item.Item.dataFlag.base | wialon.item.Unit.dataFlag.driverCode;
			wialon.core.Session.getInstance().searchItems(spec_unit, true, flags_unit, 0, 0, function (code, data) {
				$("#table-wrap").activity(false);
				if (code || !data) {
					alert($.localise.tr("List of units empty."));
				} else if (!data.items || data.items.length < 1) {
					alert($.localise.tr("List of units empty."));
				} else {
					fill_units_select(data.items);
					$("#execute-btn").removeAttr("disabled");
				}
			});
		});
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
		wialon.core.Session.getInstance().initSession(url, undefined, 0x800, undefined);
		wialon.core.Session.getInstance().duplicate(get_html_var("sid"), "", true, login);
		mloader = wialon.core.Session.getInstance().getMessagesLoader();
	}
	///
	function ischeck (val) {
		return (val === null || val === undefined) ? false : true;
	}
	///
	var get_driver_by_id = (function () {
		var drivers = {};
		return function (pdid) {
			if (!ischeck(pdid)) {
				return null;
			}	
			if (_.isEmpty(drivers)) {
				for (var i=0, len=resources.length; i<len; i++) {
					var res = resources[i];
					if (!res) {
						continue;
					}
					var rid = res.getId();
					var ds = res.getDrivers();
					for (var did in ds) {
						var d = ds[did];
						drivers[rid + "_" + d['id']] = d;
					}
				}
			}
			return drivers[pdid];
		}
	})();	
	/// Fetches time from the user input
	function getTimeFromInput () {
		var date_from = $("#date-from").datetimepicker( "getDate" );
		var date_to = $("#date-to").datetimepicker( "getDate" );
		if (!date_from || !date_to) {
			return [];
		}

		var time_from = Math.round(date_from.getTime() / 1000);
		var time_to = Math.round(date_to.getTime() / 1000);
		return [time_from, time_to];
	}
	/// Fetches unit from the user input
	function getUnitFromInput () {
		var unit_id = $("#units-select").val();
		return units[unit_id];
	}
	/// Lays table update
	var refresh_drivers = (function () {
		var timeout = null;
		return function (unit, times, trips) {
			if (timeout !== null)
				clearTimeout(timeout);
			timeout = setTimeout(function () {
				load_drivers (unit, times, trips);
				clearTimeout(timeout);
				timeout = null;
			}, 1000);
		};
	})();
	///
	function execute (event) {
		var unit = getUnitFromInput ();
		if (!unit) {
			alert($.localise.tr("Please select unit."));
			return;
		}
		cunit = unit;
		
		disableui();
		var times = getTimeFromInput();
		if (!times) {
			alert($.localise.tr("Please select time interval."));
			return;
		}
		ctimes = times; // stores current worker time in global variable

		mloader.loadInterval(unit.getId(), times[0], times[1],  wialon.item.Item.messageFlag.typeUnitData, wialon.item.Item.messageFlag.typeMask, 0xFFFFFFFF, qx.lang.Function.bind(function (unit, times, code, messages) {
			if (code === 0 && messages) {
				load_trips(unit, times);
			} else {
				undisableui();
				disabletableui();
				alert($.localise.tr("No data for selected interval."));
			}
		}, this, unit, times));
	}
	/// Main function for unloading trips
	function load_trips (unit, times) {		
		ctrips = []; cmessages = []; // update global variables
		unit.getTrips(times[0], times[1], 1, qx.lang.Function.bind(function (times, unit, code, trips) {
			if (code || (!trips) || (trips.length < 1)) {
				$("#table-wrap").activity(false);
				$("#execute-btn").removeAttr("disabled");
				alert($.localise.tr("No data for selected interval."));
				return;
			}
			ctrips = trips; // stores current worker trips in global variable
			ttimes = [trips[0]['from']['t'], trips[trips.length-1]['to']['t']];
		
			var barrier = (trips.length < 200) ? trips.length : 200; 
			for (var i=0, len=trips.length; i<len; i+=barrier) {
				var temp_trips = trips.slice(i, i+barrier);
				
				var coords = []; 
				for (var j=0, tlen=temp_trips.length; j<tlen; j++) {
					var trip = temp_trips[j];
					if (!trip) {
						continue;
					} 
					if (trip.from['p']) {
						coords.push({lon: trip.from.p['x'], lat: trip.from.p['y']});
					} else {
						coords.push({lon: 0, lat: 0});
					}
					if (trip.to['p']) {
						coords.push({lon: trip.to.p['x'], lat: trip.to.p['y']});
					} else {
						coords.push({lon: 0, lat: 0});
					}
				}
				if (coords) {
					// Fetches initial and final locations by coordinates for trips
					wialon.util.Gis.getLocations(coords, qx.lang.Function.bind(function (trips, times, code, locations) {
						if (code === 0) {
							var index = 0;
							for (var i=0, len=trips.length; i<len; i++) {
								var trip = trips[i];
								if (!trip) {
									continue;
								}

								if ((!trip.from['location']) && trip.from['p']) {
									trip.from['location'] = locations[index++];
								}
								if ((!trip.to['location']) && trip.to['p']) {
									trip.to['location'] = locations[index++];
								}
							}
						}
						refresh_drivers(unit, times, ctrips);
					}, this, temp_trips, ttimes));
				} else {
					refresh_drivers(unit, ttimes, ctrips);
				}
			}
		}, this, times, unit));
	}
	///
	function part_dh_by_tm (dh) {
		var result = [];
		if (dh.length < 1) {
			return result;
		}

		for (var i=0, len=dh.length; i<len; i++) {
			var tempb = dh[i];
			if (tempb['u'] === 0) {
				continue;
			}

			var start = tempb['t'], end = 0xFFFFFFFF;			
			var next = i + 1;
			if (next < len) {
				var temp = dh[next];
				if (temp['u'] === 0) {
					i++;
				}
				end = temp['t'];				
			}			
			result.push({tb: start, tub: end, did: tempb['did']});
		}
		return result;
	}
	///
	function load_drivers (unit, times, trips) {
		wialon.core.Remote.getInstance().startBatch("load_drivers");
		
		gdh = [];
		for (var i=0, len=resources.length; i<len; i++) {
			var resource = resources[i];
			if (!resource) {
				continue;
			}

			resource.getDriverBindings(unit, null, times[0], times[1], qx.lang.Function.bind(function (resource, code, data) {
				if (code === 0 && data) {
					var rid = resource.getId();
					for (var did in data) {
						var hdriver = data[did];
						for (var j=0, dlen=hdriver.length; j<dlen; j++) {
							hdriver[j]['did'] = rid + "_" + did;
							gdh.push(hdriver[j]);
						}					
					}
				} 
			}, this, resource));
		}

		wialon.core.Remote.getInstance().finishBatch(qx.lang.Function.bind(function (unit, times, trips, code, combinedCode) {
			gdh = _.sortBy(gdh, function (history) {
				return history['t'];
			});			
			var partdh = part_dh_by_tm(gdh);
			var tlen = trips.length, temp = 0;
			for (var i=0, len=partdh.length; i<len; i++) {
				var pdh = partdh[i];
				for (var j=temp; j<tlen; j++) {
					var trip = trips[j];
					if ((pdh['tb'] < trip['to']['t']) && (pdh['tub'] > trip['from']['t'])) {
						temp = j+1;
						trip['did'] = pdh['did'];
					}
				}
				if (temp === tlen) {
					break;
				}
			}
			load_messages(unit, times, trips);
		}, this, unit, times, trips), "load_drivers");
	}
	/// Main function for unloading messages about unit events
	function load_messages (unit, times, trips, isrefresh) {
		disableui();
		cmessages = []; // update global variable
		textbox_items = ["Business", "Personal"];
		// Unload previous loaded messages
		mloader.unload(qx.lang.Function.bind(function (unit, times, trips, code) {
			if (code !== 0) {
				return;
			}
			// Load messages for given time interval
			mloader.loadInterval(unit.getId(), times[0], times[1],
								 wialon.item.Item.messageFlag.typeUnitEvent, wialon.item.Item.messageFlag.typeMask,
								 0xFFFFFFFF, qx.lang.Function.bind(function (trips, code, messages) {
									 if ((code === 0) && messages) {
										 messages = messages['messages'];
										 // Fetches message containt type of trip
										 for (var i=0, len=messages.length; i<len; i++) {
											 var message = messages[i];
											 if (message && message['p'] && ischeck(message['p']['ui_text'])) {
												 message['index'] = i;
												 cmessages.push(message);
											 }											
										 }

										 var tlen = trips.length;
										 var temp = 0;
										 // Partition messages on trips (cmessages and trips sort ordered by time)
										 for (var i=0, len=cmessages.length; i<len; i++) {
											 var mes = cmessages[i];
											 for (var j=temp; j<tlen; j++) {
												 var trip = trips[j];
												 if ((mes['t'] >= trip['from']['t']) && (mes['t'] <= trip['to']['t'])) {
													 temp = j+1;
													 trip['message'] = mes;
													 trip['uniput'] = null;
													 trip['unote'] = null;
													 if (mes['p'] && mes['p']['ui_text']) {
														 textbox_items.push(mes['p']['ui_text']);
													 }
													 break;
												 }
											 }
											 if (temp === tlen) {
												 break;
											 }
										 }
									 }
									 textbox_items = _.uniq(textbox_items);
									 /// Create or update main table
									 if (!isrefresh) {
										 $("#paginated-table").dividedByPages(trips, trips_to_table);
									 } else {
										 $("#paginated-table").trigger("refresh", {data: ctrips});
									 }
									 undisableui();
								 }, this, trips));
		}, this, unit, times, trips));
	}
	/// Check digit and prepend zero if required
	function add_zero (i) {
		return (i < 10) ? (i = "0" + i) : i;
	}
	/// Format time value
	function get_time_string (time, format) {
		if (!format) {
			format = "HH:mm:ss";
		}

		var result = format;
		var hours = parseInt(time / 3600);
		var mins = parseInt( (time - hours * 3600) / 60 );
		var secs = parseInt(time - hours * 3600 - mins * 60);
		var tokens = {"HH": add_zero(hours),
					  "mm": add_zero(mins),
					  "ss": add_zero(secs)
					 };
		for (var i in tokens)
			result = result.replace(i, tokens[i]);
		return result;
	}
	/// Create html table for trips data
	function trips_to_table (sindex, trips) {
		//disableui();
		for (var i=0, len=trips.length; i<len; i++) {
			var trip = trips[i];
			if (!trip) {
				continue;
			}
			sindex = _trip_to_table(sindex, trip);
		}
		//undisableui();
	}
	/// Callback for apply button
	function apply (event) {
		if (!cunit) {
			return null;
		}

		disableui();
		wialon.core.Remote.getInstance().startBatch("apply_message");

		for (var i=0, len=ctrips.length; i<len; i++) {
			var trip = ctrips[i];
			if ((!trip) || ( (!ischeck(trip['uinput'])) && (!ischeck(trip['unote'])) )) {
				continue;
			}

			if (trip['unote'] && (!ischeck(trip['uinput'])) && (!trip['message'])) {
				trip['unote'] = "";
				continue;
			}

			if (!ischeck(trip['uinput'])) {
				if (trip['message']) {
					trip['uinput'] = trip['message']['p']['ui_text'];
				} else {
					trip['uinput'] = "";
				}
			}

			var date = null;
			var note = "";
			if (trip['message']) {
				date = trip['message']['t'];
				if (ischeck(trip['unote'])) {
					note = trip['unote']
				} else {
					note = trip['message']['p']['nt'] ? trip['message']['p']['nt'] : "";
				}
			} else {
				date = Math.round((trip['from']['t'] + trip['to']['t']) / 2);
				note = ischeck(trip['unote']) ? trip['unote'] : "";
			}

			var time = wialon.core.Session.getInstance().getServerTime();
			var user = wialon.core.Session.getInstance().getCurrUser();
			var oparams = {
				un: user.getName(), // user name
				tc: time // unix time changes
			}

			if (note)
				oparams['nt'] = note; // user note
			// Deleted previos messages
			cunit.registryStatusEvent(date, trip['uinput'], oparams, qx.lang.Function.bind(function (trip, code) {
				if (code === 0 && trip['message']) {
					mloader.deleteMessage(trip['message']['index'], function (code) {
						if (code === 0) {
							trip['uinput'] = null;
							trip['unote'] = null;
							refresh();
						}
					});
					refresh();
				}
			}, this, trip));
		}

		wialon.core.Remote.getInstance().finishBatch(function (code, combinedCode) {
			refresh();
		}, "apply_message");
	}
	/// Lays table update
	var refresh = (function () {
		var timeout = null;
		return function () {
			if (timeout !== null)
				clearTimeout(timeout);
			timeout = setTimeout(function () {
				load_messages(cunit, ctimes, ctrips, true);
				clearTimeout(timeout);
				timeout = null;
			}, 1000);
		};
	})();
	/// Get status text from user input or status message
	function get_trip_mtext (trip) {
		var text = "";
		if (trip['uinput']) {
			text = trip['uinput'];
		} else if (trip['message']) {
			text = trip['message']['p']['ui_text']
		}
		return text;
	}
	/// Get note text from user input or status message
	function get_trip_ntext (trip) {
		var text = "";
		if (trip['unote']) {
			text = trip['unote'];
		} else if (trip['message']) {
			text = trip['message']['p']['nt']
		}
		return text;
	}
	/// The auxiliary function for transform trip in table
	function _trip_to_table (sindex, trip) {
		var row = trip_to_row(sindex++, trip);
		$("#paginated-table").children("tbody").append(row);
		var text = get_trip_mtext (trip);

		var imessage = $("#trip_"+(sindex-1)).find("input.message");
		$(imessage).val(text);
		text =  get_trip_ntext (trip);
		$("#trip_"+(sindex-1)).find("input.note").val(text);
		$(imessage).textbox({
			items: textbox_items
		});
		return sindex;
	}
	/// Fetches data from trip for represent in table
	function trip_to_data (id, trip) {
		var to = trip['to'];
		var from = trip['from'];
		if (!to || !from) {
			return null;
		}

		var driver = get_driver_by_id(trip['did']);	
		var data = {
			id: "trip_"+id,
			index: id + 1,
			time_from: wialon.util.DateTime.formatTime(from['t'], 0, en_format_time),
			time_to: wialon.util.DateTime.formatTime(to['t'], 0, en_format_time),
			duration: get_time_string(to['t'] - from['t']),
			from:  (from['location'] ? from['location'] : '---'),
			to: (to['location'] ? to['location'] : '---'),
			driver: (driver ? driver['n'] : '---'),
			uname: "---",
			time_change: "---"
		};

		var message = trip['message'];
		if (message) {
			var time = parseInt(message['p']['tc']);
			var tdata = {
				uname: (message['p']['un'] ? message['p']['un'] : '---'),
				time_change: (message['p']['tc'] ? wialon.util.DateTime.formatTime(time, 0, en_format_time) : '---')
			};
			$.extend(data, tdata);
		}

		return data;
	}
	/// The auxiliary function for transform trip in row table
	function trip_to_row (id, trip) {
		var data = trip_to_data(id, trip);
		var template = _.template($("#row").html());
		return template(data);
	}
	/// Disabled ui
	function disableui () {
		try { $("#table-wrap").activity(); } catch (e) {} 
		$("#execute-btn").attr("disabled", "disabled");
		disabletableui();
	}
	/// Undisabled ui
	function undisableui () {
		try { $("#table-wrap").activity(false); } catch (e) {} 
		$("#execute-btn").removeAttr("disabled");
		undisabletableui();
	}
	/// Disabled table ui
	function disabletableui () {
		$("#table-instruments").hide();
		$("#paginated-table").hide();
	}
	/// Undisabled table ui
	function undisabletableui () {
		$("#table-instruments").show();
		$("#paginated-table").show();
	};
	/// Callback
	function change_nrowonpage () {
		var table = $("#paginated-table");
		hresize(null, $(this).val());
		table.trigger("changerowonpage", $(this).val());		
	}
	/// Callback
	function change_npage (event) {
		if (event.which === 13) {
			var table = $("#paginated-table");
			table.trigger("changepage", $(this).val());
		}
	}
	///
	function ltranlate () {
		$("#unit-text-span").html($.localise.tr("Unit"));
		$("#from-text-span").html($.localise.tr("From"));
		$("#to-text-span").html($.localise.tr("To"));
		$("#execute-btn").val($.localise.tr("Generate"));
		
		$("#th-text-beginning").html($.localise.tr("Beginning"));
		$("#th-text-end").html($.localise.tr("End"));
		$("#th-text-duration").html($.localise.tr("Duration"));
		$("#th-text-init-location").html($.localise.tr("Initial location"));
		$("#th-text-final-location").html($.localise.tr("Final location"));
		$("#th-text-driver").html($.localise.tr("Driver"));
		$("#th-text-user").html($.localise.tr("User"));
		$("#th-text-last-changes").html($.localise.tr("Last changes"));
		$("#th-span-trip-status").html($.localise.tr("Trip status"));
		$("#th-text-notes").html($.localise.tr("Notes"));
		
		$("#page").html($.localise.tr("Page&nbsp;"));
		$("#of").html($.localise.tr("&nbsp;of&nbsp;"));
		
		$("#apply-btn").val($.localise.tr("Apply"));
		
		$("#logo-title").html($.localise.tr("Driving Logbook"));
		
		$.datepicker.regional['ru'] = {
                closeText: 'Закрыть',
                prevText: '&#x3c;Пред',
                nextText: 'След&#x3e;',
                currentText: 'Сегодня',
                monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь',
                'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
                monthNamesShort: ['Янв','Фев','Мар','Апр','Май','Июн',
                'Июл','Авг','Сен','Окт','Ноя','Дек'],
                dayNames: ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'],
                dayNamesShort: ['вск','пнд','втр','срд','чтв','птн','сбт'],
                dayNamesMin: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
                weekHeader: 'Не',
                dateFormat: 'dd.mm.yy',
                firstDay: 1,
                isRTL: false,
                showMonthAfterYear: false,
                yearSuffix: ''};
		
		$.timepicker.regional['ru'] = {
			timeOnlyTitle: 'Выберите время',
			timeText: 'Время',
			hourText: 'Часы',
			minuteText: 'Минуты',
			secondText: 'Секунды',
			millisecText: 'Миллисекунды',
			timezoneText: 'Часовой пояс',
			currentText: 'Сейчас',
			closeText: 'Закрыть',
			timeFormat: 'HH:mm',
			amNames: ['AM', 'A'],
			pmNames: ['PM', 'P'],
			isRTL: false
		};
	}
	function hresize (e, count) {
		var isless = false, wheight = $(window).height();
		if (e === null) {
			var nheight = count * 49; // where 39 height of on row in table
			if ((nheight + 160) > wheight) {
				isless = true;
			} else {
				$("#table-wrap").height(nheight);
			}				
		}

		if (e !== null || isless) {
			$("#table-wrap").height(wheight - 160);
		}
	}
	/// A function to execute after the DOM is ready.
	$(document).ready(function () {
		disabletableui();
		var url = get_html_var("baseUrl");
		if (!url) {
			url = get_html_var("hostUrl");
		}
		if (!url) {
			return null;
		}
		
		LANG = get_html_var("lang");
		if ((!LANG) || ($.inArray(LANG, ["en", "ru"]) == -1))
			LANG = "en"
		$.localise('lang/', {language: LANG});
		ltranlate();
		
		url += "/wsdk/script/wialon.js" ;
		load_script(url, init_sdk);

		$.datepicker.setDefaults( $.datepicker.regional[ LANG ] );
		$.timepicker.setDefaults( $.timepicker.regional[ LANG ] );

		$("#date-from").datetimepicker();
		$("#date-to").datetimepicker();

		var temp = new Date();
		temp.setHours(0);
		temp.setMinutes(0);
		$("#date-from").datetimepicker("setDate", temp);
		temp.setHours(23);
		temp.setMinutes(59);
		$("#date-to").datetimepicker("setDate", temp);

		$("#execute-btn").click(execute);
		$("#nrowonpage").change(change_nrowonpage);
		$("#page_selector").keypress(change_npage);

		$(window).resize(hresize);

		$("#all-type-for-trip").click(function () {
			var text = $(this).children("option:selected").text();
			for (var i=0, len=ctrips.length; i<len; i++) {
				var trip = ctrips[i];
				if (!trip) {
					continue;
				}
				trip['uinput'] = text;
			}
			$(".message").val(text);
		});

		$("#apply-btn").click(apply);

		$("body").delegate(".message", "input", function () {
			var row = $(this).parents("tr");
			var id = $(row).attr('id');
			if (!id) {
				return;
			}

			var index = id.split("_")[1];
			var trip = ctrips[index];
			if (trip) {
				trip['uinput'] = $(this).val();
			}
		});

		$("body").delegate(".message", "change", function () {
			var row = $(this).parents("tr");
			var id = $(row).attr('id');
			if (!id) {
				return;
			}

			var index = id.split("_")[1];
			var trip = ctrips[index];
			if (trip) {
				trip['uinput'] = $(this).val();
			}
		});

		$("body").delegate(".note", "input", function () {
			var row = $(this).parents("tr");
			var id = $(row).attr('id');
			if (!id) {
				return;
			}

			var index = id.split("_")[1];
			var trip = ctrips[index];
			if (trip) {
				trip['unote'] = $(this).val();
			}
		});

		hresize(null);
		$("#units-select").change(disabletableui);

		$("#print-btn").click(function () {
			var windowUrl = 'about:blank';
			var uniqueName = new Date();
			var windowName = 'Print' + uniqueName.getTime();

			var WinPrint= window.open(windowUrl, "", 'left=300,top=300,right=500,bottom=500,width=1000,height=500');

			var t = underi18n.MessageFactory(TRANSLATIONS);
			var template = _.template(underi18n.template($("#print").html(), t));

			var ttrips = [];
			for (var i=0, len=ctrips.length; i<len; i++) {
				var trip = ctrips[i];
				if (!trip) {
					continue;
				}
				var data = trip_to_data(i, trip);
				if (data) {
					var mtext = get_trip_mtext(trip);
					var note = get_trip_ntext(trip);

					data['message'] = mtext ? mtext : "";
					data['note'] = note ? note : "";
					ttrips.push(data);
				}
			}

			var list = "<% _.each(trips, function(data) { %> " + $("#print-row").html() + " <% }); %>";
			var tcontent = _.template(list, {trips: ttrips});

			var ttimes = getTimeFromInput();			
			var content = template({content: tcontent,
									uname: cunit.getName(),
									tfrom: wialon.util.DateTime.formatTime(ttimes[0], 0, en_format_time),
									tto: wialon.util.DateTime.formatTime(ttimes[1], 0, en_format_time)
								   });
			WinPrint.document.write(content);

			WinPrint.document.close();
			WinPrint.focus();
			WinPrint.print();
		});
	});
}) ( jQuery , _);
