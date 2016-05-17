(function( $ ) {
	$.fn.dividedByDayTabs = function (data, renders) {

		$("#tabstat").show();
		$("#pagestat").hide();
		$("#nrowonpage").hide();

		var cData = data;
		var cTable = $(this);
		var cPage = 0;
		var $pNumWrap = $('#pcontrol');
		var MaxBtnPagin = getLengthVisibleList();

		cTable.off("refresh").on("refresh", function (event, data) {
			cData = data['data'];
			changePage(cPage, 1);
		});

		$pNumWrap.on("click", "input", function() {
			changePage(+$(this).data("index"));
		});

		$("#tabstat").off("change", "select").on("change", "select", function() {
			changePage(+$(this).val());
		});

		// change page to npage
		function changePage(npage, force) {
			if (force || (npage >= 0 && npage < getTabsCount() && npage != cPage)) {
				cPage = npage;
				renderRows();
				renderTabs();
			}
		}

        var resizeTimeout;
        $(window).on('resize', function(){
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout  = setTimeout(function(){
                var possibleNumber = getLengthVisibleList();
                if (possibleNumber != MaxBtnPagin) {
                    MaxBtnPagin = possibleNumber;
                    renderTabs();
                }
            },100);
        });

		function getTabsCount () {
			return cData.tabs.length;
		}

		function renderRows() {
			var rows = cData.tabs[cPage];
			renders(1, rows.trips, rows);
		}

		var cPrev = $('#prev');
		var cNext = $('#next');
		var cEnd = $('#last');
		var cStart = $('#top');

		// add rows
		renderRows();
		renderTabs();

		cPrev.addClass('disabled');
		cStart.addClass('disabled');

		// prev tab
		cPrev.off("click").click(function (event) {
			event.preventDefault();
			if (!cPrev.hasClass('disabled')) {
				cPage--;
				renderTabs()
				renderRows();
			}
		});

		// next tab
		cNext.off("click").click(function (evt) {
			evt.preventDefault();
			if (!cNext.hasClass('disabled')) {
				cPage++;
				renderTabs();
				renderRows();
			}
		});

		// last tab
		cEnd.off("click").click(function (evt) {
			evt.preventDefault()
			if (!cEnd.hasClass('disabled')) {
				// last tab
				cPage = getTabsCount() - 1;
				// re-render
				renderTabs();
				renderRows();
			}
		});

		// first tab
		cStart.off("click").click(function (evt) {
			evt.preventDefault()
			if (!cStart.hasClass('disabled')) {
				// first tab
				cPage = 0;
				// re-renders
				renderTabs();
				renderRows();
			}
		});

		// enable/disable tabs
		function checkTabs() {
			if (cPage == 0) {
				// first tab
				cPrev.addClass('disabled');
				cStart.addClass('disabled');
			} else {
				cPrev.removeClass('disabled');
				cStart.removeClass('disabled');
			}

			if (cPage + 1 >= getTabsCount()) {
				// last tab
				cNext.addClass('disabled');
				cEnd.addClass('disabled');
			} else {
				cNext.removeClass('disabled');
				cEnd.removeClass('disabled');
			}
		}

        function getLengthVisibleList(){
            var itemWidth = 100;
            var W = ($('.table-footer').width() || $(document).width()) - 230;
            return Math.floor(W/itemWidth) - 4;
        }

		function renderTabs() {
			if (!$pNumWrap.length) {
				return;
			}
			var html = '';
			if (getTabsCount() <= MaxBtnPagin) {
				for (var i = 0; i < getTabsCount(); i++) {
					html += '<input data-index="' + i + '" type="button" class="tab btn number ' + (i == cPage ? 'active' : '' ) + '" value="' + cData.tabs[i].date + '">';
					renderSelector();
				}
			} else {
				html = '<input data-index="' + cPage + '" type="button" class="tab btn number active" value="' + cData.tabs[cPage].date + '">';
				renderSelector(1);
			}

			$pNumWrap.html(html);
			checkTabs();
		}

		function renderSelector(show) {
			var html = '';
			if (show) {
				html = '<select class="tab-selector">';
				for (var i = 0; i < getTabsCount(); i++) {
					html += '<option ' + (i == cPage ? 'selected' : '' ) + ' value="' + i + '">' + cData.tabs[i].date + '</option>';
				}
				html += '</select>';
			}
			$("#tabstat").html(html);
		}
	}
}) ( jQuery );
