/* Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.0.6
 * 
 * Requires: 1.2.2+
 */

(function($) {

var types = ['DOMMouseScroll', 'mousewheel'];

if ($.event.fixHooks) {
    for ( var i=types.length; i; ) {
        $.event.fixHooks[ types[--i] ] = $.event.mouseHooks;
    }
}

$.event.special.mousewheel = {
    setup: function() {
        if ( this.addEventListener ) {
            for ( var i=types.length; i; ) {
                this.addEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = handler;
        }
    },
    
    teardown: function() {
        if ( this.removeEventListener ) {
            for ( var i=types.length; i; ) {
                this.removeEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = null;
        }
    }
};

$.fn.extend({
    mousewheel: function(fn) {
        return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
    },
    
    unmousewheel: function(fn) {
        return this.unbind("mousewheel", fn);
    }
});


function handler(event) {
    var orgEvent = event || window.event, args = [].slice.call( arguments, 1 ), delta = 0, returnValue = true, deltaX = 0, deltaY = 0;
    event = $.event.fix(orgEvent);
    event.type = "mousewheel";
    
    // Old school scrollwheel delta
    if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta/120; }
    if ( orgEvent.detail     ) { delta = -orgEvent.detail/3; }
    
    // New school multidimensional scroll (touchpads) deltas
    deltaY = delta;
    
    // Gecko
    if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
        deltaY = 0;
        deltaX = -1*delta;
    }
    
    // Webkit
    if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
    if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }
    
    // Add event and delta to the front of the arguments
    args.unshift(event, delta, deltaX, deltaY);
    
    return ($.event.dispatch || $.event.handle).apply(this, args);
}

})(jQuery);
/**
 * jQuery TextBox
 * Version 0.1 - 18/03/2008
 * @author Dale Harvey <harveyd@gmail.com>
 *
 * A combination of a text input and a drop down
 * select box, used by
 * http://code.google.com/p/jqueryspreadsheet/
 *
 **/

(function($) {
	var llist = null;
	$.fn.textbox = function(options) {
		// Add items to the list
		var addItem = function(list, item) {
			var nowrap = "";
		  	if ($.browser && $.browser.msie) {
				nowrap = "style='white-space: normal;'";
			}
			var li = $("<li />").append($("<a href='#' " + nowrap + ">"+item+"</a>"));
			list.append(li);
		};
		
		// Set items to the list
		var setItems = function(list, items) {
			list.html("");
			if (items != null && items.length > 0) {
				var nowrap = "";
				if ($.browser && $.browser.msie) {
					nowrap = "style='white-space: normal;'";
				}
				for (var i = 0; i < items.length; i++) {
					var li = $("<li />").append($("<a href='#' " + nowrap + ">"+items[i]+"</a>"));
					list.append(li);
				}
			}
		};	
			
		$.fn.textbox.defaults = {
			items:      [],     // Default list
			onSelect:   null,   // Callback for item selected
			onChange:   null,    // Callback for text changed
			minWidth: 140
		};
		
		// default options used on initialisation
		// and arguments used on later calls
		var opts = $.extend({}, $.fn.textbox.defaults, options);
		var args = arguments;	
		
		/**
		 * Entry point
		 */   
		return this.each(function() {
			// Initialisation
			if(typeof $.data(this,"textbox") == "undefined") {
				var $t   = $(this);
				var height = this.offsetHeight;
				var width  = this.offsetWidth;				
			
				var selected = false;
				
				// The drop down list
				var list = $("<ul class='textboxlist' />").insertAfter($t.parent()).height(0).css("min-width", (width ? width + 19 : opts['minWidth']) + "px").mousedown(function(e) {
					if (e.target.tagName == "A" || e.target.tagName == "a") {
						list.toggle();
						$t.val($(e.target).text());
						$t.change();
							
						if(typeof opts.onSelect == "function")
							 opts.onSelect($(e.target).text());
					}
					return false;
				});			
				
				var arrow = $("<select class='textboxarrow' size='1'><option value='' /></select>").insertAfter($t).mousedown(function(e) {				
					list.find("a").css("font-size", $t.css("font-size"));
					if (llist !== null) {
						llist.hide();
					}

					var offset = $($t).position();
					$(list).css("left", offset.left);
					$(list).css("top", parseInt(offset.top) + parseInt($($t).height()));
						
					llist = list;
					$(this).attr("disabled", true);
					list.height(160);										
					list.toggle();					
					
					if (!list.attr("display") == "none") {
						list.attr("display", "inline");
					}
					window.setTimeout(enableSelect, 100);
					return false;
				});

				$("#table-wrap").bind('mousewheel', function () {
					if (llist) {
						$(llist).hide();
					}
				});
				
				arrow.mouseover(function() {
					$t.parent().addClass("textboxcontainerhover");
					return false;
				}).mouseout(function(){
					$t.parent().removeClass("textboxcontainerhover");
					return false;
				});
				
				$t.mouseover(function() {
					$t.parent().addClass("textboxcontainerhover");
					return false;
				}).mouseout(function(){
					$t.parent().removeClass("textboxcontainerhover");
					return false;
				});
					
				$t.click(function() {
					// Make sure the text is selected so users can type to overwrite current text
					if (!selected) {
						this.select();
						selected = true;
					}
				}).focus(function() {
					var val = $(this).val();
					this.select();
						
					// Run callback if the user has typed something new
					$(this).bind('blur',function() {						
						if(typeof opts.onChange == "function" && $(this).val() != val && $(this).val() != "") {
							opts.onChange($(this).val());
						}
					}).bind('keyup',function(e) {
						// When the user presses return, lose focus
						if(e.keyCode == 13) {
							$(this).blur();
							list.hide();
						}
					});
				});
				
				// Store ths list so it can be added to in later calls
				$.data(this,"textbox",{list:list});
				
				// Setup the initial list
				$.each(opts.items,function(i) {
					addItem(list,this);
				});
				
				$('body').mousedown(function(e) {
					if (e.target.id != $t.attr("id")) {
						list.hide();
					}
				});
				
				var enableSelect = function() {
					arrow.removeAttr("disabled");
				};
			}
			
			// The plugin has already been created on this object
			// must be an external call to modify
			else if(args[0] == "add")
				addItem($.data(this,"textbox").list,args[1]);
			else if(args[0] == "set")
				setItems($.data(this,"textbox").list,args[1]);
		});
	};

})(jQuery);
