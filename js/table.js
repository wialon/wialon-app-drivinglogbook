(function( $ ) {
	$.fn.dividedByPages = function (data, renders) {
		var maxRows = parseInt($("#nrowonpage").val());
		
		var cData = data;
		var cTable = $(this);
		var cRowCount = data.length;
		var cPage = 1;
        var $pNumWrap = $('#pcontrol');
        var MaxBtnPagin = getLengthVisibleList();

		
		cTable.off("refresh");
		cTable.on("refresh", function (event, data) {
			cData = data['data'];
			$(this).trigger("changepage", cPage);
		});
        $pNumWrap.on('click', 'input', function(){
            if (parseInt( $(this).val() )) {
                cTable.trigger("changepage", parseInt( $(this).val() ))
            }
        });
		cTable.off("changepage");
		cTable.on("changepage", function (event, npage) {
			var page = parseInt(npage);
			var count = getCountPages();
			if ($.isNumeric(npage) && (npage > 0) && (npage <= count)) {
				cPage = page + 1;
				prev(null, true);

                renderList(cPage);
			} else {
				$("#page_selector").val(cPage);	
			}
		});		
		
		cTable.off("changerowonpage");
		cTable.on("changerowonpage", function (event, nrow) {
			if (maxRows !== parseInt(nrow)) {
				maxRows = parseInt(nrow);
				var pcount = getCountPages();
				cTable.trigger("changepage", cPage < pcount? cPage : pcount);
			}
		});
        var resizeTimeout;
        $(window).on('resize', function(){
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout  = setTimeout(function(){
                var possibleNumber = getLengthVisibleList();
                if (possibleNumber != MaxBtnPagin) {
                    MaxBtnPagin = possibleNumber;
                    renderList(cPage);
                }
            },100);
        });

        function updatePrevNextCount(cPage, count){
            if ( cPage > 1 ) {
                $("#prev-page").html( cPage - 1 ).addClass('visible');
            } else {
                $("#prev-page").html('').removeClass('visible');
            }
            if ( cPage < count ) {
                $("#next-page").html( cPage + 1 ).addClass('visible');
            } else {
                $("#next-page").html('').removeClass('visible');
            }
        }

		function getCountPages () {
			var count = parseInt(cRowCount / maxRows);
			if ((cRowCount % maxRows) !== 0 || count === 0)
				count++;
			return count;
		}
		
		function added (rows, sindex) {
			cTable.children("tbody").empty();
			renders(sindex, rows);
			updatePageState();
		}
		
		function updatePageState () {
			var ifrom = cPage * maxRows - maxRows + 1;
			var ito = cPage * maxRows;
			if (ito > cRowCount)
				ito = cRowCount;
            var pages = Math.ceil(cRowCount / maxRows);

            var str = '%d pages_1'; // for one page
            if ( pages > 1 && pages < 5 ) {
                str = '%d pages_2';
            } else if (pages > 4) {
                str = '%d pages_5';
            }

            var text = wialon.util.String.sprintf($.localise.tr(str), pages);
			$("#pagestat").text(text);
			$("#page_selector").val(parseInt(ifrom / maxRows + 1));	
			$("#cpages").text(getCountPages());

            updatePrevNextCount(cPage, pages);
            renderList(cPage);
		}

		var cPrev = $('#prev');
		var cNext = $('#next');
		var cEnd = $('#last');
		var cStart = $('#top');

		cNext.removeClass('disabled');
		cEnd.removeClass('disabled');	

		if (cRowCount < maxRows) {
			cPrev.addClass('disabled');
			cNext.addClass('disabled');
			cEnd.addClass('disabled');
			cStart.addClass('disabled');
			added(data, 0);
			return;
		} else {
			added(cData.slice(0, maxRows), 0);
		}
		
		cPrev.addClass('disabled');
		cStart.addClass('disabled');	
		
		function prev (event, isforcibly) {
			if (!isforcibly)
				if (cPrev.hasClass('disabled'))
					return false;
			
			var ndata = null;
			var prevPage = cPage - 1;
			var sindex = 0; 
			if (cPage > 1) {
				sindex = (prevPage-1)*maxRows;
				ndata = cData.slice(sindex, prevPage*maxRows);
			} else {
				sindex = prevPage*maxRows;
				ndata = cData.slice(sindex, cPage*maxRows);
			}
			
			if (prevPage < 2) {		
				cPrev.addClass('disabled');
				cStart.addClass('disabled');
				cPage = 1;
			} else {
				cPrev.removeClass('disabled');
				cStart.removeClass('disabled');
				cPage = prevPage;
			}
			
			var count = getCountPages();
			if (prevPage < count) {
				cNext.removeClass('disabled');
				cEnd.removeClass('disabled');
			} else {
				cNext.addClass('disabled');
				cEnd.addClass('disabled');
			}

			added(ndata, sindex);
			return false;
		}
		cPrev.off("click");
		cPrev.click(prev);

		function next () {	
			if (cNext.hasClass('disabled'))
				return false;

			var nextPage = cPage + 1;	
			var sindex = cPage*maxRows; 
			var ndata = cData.slice(sindex, nextPage*maxRows);
			var nnlen = cData.length - nextPage*maxRows;
			if (ndata.length < maxRows || nnlen < 1) {
				cNext.addClass('disabled');
				cEnd.addClass('disabled');
			}
			
			cPrev.removeClass('disabled');
			cStart.removeClass('disabled');
			cPage = nextPage;
			
			added(ndata, sindex);
			return false;
		}	
		cNext.off("click");
		cNext.click(next);

		function end () {
			if (cEnd.hasClass('disabled'))
				return false;
			
			cPage = parseInt(cRowCount / maxRows) + 1;
			var sindex = maxRows*(cPage-1);
			var ndata = cData.slice(sindex);
			if (ndata.length < 1) {
				sindex = maxRows*(cPage-2); 
				ndata = cData.slice(sindex);
				cPage--;
			}		
			
			cNext.addClass('disabled');
			cPrev.removeClass('disabled');
			cEnd.addClass('disabled');	
			cStart.removeClass('disabled');
			
			added(ndata, sindex);
			return false;
		}
		cEnd.off("click");
		cEnd.click(end);

		function start () {
			if (cStart.hasClass('disabled'))
				return false;
			
			cPage = 1;		
			cNext.removeClass('disabled');
			cPrev.addClass('disabled');
			cEnd.removeClass('disabled');
			cStart.addClass('disabled');		
			
			added(cData.slice(0, maxRows), 0);
			return false;
		}

        function getLengthVisibleList(){
            var itemWidth = 43;
            var W = $('.table-footer').width() - 80;//$('#pagestat').closest('.pgroup').width();
            return Math.floor(W/itemWidth) - 4;
        }

        function renderList(page){
            if (!$pNumWrap.length) return;
            var all = getCountPages();
            var tpl = getListPagination();

            var html = '';
            var startIndex = getFirstOfPage(page, tpl);

            for ( var i = startIndex; i < tpl.length && i < startIndex + MaxBtnPagin; i++ ) {
                if ( isNaN(tpl[i]) ) {
                    html += '<input type="button" class="btn number" value="...">';
                } else {
                    html += '<input type="button" class="btn number" value="'+ tpl[i] +'">';
                }
            }

            $pNumWrap.html( html );

            $pNumWrap.find('[value=' + cPage + ']').addClass('active');
        }
        function getListPagination() {
            var count = getCountPages();
            var maxVis = getLengthVisibleList();
            var tpl = [];
            var k = 1; // key for break;
            for ( var i = 1; i <= count; i++ ) {
                if ( k == maxVis ) {
                    tpl.push('...');
                    k = 1;
                }
                k++;
                tpl.push(i);
            }
            return tpl;
        }

        function getFirstOfPage(page ,tpl){

            for (var i = 0; i < tpl.length; i++) {
                if (tpl[i] == page)  break;
            }
            for (i; i > 0; i--) {
                if ( isNaN(tpl[i]) ) break;
            }
            if ( i == 0 ) {
                return i;
            } else return i+1;
        }
		cStart.off("click");
		cStart.click(start);
	}
}) ( jQuery );
